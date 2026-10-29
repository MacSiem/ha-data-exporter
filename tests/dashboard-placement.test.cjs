'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom'),installDialog=require('./helpers/native-dialog.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
async function setup(){
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://qa.invalid/lovelace/home',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window;installDialog(w);w.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
 const ha=w.document.createElement('home-assistant'),card=w.document.createElement('ha-data-exporter'),calls=[];let owner,hook,stored={title:'Existing',unknown:{keep:true},views:[{title:'Home',type:'sections',sections:[{type:'grid',cards:[]}]}]};
 const hass={user:{id:'admin',is_admin:true,is_active:true},connection:Object.assign(new w.EventTarget(),{connected:true}),connected:true,language:'en',themes:{},states:{'sensor.a':{state:'1',attributes:{friendly_name:'Example'}}},panels:{lovelace:{config:{mode:'storage'}}},callWS:async m=>{calls.push(clone(m));if(hook){const value=hook(m);if(value!==undefined)return value;}if(m.type==='lovelace/dashboards/list')return [];if(m.type==='lovelace/config')return clone(stored);if(m.type==='lovelace/config/save'){stored=clone(m.config);return null;}return [];}};
 ha.provideHass=e=>{e.hass=hass;};ha.addEventListener('show-dialog',e=>{owner=w.document.createElement(e.detail.dialogTag);ha.provideHass(owner);owner.showDialog(e.detail.dialogParams);ha.append(owner);});
 card.setConfig({show_support:false,future:{keep:true}});ha.append(card);w.document.body.append(ha);card.hass=hass;
 const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
 return {w,card,hass,calls,flush,get owner(){return owner;},get stored(){return stored;},set stored(v){stored=v;},set hook(v){hook=v;},q(s){return owner?.querySelector(s);},saves(){return calls.filter(m=>m.type==='lovelace/config/save');},async open(){const button=card.shadowRoot.querySelector('[data-data-dashboard-add]');assert.ok(button);button.click();await flush();const select=owner.querySelector('[data-dashboard]');select.value='0';select.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();},close(){owner?.closeDialog();card.remove();ha.remove();w.close();}};
}
test('Data placement previews the actual card without auto-snapshot side effects and exact Undo restores foreign fields',async()=>{
 const f=await setup();try{const before=clone(f.stored);assert.equal(f.calls.length,0);await f.open();
 const preview=f.q('[data-preview] ha-data-exporter');assert.ok(preview);assert.equal(preview.preview,true);assert.equal(preview.getAttribute('inert'),'');
 preview._snapshotSettings.enabled=true;preview._startAutoSnapshot();assert.ok(!preview._snapshotTimer);assert.equal(preview.shadowRoot.querySelector('[data-data-dashboard-add]'),null);
 f.q('[data-add]').click();await f.flush();assert.equal(f.saves().length,1);assert.equal(f.stored.views[0].sections[0].cards[0].future.keep,true);
 f.q('[data-undo]').click();await f.flush();assert.equal(f.saves().length,2);assert.deepEqual(f.stored,before);
 }finally{f.close();}
});
test('own remount and lost acknowledgement retain native readback and Undo',async()=>{
 const f=await setup();try{const before=clone(f.stored);await f.open();f.hook=m=>{if(m.type==='lovelace/config/save'){f.stored=clone(m.config);f.card.remove();return Promise.reject(Error('lost ACK'));}};
 f.q('[data-add]').click();await f.flush();assert.equal(f.saves().length,1);assert.equal(f.q('[data-undo]').disabled,false);
 f.hook=null;f.q('[data-undo]').click();await f.flush();assert.deepEqual(f.stored,before);assert.equal(f.saves().length,2);
 }finally{f.close();}
});
test('foreign changes and a revoked admin never get overwritten by Undo',async()=>{
 const f=await setup();try{await f.open();f.q('[data-add]').click();await f.flush();f.stored.foreignEdit=true;f.q('[data-undo]').click();await f.flush();assert.equal(f.saves().length,1);assert.equal(f.stored.foreignEdit,true);}finally{f.close();}
 const g=await setup();try{await g.open();g.q('[data-add]').click();await g.flush();g.hass.user.is_admin=false;g.owner.hass=g.hass;await g.flush();assert.equal(g.q('dialog'),null);assert.equal(g.saves().length,1);}finally{g.close();}
});
test('non-admin has no placement and ordinary source removal cancels preview without writes',async()=>{
 const f=await setup();try{f.hass.user.is_admin=false;f.card.hass=f.hass;assert.equal(f.card.shadowRoot.querySelector('[data-data-dashboard-add]'),null);assert.equal(f.calls.length,0);}finally{f.close();}
 const g=await setup();try{await g.open();g.card.remove();await g.flush();assert.equal(g.q('dialog'),null);assert.equal(g.saves().length,0);}finally{g.close();}
});
