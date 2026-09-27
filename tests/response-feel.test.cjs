const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTS}=require('./load-ts.cjs');
const {applyStickResponse,applySteeringTension,defaultSettings}=loadTS('src/lib/controller-types.ts');
test('ForceFlex preserves direction, deadzone and full radial travel at every weight',()=>{
 for(const joystickTensionGf of [30,50,80,100]) {
  const s={...defaultSettings,joystickTensionGf,deadzone:0.1,linearity:1,sensitivity:1};
  assert.deepEqual(applyStickResponse(0.03,0.04,s),[0,0]);
  const [x,y]=applyStickResponse(0.3,0.4,s);
  assert.ok(Math.abs(x/y-0.75)<1e-12);
  assert.ok(Math.abs(Math.hypot(...applyStickResponse(0.6,0.8,s))-1)<1e-12);
 }
});
test('Steering weight remains monotonic, symmetric, instant and reaches both locks',()=>{
 for(const weight of [0,0.5,1]) {
  assert.equal(applySteeringTension(0,weight),0);
  assert.equal(applySteeringTension(1,weight),1);
  assert.equal(applySteeringTension(-1,weight),-1);
  let last=0;
  for(let i=0;i<=100;i++) {
   const value=applySteeringTension(i/100,weight);
   assert.ok(value>=last);last=value;
   assert.ok(Math.abs(value+applySteeringTension(-i/100,weight))<1e-12);
  }
 }
 assert.ok(applySteeringTension(0.5,1)<applySteeringTension(0.5,0));
});


test('ForceFlex presets stay distinct through usable travel with ordered monotonic response',()=>{
 for(const linearity of [1,1.4,2.5]) {
  const series=[30,50,80,100].map(gf=>Array.from({length:101},(_,i)=>applyStickResponse(i/100,0,{...defaultSettings,joystickTensionGf:gf,linearity,sensitivity:1})[0]));
  for(const values of series) {
   assert.equal(values[0],0);assert.equal(values[100],1);
   for(let i=1;i<=100;i++) assert.ok(values[i]>=values[i-1]);
  }
  for(const i of [25,50,75]) for(let g=1;g<4;g++) assert.ok(series[g-1][i]>series[g][i]);
  assert.ok(series[0][50]-series[3][50]>0.25);
 }
});
