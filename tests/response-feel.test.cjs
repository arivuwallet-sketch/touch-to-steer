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
