const {test}=require('node:test');
const assert=require('node:assert/strict');
const {remotePolicy,authorizeUpgrade,playerLimit,capacityError}=require('../public/bridge/remote-access.cjs');
test('Public mode requires strong key format and loopback binding; mouse injection defaults off',()=>{
 assert.throws(()=>remotePolicy({RIG_PUBLIC:'1'}));
 assert.throws(()=>remotePolicy({RIG_PUBLIC:'1',RIG_ACCESS_TOKEN:'short'}));
 const policy=remotePolicy({RIG_PUBLIC:'1',RIG_ACCESS_TOKEN:'a'.repeat(43),RIG_HOST:'0.0.0.0'});
 assert.equal(policy.host,'127.0.0.1');assert.equal(policy.mouseAllowed,false);
 assert.equal(remotePolicy({}).mouseAllowed,true);
});
test('Pairing rejects absent, duplicate and incorrect tokens before upgrade',()=>{
 const token='a'.repeat(43);
 for(const value of ['', 'rig-v1', 'rig-v1, rig-auth.'+'b'.repeat(43),`rig-v1, rig-auth.${token}, rig-auth.${token}`]) {
  assert.equal(authorizeUpgrade({'sec-websocket-protocol':value},token),false);
 }
 assert.equal(authorizeUpgrade({'sec-websocket-protocol':`rig-v1, rig-auth.${token}`},token),true);
});
test('Capacity counts XInput devices separately from HID and never exceeds configured host limit',()=>{
 const sessions=new Set(Array.from({length:4},()=>({targets:[{type:'xinput'}]})));
 assert.match(capacityError(sessions,null,'xinput',16),/four/);
 assert.match(capacityError(sessions,null,'universal',16),/four/);
 assert.equal(capacityError(sessions,null,'ds4',16),null);
 assert.equal(capacityError(sessions,[...sessions][0],'xinput',16),null);
 assert.match(capacityError(sessions,null,'ds4',4),/Host limit/);
 for(const v of ['bad','0','1000']) assert.equal(playerLimit(v),16);
 assert.equal(playerLimit('8'),8);
});
