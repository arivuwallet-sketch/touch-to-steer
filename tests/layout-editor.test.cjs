const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {loadTS}=require('./load-ts.cjs');

test('Editor reset is a draft change, supports undo, and only saves on request',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const keys=['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];
 const previous=Object.fromEntries(keys.map(k=>[k,global[k]]));
 Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const React=require('react');const {createRoot}=require('react-dom/client');
 const {LayoutEditor}=loadTS('src/components/rig/LayoutEditor.tsx');
 const root=createRoot(document.getElementById('root'));
 const original={x:10,y:20,w:10,h:20};const custom={x:30,y:40,w:20,h:40};let saved;
 try{
  await React.act(async()=>root.render(React.createElement(LayoutEditor,{mode:'pad',source:null,controls:[{id:'RT:0',label:'RT',box:original}],saved:{'RT:0':custom},aspect:16/9,onClose:()=>{},onSave:layout=>saved=layout})));
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  const width=()=>document.querySelector('input[aria-label="Control w"]').value;
  assert.equal(width(),'20');assert.equal(document.querySelector('input[aria-label="Control size"]').value,'200');
  await React.act(async()=>button('Reset layout').click());assert.equal(width(),'10');assert.equal(saved,undefined);
  await React.act(async()=>button('Undo').click());assert.equal(width(),'20');
  await React.act(async()=>button('Reset selected control').click());assert.equal(width(),'10');
  await React.act(async()=>button('Save layout').click());assert.deepEqual(saved['RT:0'],original);
 }finally{await React.act(async()=>root.unmount());for(const k of keys){if(previous[k]===undefined)delete global[k];else global[k]=previous[k];}dom.window.close();}
});
