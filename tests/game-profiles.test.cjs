const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTS}=require('./load-ts.cjs');
const {resolveGameProfile}=loadTS('src/lib/game-profiles.ts');
const {defaultWheelBindings}=loadTS('src/lib/controller-types.ts');
const {XBTN,DSBTN,applySessionState}=require('../public/bridge/controller-report.cjs');
function targetFor(map) {
  const values={axes:{},buttons:{}};
  return {
    axis:Object.fromEntries(['leftX','leftY','rightX','rightY','leftTrigger','rightTrigger','dpadHorz','dpadVert'].map(id=>[id,{setValue:v=>values.axes[id]=v}])),
    button:Object.fromEntries([...new Set(Object.values(map))].map(id=>[id,{setValue:v=>values.buttons[id]=v}])),
    reports:[],update(){this.reports.push(structuredClone(values));},
  };
}
test('Asphalt Steam/Store/renamed title resolves by executable; UWP title is exact',()=> {
  for(const exe of ['Asphalt9_Steam_x64_rtl.exe','asphalt9_gdk_x64_rtl','Asphalt9','AsphaltLegends','AsphaltLegendsUnite']) {
    assert.equal(resolveGameProfile('race loading',exe).id,'asphalt-auto');
  }
  for(const title of ['Asphalt 9: Legends','Asphalt Legends Unite','Asphalt Legends']) {
    assert.equal(resolveGameProfile(title,'ApplicationFrameHost.exe').id,'asphalt-auto');
  }
  for(const exe of ['chrome','msedge','firefox','steam','discord','explorer','asphalt8']) {
    assert.equal(resolveGameProfile('Asphalt Legends',exe).id,'standard');
  }
  assert.equal(resolveGameProfile('Asphalt Legends walkthrough','applicationframehost').id,'standard');
});
test('Per-game overrides restore across games, never leak, and manual settings win when auto is disabled',()=> {
  const gameProfiles={
    'asphalt-legends':{wheelBindings:{nitro:'rb'},padBindings:{a:'rb'}},
    'process:mygame':{wheelBindings:{throttle:'a'},padBindings:{rt:'a'}},
  };
  const asphalt=resolveGameProfile('', 'asphalt9', {gameProfiles});
  assert.equal(asphalt.wheelBindings.nitro,'rb');assert.equal(asphalt.padBindings.a,'rb');
  const unknown=resolveGameProfile('My Game','mygame.exe',{gameProfiles});
  assert.equal(unknown.wheelBindings.throttle,'a');assert.equal(unknown.padBindings.rt,'a');
  const other=resolveGameProfile('Other','othergame',{gameProfiles});
  assert.equal(other.wheelBindings.throttle,'rt');assert.equal(other.padBindings.rt,undefined);
  const heat=resolveGameProfile('', 'NeedForSpeedHeat', {gameProfiles});
  assert.equal(heat.id,'nfs-heat');assert.equal(heat.wheelBindings.nitro,'a');assert.equal(heat.wheelBindings.throttle,'rt');
  const manual=resolveGameProfile('', 'asphalt9', {gameProfiles,autoGameProfiles:false}, {...defaultWheelBindings,nitro:'y'});
  assert.equal(manual.wheelBindings.nitro,'y');
  const invalid=resolveGameProfile('', 'asphalt9', {gameProfiles:{'asphalt-legends':{wheelBindings:{nitro:'bad'}}}});
  assert.equal(invalid.wheelBindings.nitro,'a');
});
for(const [kind,map] of [['XInput',XBTN],['DS4',DSBTN]]) {
 test(`${kind}: detected Asphalt separates gas, nitro and drift in BOTH modes`,()=> {
  const profile=resolveGameProfile('Asphalt Legends','asphalt9');
  const target=targetFor(map),session={targets:[{target,map}],lastAppliedSeq:0,lastAppliedSignature:''};
  const send=(state)=>{applySessionState(session,{...state,wheelBindings:profile.wheelBindings,padBindings:profile.padBindings});return target.reports.at(-1);};
  for(const state of [{throttle:1},{rt:1}]) {
    const report=send(state);
    assert.equal(report.axes.rightTrigger,0);
    assert.ok(Object.values(report.buttons).every(v=>!v),'GAS cannot consume nitro in auto acceleration');
  }
  for(const state of [{nitro:1},{buttons:{a:true}}]) {
    const report=send(state);
    assert.equal(report.buttons[map.a],true);
    assert.equal(report.buttons[map.x],false);assert.equal(report.axes.leftTrigger,0);
    const neutral=send({});assert.ok(Object.values(neutral.buttons).every(v=>!v));
  }
  for(const state of [{handbrake:1},{buttons:{x:true}}]) {
    const report=send(state);assert.equal(report.buttons[map.x],true);assert.equal(report.buttons[map.a],false);
  }
  const manual=resolveGameProfile('', 'asphalt9', {asphaltAcceleration:'manual'});
  applySessionState(session,{throttle:0.5,wheelBindings:manual.wheelBindings,padBindings:manual.padBindings});
  assert.equal(target.reports.at(-1).axes.rightTrigger,0.5);
  applySessionState(session,{rt:0.4,wheelBindings:manual.wheelBindings,padBindings:manual.padBindings});
  assert.equal(target.reports.at(-1).axes.rightTrigger,0.4);
 });
 test(`${kind}: pad remaps are simultaneous, preserve chords, and release old assignments`,()=> {
  const target=targetFor(map),session={targets:[{target,map}],lastAppliedSeq:0,lastAppliedSignature:''};
  applySessionState(session,{buttons:{a:true},padBindings:{a:'x',x:'a'}});
  assert.equal(target.reports.at(-1).buttons[map.x],true);assert.equal(target.reports.at(-1).buttons[map.a],false);
  applySessionState(session,{buttons:{a:true},padBindings:{a:'rb'}});
  assert.equal(target.reports.at(-1).buttons[map.x],false);assert.equal(target.reports.at(-1).buttons[map.rb],true);
  applySessionState(session,{rt:0.4,buttons:{a:true},padBindings:{a:'rt'}});
  assert.equal(target.reports.at(-1).axes.rightTrigger,1);
  applySessionState(session,{rt:0.4,buttons:{a:false},padBindings:{a:'rt'}});
  assert.equal(target.reports.at(-1).axes.rightTrigger,0.4);
 });
}

test('Saving one binding does not freeze auto acceleration into the manual preset',()=> {
  const {updateGameOverride}=loadTS('src/lib/game-profiles.ts');
  const current=resolveGameProfile('', 'asphalt9');
  const saved=updateGameOverride(undefined,current,{wheelBindings:{...current.wheelBindings,nitro:'rb'},padBindings:{...current.padBindings,a:'rb'}});
  assert.deepEqual(saved,{wheelBindings:{nitro:'rb'},padBindings:{a:'rb'}});
  const manual=resolveGameProfile('', 'asphalt9',{asphaltAcceleration:'manual',gameProfiles:{'asphalt-legends':saved}});
  assert.equal(manual.wheelBindings.throttle,'rt');assert.equal(manual.padBindings.rt,undefined);
  assert.equal(manual.wheelBindings.nitro,'rb');
});
