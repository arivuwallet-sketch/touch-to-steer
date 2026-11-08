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

test('Size slider scales uniformly around the center and stays inside the canvas', () => {
 const {scaleControlBox}=loadTS('src/lib/control-layout.ts');
 const original={x:40,y:40,w:10,h:20,hidden:true};
 const scaled=scaleControlBox(original,20);
 assert.deepEqual(scaled,{x:35,y:30,w:20,h:40,hidden:true});
 const maximum=scaleControlBox(original,500);
 assert.equal(maximum.h,100);assert.equal(maximum.w/maximum.h,0.5);
 assert.ok(maximum.x>=0 && maximum.x+maximum.w<=100);
 assert.ok(maximum.y>=0 && maximum.y+maximum.h<=100);
 const minimum=scaleControlBox(original,0);assert.equal(minimum.w,2);assert.equal(minimum.h,4);
 assert.deepEqual(scaleControlBox(original,NaN),original);
});

test('Actual-control previews retain visual content but strip interactive behavior and duplicate IDs',()=>{
 const {cloneControlAppearance}=loadTS('src/components/rig/ControlPreview.tsx');
 const dom=new JSDOM('<button id="original" style="background:rgb(10,20,30);border-radius:20px" onclick="window.previewInput=true"><span id="label">RT</span><svg viewBox="0 0 20 20"><path d="M0 0L20 20" /></svg></button>');
 const previous=global.getComputedStyle;global.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
 try {
  const source=dom.window.document.querySelector('button');let sent=0;source.addEventListener('pointerdown',()=>sent++);
  const clone=cloneControlAppearance(source);dom.window.document.body.append(clone);
  clone.dispatchEvent(new dom.window.Event('pointerdown'));
  assert.equal(sent,0);assert.equal(clone.getAttribute('onclick'),null);assert.equal(clone.id,'');assert.equal(clone.querySelector('[id]'),null);
  assert.equal(clone.inert,true);assert.equal(clone.getAttribute('aria-hidden'),'true');
  assert.equal(clone.style.backgroundColor,'rgb(10, 20, 30)');assert.equal(clone.style.borderRadius,'20px');
  assert.equal(clone.textContent,'RT');assert.ok(clone.querySelector('svg path'));
  assert.equal(source.id,'original');
 }finally{global.getComputedStyle=previous;dom.window.close();}
});
