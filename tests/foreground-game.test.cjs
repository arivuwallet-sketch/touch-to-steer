const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createForegroundReader, FOREGROUND_GAME_COMMAND, FOREGROUND_WATCH_COMMAND } = require('../public/bridge/foreground-game.cjs');

test('Foreground watch compiles once, handles streamed lines, expires stale data and restarts after exit', async () => {
  let calls=0, child, clock=100;
  const read=createForegroundReader(()=>{
    calls++;
    child=new EventEmitter(); child.stdout=new EventEmitter();
    child.stdout.setEncoding=()=>{};child.kill=()=>child.emit('exit');
    return child;
  },'win32',()=>clock);
  assert.equal(await read(),null);
  assert.equal(await read(),null);assert.equal(calls,1);
  child.stdout.emit('data','{"title":"Game');
  assert.equal(await read(),null);
  child.stdout.emit('data',' One","process":"game1"}\r\n');
  assert.equal(JSON.parse(await read()).title,'Game One');
  child.stdout.emit('data','diagnostic\n{"title":"Game Two","process":"game2"}\n');
  assert.equal(JSON.parse(await read()).title,'Game Two');
  clock+=2001;assert.equal(await read(),null);
  child.emit('exit');assert.equal(await read(),null);assert.equal(calls,1);
  clock+=2001;await read();assert.equal(calls,2);
  child.stdout.emit('data','{"title":"","process":"protected-game"}\n');
  assert.equal(JSON.parse(await read()).process,'protected-game');
  read.stop();assert.equal(await createForegroundReader(()=>{throw Error('must not spawn');},'linux')(),null);
});

test('Foreground PowerShell samples off the input thread and avoids reserved $PID', () => {
  assert.doesNotMatch(FOREGROUND_GAME_COMMAND,/\$pid\b/i);
  assert.match(FOREGROUND_GAME_COMMAND,/\[ref\]\$foregroundProcessId/);
  assert.match(FOREGROUND_WATCH_COMMAND,/Start-Sleep -Milliseconds 250/);
  assert.equal(FOREGROUND_WATCH_COMMAND.match(/Add-Type/g).length,1);
  assert.doesNotMatch(FOREGROUND_WATCH_COMMAND,/exit 0/);
});
