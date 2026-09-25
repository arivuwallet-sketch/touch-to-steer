const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createForegroundReader, FOREGROUND_GAME_COMMAND } = require('../public/bridge/foreground-game.cjs');

test('Slow foreground detection yields to controller work and never overlaps queries', async () => {
  let finish;
  let calls=0;
  const read=createForegroundReader((_file,_args,_options,callback)=>{ calls++; finish=callback; },'win32');
  const pending=read();
  assert.equal(read(),pending);
  let serviced=false;
  await new Promise(resolve=>setImmediate(()=>{ serviced=true; resolve(); }));
  assert.equal(serviced,true);
  assert.equal(calls,1);
  finish(null,'{"title":"Game","process":"game"}');
  assert.equal(JSON.parse(await pending).title,'Game');
  const next=read();
  assert.equal(calls,2);
  finish(new Error('query timeout'));
  assert.equal(await next,null);
});

test('Foreground PowerShell uses a writable process variable, not reserved $PID', () => {
  assert.doesNotMatch(FOREGROUND_GAME_COMMAND,/\$pid\b/i);
  assert.match(FOREGROUND_GAME_COMMAND,/\[ref\]\$foregroundProcessId/);
});
