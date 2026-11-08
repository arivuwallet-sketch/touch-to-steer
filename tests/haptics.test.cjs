const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTS}=require('./load-ts.cjs');
global.window=new EventTarget();
const effects=[],vibrations=[];let resets=0;
Object.defineProperty(global,'navigator',{configurable:true,value:{getGamepads:()=>[{vibrationActuator:{playEffect:(kind,params)=>{effects.push({kind,...params});return Promise.resolve();},reset:()=>{resets++;return Promise.resolve();}}}],vibrate:p=>{vibrations.push(p);return true;}}});
const h=loadTS('src/lib/haptics.ts');
test('Dual rumble preserves independent motors, intensity and delay; zero cancels instead of buzzing',t=>{
 t.mock.timers.enable({apis:['setTimeout']});h.setHapticsEnabled(true);
 h.playDualRumble('light',{strongMagnitude:.2,weakMagnitude:.8,duration:100,startDelay:30});
 t.mock.timers.tick(25);
 assert.equal(effects.at(-1).strongMagnitude,.2);assert.equal(effects.at(-1).weakMagnitude,.8);
 assert.equal(vibrations.length,0);
 t.mock.timers.tick(30);assert.ok(Array.isArray(vibrations.at(-1)));
 h.playDualRumble('heavy',{strongMagnitude:0,weakMagnitude:0});t.mock.timers.tick(1);
 assert.equal(vibrations.at(-1),0);assert.ok(resets>0);
});
test('Vibration off cancels queued bursts and heartbeat callbacks',t=>{
 t.mock.timers.enable({apis:['setTimeout']});h.setHapticsEnabled(true);
 h.playGunfireBurst(8);h.playHeartbeat();h.setHapticsEnabled(false);t.mock.timers.tick(1000);
 const count=effects.length;assert.equal(vibrations.at(-1),0);
 h.playDualRumble('heavy');t.mock.timers.tick(1000);assert.equal(effects.length,count);
 h.setHapticsEnabled(true);
});
test('Phone fallback duty cycle differs by intensity and never exceeds requested duration',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const pulse=amount=>{h.stopHaptics();t.mock.timers.tick(1);h.playDualRumble('heavy',{strongMagnitude:amount,weakMagnitude:0,duration:100});t.mock.timers.tick(25);return vibrations.at(-1);};
 const weak=pulse(.2),strong=pulse(.9);
 assert.equal(weak.reduce((a,b)=>a+b),100);assert.equal(strong.reduce((a,b)=>a+b),100);
 assert.ok(weak[0]<strong[0]);h.stopHaptics();t.mock.timers.tick(1);
});


test('Trigger animation is enabled, intensity-scaled and respects reduced motion',()=>{
 const css=require('fs').readFileSync(require('path').join(__dirname,'../src/styles.css'),'utf8');
 assert.match(css,/\.trigger-3d-rattle\s*\{\s*animation: trigger-3d-rattle 90ms linear infinite;/);
 assert.match(css,/--trigger-base-transform/);assert.match(css,/--trigger-rattle-strength/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none;/);
});
