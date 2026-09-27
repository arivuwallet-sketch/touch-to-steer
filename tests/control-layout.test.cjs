const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {loadTS}=require('./load-ts.cjs');
const {normalizeBox,swapControls,collectControls}=loadTS('src/lib/control-layout.ts');
test('Layouts bound moved/resized controls to the viewport and sanitize invalid sizes',()=>{
 assert.deepEqual(normalizeBox({x:99,y:-50,w:20,h:200}),{x:80,y:0,w:20,h:100,hidden:false});
 const b=normalizeBox({x:NaN,y:Infinity,w:NaN,h:-3});assert.deepEqual(b,{x:0,y:0,w:10,h:2,hidden:false});
});
test('Swapping preserves actions and visibility while replacing position and size',()=>{
 const a={x:1,y:2,w:10,h:12,hidden:false},b={x:40,y:50,w:20,h:22,hidden:true};
 const result=swapControls({a,b},'a','b');
 assert.deepEqual(result.a,{...b,hidden:false});assert.deepEqual(result.b,{...a,hidden:true});
 assert.equal(a.x,1);
});
test('Control keys survive rate/ForceFlex/profile changes and wheel internals stay grouped',()=>{
 const doc=new JSDOM('<main><button aria-label="Controller polling rate 333 Hz. Tap to change."></button><button aria-label="RT ForceAdapt trigger — race"></button><div class="flat-wheel-hit"><button>Horn</button></div><div class="flat-pad-screen">Game A</div></main>').window.document;
 const root=doc.querySelector('main'),before=collectControls(root);
 root.querySelector('button').setAttribute('aria-label','Controller polling rate 1000 Hz. Tap to change.');
 root.querySelectorAll('button')[1].setAttribute('aria-label','RT ForceAdapt trigger — regular');
 root.querySelector('.flat-pad-screen').textContent='Game B';
 assert.deepEqual(collectControls(root).map(c=>c.id),before.map(c=>c.id));assert.equal(before.length,4);
});
