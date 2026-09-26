const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window','document','navigator','HTMLElement','Element','Event','KeyboardEvent','MouseEvent']) {
  Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
HTMLElement.prototype.setPointerCapture = function() {};
HTMLElement.prototype.getBoundingClientRect = function() { return {left:0,top:0,width:100,height:100,bottom:100,right:100}; };
let frames = new Map(), frameID=0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameID,callback); return frameID; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { loadTS } = require('./load-ts.cjs');
const { FlatPad } = loadTS('src/components/rig/FlatPad.tsx');
const { FlatWheel } = loadTS('src/components/rig/FlatWheel.tsx');
const { useKeyboardController } = loadTS('src/hooks/useKeyboardController.ts');
const { defaultSettings, emptyState } = loadTS('src/lib/controller-types.ts');
const { keyboardState, mergeControllerInputs } = loadTS('src/lib/keyboard-controller.ts');
const { RELEASE_INPUTS } = loadTS('src/hooks/useInputReset.ts');
const settings={...defaultSettings,vibration:false,ffbHaptics:false};
function pointer(element,type,id=1,coords={}) {
  const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:50,clientY:50,...coords});
  Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'},pressure:{value:0}});
  act(()=>element.dispatchEvent(event));
}
function mount(Component, extra={}) {
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host);
  let state=emptyState();const reports=[];
  const props={settings,set:patch=>{state={...state,...patch};reports.push(structuredClone(state));},
    press:(id,down)=>{state={...state,buttons:{...state.buttons,[id]:down}};reports.push(structuredClone(state));},
    onSettingsChange:()=>{}, telemetry:{},telemetryLive:false,...extra};
  act(()=>root.render(React.createElement(Component,props)));
  return { host, reports, state:()=>state,
    button:label=>{ const el=[...host.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===label || el.textContent===label);assert.ok(el,`button ${label}`);return el; },
    rerender:patch=>{Object.assign(props,patch);act(()=>root.render(React.createElement(Component,props)));},
    unmount:()=>{act(()=>root.unmount());host.remove();},
  };
}

test('Every rendered gamepad button holds steadily, releases and preserves chords', () => {
  const app=mount(FlatPad);
  try {
    const buttons={A:'a',B:'b',X:'x',Y:'y',LB:'lb',RB:'rb',VIEW:'back',MENU:'start',HOME:'home',M1:'m1',M2:'m2',M3:'m3',M4:'m4','↑':'dpad_up','↓':'dpad_down','←':'dpad_left','→':'dpad_right'};
    for(const [label,id] of Object.entries(buttons)) {
      const button=app.button(label);
      pointer(button,'pointerdown',1);
      assert.equal(app.state().buttons[id],true,label);
      pointer(button,'pointerup',99); // unrelated finger must not release
      assert.equal(app.state().buttons[id],true);
      pointer(button,'pointerup',1);
      assert.equal(app.state().buttons[id],false);
      pointer(button,'pointerdown',2);
      pointer(button,'lostpointercapture',2);
      assert.equal(app.state().buttons[id],false);
    }
    pointer(app.button('A'),'pointerdown',1);
    pointer(app.button('LB'),'pointerdown',2);
    pointer(app.button('A'),'pointerup',1);
    assert.equal(app.state().buttons.lb,true);
    pointer(app.button('LB'),'pointerup',2);
    for(let i=0;i<50;i++) {
      pointer(app.button('A'),'pointerdown',1);
      pointer(app.button('A'),'pointerup',1);
    }
    const edges=app.reports.slice(-100).map(s=>s.buttons.a);
    assert.equal(edges.length,100);
    assert.ok(edges.every((down,i)=>down===(i%2===0)));
  } finally {app.unmount();}
});

test('Turbo release cancels the pending re-press; blur stops held controls', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const app=mount(FlatPad);
  try {
    act(()=>app.button('TURBO').click());
    pointer(app.button('A'),'pointerdown',1);
    assert.equal(app.state().buttons.a,true);
    act(()=>t.mock.timers.tick(74));
    assert.equal(app.state().buttons.a,false);
    pointer(app.button('A'),'pointerup',1); // release within the turbo off window
    act(()=>t.mock.timers.tick(500));
    assert.equal(app.state().buttons.a,false);
    pointer(app.button('A'),'pointerdown',2);
    act(()=>window.dispatchEvent(new Event('blur')));
    act(()=>t.mock.timers.tick(500));
    assert.equal(app.state().buttons.a,false);
  } finally {app.unmount();}
});

test('LT/RT preserve partial travel without a second full-scale digital alias', () => {
  const app=mount(FlatPad);
  try {
    for(const id of ['lt','rt']) {
      const button=app.button(`${id.toUpperCase()} ForceAdapt trigger — regular`);
      pointer(button,'pointerdown');assert.equal(app.state()[id],1);
      pointer(button,'pointermove',1,{clientY:75});
      assert.equal(app.state()[id],0.25);
      assert.equal(app.state().buttons[id==='lt'?'l2':'r2'],undefined);
      pointer(button,'pointerup',2);assert.equal(app.state()[id],0.25);
      pointer(button,'lostpointercapture');assert.equal(app.state()[id],0);
    }
  } finally {app.unmount();}
});

test('Both sticks move and return to zero; L3/R3 double taps release on blur', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const app=mount(FlatPad);
  try {
    for(const [label,x,y,click] of [['Left stick','lx','ly','l3'],['Right stick','rx','ry','r3']]) {
      const stick=app.host.querySelector(`[aria-label="${label}"]`);
      pointer(stick,'pointerdown',1,{clientX:100,clientY:50});
      assert.equal(app.state()[x],1);
      pointer(stick,'pointermove',1,{clientX:50,clientY:0});
      assert.equal(app.state()[y],-1);
      pointer(stick,'pointercancel');assert.ok(app.state()[x] === 0);assert.ok(app.state()[y] === 0);
      act(()=>stick.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
      assert.equal(app.state().buttons[click],true);
      act(()=>window.dispatchEvent(new Event('blur')));
      act(()=>t.mock.timers.tick(100));assert.equal(app.state().buttons[click],false);
    }
  } finally {app.unmount();}
});

test('Wheel pedals, handbrake, nitro and horn are immediate and cancel safely', () => {
  const app=mount(FlatWheel);
  try {
    for(const [label,id] of [['BRAKE','brake'],['GAS','throttle'],['Handbrake','handbrake'],['Nitro','nitro']]) {
      const button=app.button(label);
      pointer(button,'pointerdown');assert.equal(app.state()[id],1);
      if(id==='handbrake') { pointer(button,'pointermove',1,{clientY:50});assert.equal(app.state()[id],1); }
      pointer(button,'pointerup',2);assert.equal(app.state()[id],1);
      pointer(button,'lostpointercapture');assert.equal(app.state()[id],0);
    }
    pointer(app.button('Horn'),'pointerdown');assert.equal(app.state().buttons.horn,true);
    act(()=>window.dispatchEvent(new Event(RELEASE_INPUTS)));
    assert.equal(app.state().buttons.horn,false);
  } finally {app.unmount();}
});

test('Wheel return is quick; Auto-centre off preserves position and reset cancels animation', () => {
  for(const autoCentre of [true,false]) {
    const app=mount(FlatWheel,{settings:{...settings,autoCentre}});
    try {
      const wheel=app.host.querySelector('.flat-wheel-hit');
      pointer(wheel,'pointerdown',1,{clientX:100,clientY:50});
      pointer(wheel,'pointermove',1,{clientX:50,clientY:100});
      const held=app.state().steer;assert.ok(held>0);
      pointer(wheel,'pointerup');
      if(autoCentre) {
        const pending=[...frames.values()];frames.clear();
        act(()=>pending.forEach(frame=>frame(performance.now()+150)));
        assert.equal(app.state().steer,0);
      } else {assert.equal(app.state().steer,held);}
      act(()=>window.dispatchEvent(new Event(RELEASE_INPUTS)));
      assert.equal(app.state().steer,0);assert.equal(frames.size,0);
    } finally {app.unmount();}
  }
});

test('Keyboard arrows apply on keydown, not OS repeat, and mode switching releases keys', () => {
  const states=[];
  function Harness({mode='wheel',enabled=true}) {useKeyboardController(mode,enabled,s=>states.push(s));return null;}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const key=(type,code,extra={})=>act(()=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true,cancelable:true,...extra})));
  try {
    act(()=>root.render(React.createElement(Harness)));
    key('keydown','ArrowLeft');assert.equal(states.at(-1).steer,-1);
    const count=states.length;key('keydown','ArrowLeft',{repeat:true});assert.equal(states.length,count);
    key('keydown','ArrowUp');assert.equal(states.at(-1).throttle,1);assert.equal(states.at(-1).steer,-1);
    key('keydown','ControlLeft',{ctrlKey:true});assert.equal(states.at(-1).nitro,1);
    key('keyup','ArrowLeft');assert.equal(states.at(-1).steer,0);assert.equal(states.at(-1).throttle,1);
    act(()=>root.render(React.createElement(Harness,{mode:'pad'})));
    assert.equal(states.at(-1).throttle,0);
    key('keydown','ArrowLeft');assert.equal(states.at(-1).buttons.dpad_left,true);
    act(()=>window.dispatchEvent(new Event('blur')));assert.equal(states.at(-1).buttons.dpad_left,false);
    const input=document.createElement('input');host.append(input);
    act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ',bubbles:true})));
    assert.notEqual(states.at(-1).buttons.a,true);
  } finally {act(()=>root.unmount());host.remove();}
});

test('All keyboard bindings and mixed touch/keyboard ownership preserve held inputs', () => {
  const keys=new Set(['KeyZ','KeyX','KeyC','KeyV','KeyQ','KeyE','Enter','Backspace','Home','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','ShiftLeft','ControlLeft']);
  const pad=keyboardState(keys,'pad');
  for(const id of ['a','b','x','y','lb','rb','start','back','home','m1','m2','m3','m4','m5','m6']) assert.equal(pad.buttons[id],true,id);
  assert.equal(pad.lt,1);assert.equal(pad.rt,1);
  const touch={...emptyState(),rt:0.7,buttons:{a:true}};
  assert.equal(mergeControllerInputs(touch,pad).rt,1);
  const released=mergeControllerInputs(touch,emptyState());
  assert.equal(released.rt,0.7);assert.equal(released.buttons.a,true);
  const wheel=keyboardState(new Set(['ArrowLeft','ArrowRight','ArrowDown','ShiftLeft','ControlLeft','Space','KeyE','KeyH','KeyR']),'wheel');
  assert.equal(wheel.steer,0);assert.equal(wheel.brake,1);assert.equal(wheel.clutch,1);
  assert.equal(wheel.nitro,1);assert.equal(wheel.handbrake,1);assert.equal(wheel.gear,1);
  assert.equal(wheel.buttons.horn,true);assert.equal(wheel.buttons.reset,true);
});

for (const rate of [240,333]) test(`Transport at ${rate} Hz sends every press/release immediately, bounds backlog, and checks readiness`, t => {
  const originalChannel=globalThis.MessageChannel;
  let posts=0,closed=0;
  globalThis.MessageChannel=class {
    constructor() {
      this.port1={onmessage:null,close(){closed++;}};
      this.port2={postMessage:()=>{posts++;this.port1.onmessage?.();},close(){closed++;}};
    }
  };
  t.mock.timers.enable({apis:['setTimeout']});
  const { useBridge }=loadTS('src/hooks/useBridge.ts');
  class FakeSocket {
    static OPEN=1;
    static instances=[];
    constructor() {this.readyState=0;this.bufferedAmount=0;this.sent=[];FakeSocket.instances.push(this);}
    send(payload) {this.sent.push(JSON.parse(payload));}
    close() {this.readyState=3;this.onclose?.();}
    open() {this.readyState=1;this.onopen();}
    receive(msg) {this.onmessage({data:JSON.stringify(msg)});}
  }
  globalThis.WebSocket=FakeSocket;
  const ref={current:emptyState()};let api;
  function Harness({bindings}) {api=useBridge(ref,rate,'xinput',false,bindings);return null;}
  const app=mount(Harness);
  try {
    act(()=>api.connect('ws://127.0.0.1:8787'));
    const ws=FakeSocket.instances.at(-1);
    act(()=>ws.open());
    assert.equal(ws.sent.find(m=>m.type==='hello').rateHz,rate);
    assert.equal(api.status,'connecting');
    act(()=>ws.receive({type:'ready',controller:{connected:true}}));
    assert.equal(api.status,'connected');
    app.rerender({bindings:{...defaultSettings.wheelBindings,nitro:'b'}});
    const before=ws.sent.length;
    for(let i=0;i<50;i++) {
      ref.current={...ref.current,buttons:{a:true}};api.sendControllerEdge();
      ref.current={...ref.current,buttons:{a:false}};api.sendControllerEdge();
    }
    const edges=ws.sent.slice(before);
    assert.equal(edges.length,100);
    assert.ok(edges.every(msg=>msg.wheelBindings.nitro==='b'));
    assert.ok(edges.every((msg,i)=>msg.priority==='edge' && msg.buttons.a===(i%2===0)));
    assert.ok(edges.every((msg,i)=>i===0 || msg.seq>edges[i-1].seq));
    ws.bufferedAmount=2048;
    ref.current={...ref.current,lx:0.2};assert.equal(api.sendControllerStateNow(),false);
    ref.current={...ref.current,lx:0.9};assert.equal(api.sendControllerStateNow(),false);
    ws.bufferedAmount=0;
    act(()=>t.mock.timers.tick(5));
    assert.equal(ws.sent.at(-1).lx,0.9);
    assert.equal(posts>0,rate===333);
    act(()=>api.connect('ws://127.0.0.1:8787'));
    const latest=FakeSocket.instances.at(-1);
    act(()=>ws.onerror());assert.equal(api.status,'connecting'); // stale socket cannot change new status
    act(()=>latest.open());
    act(()=>latest.receive({type:'ready',controller:{connected:false}}));
    assert.equal(api.status,'error');
  } finally {app.unmount();globalThis.MessageChannel=originalChannel;}
  assert.ok(closed>=4,'both connections close their message ports');
});


test('LED screen receives live game names and updates after a game switch', () => {
  const app=mount(FlatPad,{gameName:'Forza Horizon 5'});
  try {
    assert.match(app.host.querySelector('.flat-pad-screen').textContent,/FORZA HORIZON 5/);
    app.rerender({gameName:'Assetto Corsa'});
    assert.match(app.host.querySelector('.flat-pad-screen').textContent,/ASSETTO CORSA/);
    app.rerender({gameName:'Disconnected'});
    assert.match(app.host.querySelector('.flat-pad-screen').textContent,/DISCONNECTED/);
  } finally {app.unmount();}
});

test('Wheel crosses angle wrap continuously, reverses at lock and ignores the hub singularity', () => {
  const app=mount(FlatWheel,{settings:{...settings,wheelRotationDeg:1080,steerSensitivity:1,deadzone:0,linearity:1}});
  const coords=deg=>({clientX:50+50*Math.cos(deg*Math.PI/180),clientY:50+50*Math.sin(deg*Math.PI/180)});
  try {
    const wheel=app.host.querySelector('.flat-wheel-hit');
    pointer(wheel,'pointerdown',1,coords(0));
    let previous=0;
    for(let deg=30;deg<=720;deg+=30) {
      pointer(wheel,'pointermove',1,coords(deg));
      assert.ok(app.state().steer>=previous-1e-10);
      previous=app.state().steer;
    }
    assert.equal(app.state().steer,1);
    pointer(wheel,'pointermove',1,coords(690));assert.ok(app.state().steer<1);
    const before=app.state().steer;
    pointer(wheel,'pointermove',1,{clientX:50,clientY:50});
    pointer(wheel,'pointermove',1,coords(180));
    assert.equal(app.state().steer,before);
    pointer(wheel,'pointermove',99,coords(90));assert.equal(app.state().steer,before);
    pointer(wheel,'pointercancel');
    const pending=[...frames.values()];frames.clear();
    act(()=>pending.forEach(frame=>frame(performance.now()+150)));
    assert.equal(app.state().steer,0);
  } finally {app.unmount();}
});

test('Wheel preserves steering on settings rerender and re-grab cancels auto-centre', () => {
  const app=mount(FlatWheel);
  try {
    const wheel=app.host.querySelector('.flat-wheel-hit');
    pointer(wheel,'pointerdown',1,{clientX:100,clientY:50});
    pointer(wheel,'pointermove',1,{clientX:50,clientY:100});
    const before=app.state().steer;
    app.rerender({settings:{...settings,steerSensitivity:2}});
    assert.equal(app.state().steer,before);
    pointer(wheel,'pointerup');assert.ok(frames.size>0);
    pointer(wheel,'pointerdown',2,{clientX:50,clientY:100});
    assert.equal(frames.size,0);assert.equal(app.state().steer,before);
    pointer(wheel,'pointermove',2,{clientX:100,clientY:50});
    assert.ok(app.state().steer<before);
    act(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(app.state().steer,0);assert.equal(frames.size,0);
  } finally {app.unmount();}
});


test('Both rate buttons retain old options and select the 3 ms default', () => {
  assert.equal(defaultSettings.sendRateHz,333);
  for(const Component of [FlatPad,FlatWheel]) {
    const changes=[];
    const app=mount(Component,{settings:{...settings,sendRateHz:240},onSettingsChange:p=>changes.push(p)});
    try {
      const button=app.button('Controller polling rate 240 Hz. Tap to change.');
      if(Component===FlatPad) act(()=>button.click());
      else pointer(button,'pointerdown');
      assert.equal(changes.at(-1).sendRateHz,333);
    } finally {app.unmount();}
  }
});

test('Wheel releases outside its element even when another control stops bubbling', () => {
  const app=mount(FlatWheel);
  try {
    const wheel=app.host.querySelector('.flat-wheel-hit');
    pointer(wheel,'pointerdown',1,{clientX:100,clientY:50});
    pointer(wheel,'pointermove',1,{clientX:50,clientY:100});
    assert.ok(app.state().steer>0);
    pointer(app.button('Horn'),'pointerup',1);
    const pending=[...frames.values()];frames.clear();
    act(()=>pending.forEach(frame=>frame(performance.now()+150)));
    assert.equal(app.state().steer,0);
  } finally {app.unmount();}
});

test('Wheel reaches neutral when animation frames stall and touch-end recovers a missed pointer-up', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const app=mount(FlatWheel);
  try {
    const wheel=app.host.querySelector('.flat-wheel-hit');
    pointer(wheel,'pointerdown',1,{clientX:100,clientY:50});
    pointer(wheel,'pointermove',1,{clientX:50,clientY:100});
    const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'touches',{value:[]});
    act(()=>document.dispatchEvent(end));
    act(()=>t.mock.timers.tick(125));
    assert.equal(app.state().steer,0);assert.equal(frames.size,0);
    pointer(wheel,'pointerdown',2,{clientX:100,clientY:50});
    pointer(wheel,'pointermove',2,{clientX:50,clientY:100});
    assert.ok(app.state().steer>0,'next gesture is not blocked by stale ownership');
  } finally {app.unmount();}
});

test('Wheel capture failure still moves outside the wheel, releases and cancels an old centering deadline on re-grab', t=> {
  t.mock.timers.enable({apis:['setTimeout']});
  const app=mount(FlatWheel);
  try {
    const wheel=app.host.querySelector('.flat-wheel-hit');
    wheel.setPointerCapture=()=>{throw Error('capture unavailable');};
    pointer(wheel,'pointerdown',1,{clientX:100,clientY:50});
    pointer(document.body,'pointermove',1,{clientX:50,clientY:100});
    assert.ok(app.state().steer>0);
    pointer(document.body,'pointerup',1);
    pointer(wheel,'pointerdown',2,{clientX:50,clientY:100});
    const held=app.state().steer;
    act(()=>t.mock.timers.tick(200));assert.equal(app.state().steer,held);
    pointer(document.body,'pointercancel',2);
    act(()=>t.mock.timers.tick(125));assert.equal(app.state().steer,0);
  } finally {app.unmount();}
});

test('Live detection applies both profiles, neutralizes held inputs on game change, and restores saved overrides',()=> {
  const {useBridge}=loadTS('src/hooks/useBridge.ts');
  class Socket {
    static OPEN=1;static instances=[];
    constructor(){this.readyState=0;this.bufferedAmount=0;this.sent=[];Socket.instances.push(this);}
    send(data){this.sent.push(JSON.parse(data));}
    close(){this.readyState=3;this.onclose?.();}
    open(){this.readyState=1;this.onopen();}
    receive(msg){this.onmessage({data:JSON.stringify(msg)});}
  }
  globalThis.WebSocket=Socket;
  const ref={current:emptyState()};let api;
  function Harness({options=defaultSettings}) {api=useBridge(ref,333,'xinput',false,defaultSettings.wheelBindings,options);return null;}
  const app=mount(Harness);
  try {
    act(()=>api.connect('ws://localhost:8787'));
    const ws=Socket.instances.at(-1);act(()=>ws.open());
    act(()=>ws.receive({type:'ready',profileMappingVersion:1,controller:{connected:true}}));
    assert.equal(api.profileMappingsSupported,true);
    ref.current={...emptyState(),nitro:1,rt:1};api.sendControllerEdge();
    act(()=>ws.receive({type:'game',name:'Asphalt Legends',process:'Asphalt9_Steam_x64_rtl'}));
    assert.equal(api.gameProfile.id,'asphalt-auto');
    const neutral=ws.sent.at(-1);
    assert.equal(neutral.priority,'edge');assert.equal(neutral.nitro,0);assert.equal(neutral.rt,0);
    assert.equal(neutral.wheelBindings.nitro,'a');assert.equal(neutral.wheelBindings.throttle,'none');assert.equal(neutral.padBindings.rt,'none');
    ref.current={...emptyState(),buttons:{a:true}};api.sendControllerEdge();
    const count=ws.sent.length;
    act(()=>ws.receive({type:'game',name:'Race loading',process:'Asphalt9_Steam_x64_rtl'}));
    assert.equal(ws.sent.length,count,'same game title updates do not release held inputs');
    act(()=>ws.receive({type:'game',name:'Other Game',process:'othergame'}));
    assert.equal(api.gameProfile.id,'standard');assert.deepEqual(ws.sent.at(-1).buttons,{});
    assert.equal(ws.sent.at(-1).wheelBindings.throttle,'rt');assert.equal(ws.sent.at(-1).padBindings.rt,undefined);
    app.rerender({options:{...defaultSettings,gameProfiles:{'asphalt-legends':{wheelBindings:{nitro:'rb'},padBindings:{a:'rb'}}}}});
    act(()=>ws.receive({type:'game',name:'Asphalt Legends',process:'Asphalt9'}));
    assert.equal(ws.sent.at(-1).wheelBindings.nitro,'rb');assert.equal(ws.sent.at(-1).padBindings.a,'rb');
  } finally {app.unmount();}
});
