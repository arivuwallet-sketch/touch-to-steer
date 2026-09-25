const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter,once}=require('node:events');
const {createRequire}=require('node:module');
const {WebSocketServer,WebSocket}=require('ws');
const bridgeFile=path.resolve(__dirname,'../public/bridge/rig-bridge.js');
const bridgeRequire=createRequire(bridgeFile);
const {XBTN,DSBTN}=require('../public/bridge/controller-report.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// Real WebSocket transport and the production bridge event handlers; only the
// Windows-native driver, telemetry sockets and process detection are replaced.
test('Bridge forwards presses during a pending game lookup, rejects stale state, and releases on timeout/close', async () => {
  let server,clock=100,finishLookup;
  const intervals=[],targets=[];
  function makeTarget(map) {
    const values={buttons:{},axes:{}};
    const target=new EventEmitter();
    Object.assign(target,{
      axis:Object.fromEntries(['leftX','leftY','rightX','rightY','leftTrigger','rightTrigger','dpadHorz','dpadVert'].map(key=>[key,{setValue:v=>{values.axes[key]=v;}}])),
      button:Object.fromEntries([...new Set(Object.values(map))].map(key=>[key,{setValue:v=>{values.buttons[key]=v;}}])),
      reports:[], attached:true,userIndex:0,
      connect(){return null;},
      resetInputs(){for(const k of Object.keys(values.buttons)) values.buttons[k]=false;for(const k of Object.keys(values.axes)) values.axes[k]=0;},
      update(){this.reports.push(structuredClone(values));this.emit('report');return null;},
      disconnect(){this.attached=false;},
    });targets.push(target);return target;
  }
  class FakeClient {connect(){return null;}createX360Controller(){return makeTarget(XBTN);}createDS4Controller(){return makeTarget(DSBTN);}}
  const quiet={log(){},warn(){},error(){}};
  const fakeProcess=new EventEmitter();
  Object.assign(fakeProcess,{env:{RIG_PORT:'0',TOUCHTOSTEER_ADAPTIVE_HAPTICS:'0'},platform:'win32',arch:'x64',version:process.version});
  const context={
    require(spec){
      if(spec==='vigemclient')return FakeClient;
      if(spec==='ws')return {WebSocketServer:class extends WebSocketServer {constructor(options){super(options);server=this;}}};
      if(spec==='node:os')return {...require('node:os'),networkInterfaces:()=>({})};
      if(spec==='node:fs')return {...fs,mkdirSync(){},appendFileSync(){},existsSync(){return false;}};
      if(spec==='node:child_process')return {spawn(){throw Error('Unexpected spawned helper');},spawnSync(){return {status:0,stdout:'SERVICE_NAME: ViGEmBus\nSTATE: 4 RUNNING'};}};
      if(spec==='node:dgram')return {createSocket(){const socket=new EventEmitter();socket.bind=()=>socket;return socket;}};
      if(spec==='./foreground-game.cjs')return {createForegroundReader:()=>()=>new Promise(resolve=>{finishLookup=resolve;})};
      return bridgeRequire(spec);
    },
    process:fakeProcess,console:quiet,__dirname:path.dirname(bridgeFile),module:{exports:{}},
    Buffer,performance:{now:()=>clock},setImmediate,clearImmediate,setTimeout,clearTimeout,
    setInterval(callback,delay){const timer={callback,delay,unref(){}};intervals.push(timer);return timer;},
    clearInterval(timer){timer.cleared=true;},
  };
  vm.runInNewContext(fs.readFileSync(bridgeFile,'utf8'),context,{filename:bridgeFile});
  if(!server.address())await once(server,'listening');
  const client=new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  try {
    await once(client,'open');
    const ready=once(client,'message');client.send(JSON.stringify({type:'hello',output:'universal'}));
    assert.equal(JSON.parse((await ready)[0]).controller.connected,true);
    assert.equal(targets.length,2);
    const foreground=intervals.find(t=>t.delay===1200);
    const query=foreground.callback();assert.equal(typeof finishLookup,'function');
    const first=once(targets[0],'report');
    client.send(JSON.stringify({type:'state',priority:'edge',seq:1,buttons:{a:true,lb:true},steer:-1,rt:0.45}));
    await first;
    assert.equal(targets[0].reports.at(-1).axes.leftX,-1);
    assert.equal(targets[0].reports.at(-1).axes.rightTrigger,0.45);
    assert.equal(targets[1].reports.at(-1).buttons.CROSS,true);
    // Old background sample followed immediately by a release: mailbox must
    // not restore the old A button once the edge has reached both targets.
    const release=once(targets[0],'report');
    client.send(JSON.stringify({type:'state',seq:2,buttons:{a:true},steer:1}));
    client.send(JSON.stringify({type:'state',priority:'edge',seq:3,buttons:{lb:true}}));
    await release;await tick();await tick();
    assert.equal(targets[0].reports.at(-1).buttons.A,false);
    assert.equal(targets[0].reports.at(-1).buttons.LEFT_SHOULDER,true);
    finishLookup('{"title":"Game","process":"game"}');await query;
    clock=2000;
    const watchdog=intervals.find(t=>t.delay===250);
    watchdog.callback();
    assert.ok(Object.values(targets[0].reports.at(-1).buttons).every(value=>!value));
    const close=once(server.clients.values().next().value,'close');client.close();await close;
    assert.ok(targets.every(target=>!target.attached));
    assert.equal(watchdog.cleared,true);
  } finally {
    client.terminate();for(const socket of server.clients)socket.terminate();
    await new Promise(resolve=>server.close(resolve));
  }
});
