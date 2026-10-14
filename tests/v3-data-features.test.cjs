const installNativeDialog=require('./helpers/native-dialog.cjs');
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
function fixture() {
 const dom = new JSDOM('', {runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 installNativeDialog(dom.window);
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
 const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({show_support:false});dom.window.document.body.append(card);
 const registry={entities:new dom.window.Map([['sensor.a',{entity_id:'sensor.a',device_id:'dev',area_id:'own'}],['sensor.b',{entity_id:'sensor.b',device_id:'dev'}]]),devices:new dom.window.Map([['dev',{id:'dev',name:'Device',area_id:'parent'}]]),areas:new dom.window.Map([['own',{area_id:'own',name:'Own'}],['parent',{area_id:'parent',name:'Parent'}]])};
 const hass={connection:{connected:true},user:{id:'one',is_admin:false},language:'en',states:{'sensor.a':{state:'=1+1',last_changed:'now',attributes:{friendly_name:'Alpha',token:'private'}},'sensor.b':{state:'unavailable',last_changed:'now',attributes:{friendly_name:'Beta'}},'sensor.c':{state:'0',attributes:{friendly_name:'Orphan'}}},callWS:async({type})=>Array.from(registry[type.includes('entity_')?'entities':type.includes('device_')?'devices':'areas'].values())};
 card.hass=hass;return {dom,card,hass,registry,root:card.shadowRoot};
}
test('registry filters prefer entity area, keep hidden selections and clear restores all',async()=>{
 const f=fixture();try {await f.card._ensureRegistryMetadata();f.card._selectedEntities.add('sensor.b');f.card._filterArea='own';assert.deepEqual(Array.from(f.card._getFilteredEntities(),x=>x.entity_id),['sensor.a']);assert.deepEqual(Array.from(f.card._getSelectedEntities(),x=>x.entity_id),['sensor.b']);f.card._filterArea='__none__';assert.deepEqual(Array.from(f.card._getFilteredEntities(),x=>x.entity_id),['sensor.c']);f.root.querySelector('#clearFilters').click();assert.equal(f.card._getFilteredEntities().length,3);}finally{f.dom.window.close();}
});
test('selected columns preserve order and preview/file share formula-safe serializer',async()=>{
 const f=fixture();try {await f.card._ensureRegistryMetadata();f.card._exportColumns=['state','entity_id'];f.card._includeAttrsInExport=false;const frame=f.card._exportFrame('all',f.registry);assert.deepEqual(Object.keys(frame[0]),['state','entity_id']);assert.equal(f.card._serializeFrame(frame,'csv'),'state,entity_id\n"\'=1+1",sensor.a\nunavailable,sensor.b\n0,sensor.c');f.card._export('all',true);for(let i=0;i<8;i++)await Promise.resolve();const dialog=f.root.querySelector('[data-ha-tools-export]').shadowRoot;const preview=dialog.querySelector('[data-export=preview]');assert.match(preview.textContent,/state,entity_id/);assert.equal(preview.textContent.includes('=1+1'),false);assert.equal(preview.querySelectorAll('img').length,0);assert.equal(dialog.querySelector('[data-export=private]').checked,false);}finally{f.dom.window.close();}
});
test('comparison excludes equal states and all attributes; added removed and unavailable are literal',()=>{
 const f=fixture();try {const a={ts:'old',entities:{'sensor.a':{state:'1',attributes:{token:'old'}},'sensor.b':{state:'unavailable'},'sensor.old':{state:'2'}}};const b={ts:'new',entities:{'sensor.a':{state:'1',attributes:{token:'new'}},'sensor.b':{state:'unknown'},'sensor.new':{state:'0'}}};const rows=f.card._compareSnapshots(a,b);assert.deepEqual(Array.from(rows,x=>x.change),['changed','added','removed']);assert.equal(rows[0].before_state,'unavailable');assert.equal(rows[0].after_state,'unknown');assert.equal(rows[1].before_state,null);assert.equal(rows[2].after_state,null);assert.equal(JSON.stringify(rows).includes('token'),false);assert.equal(rows[0].source,'browser-local snapshot');}finally{f.dom.window.close();}
});
test('identity switch ignores late registry results and snapshot namespaces isolate users',async()=>{
 const f=fixture();try {const finishes=[];f.card._registryMetadata=null;f.card._registryPromise=null;f.card._hass.callWS=()=>new Promise(resolve=>{finishes.push(resolve);});const pending=f.card._ensureRegistryMetadata();const oldKey=f.card._snapshotKey();f.card.hass={...f.hass,user:{id:'two'},callWS:async()=>[]};finishes.forEach(resolve=>resolve([]));await pending;await f.card._ensureRegistryMetadata();assert.notEqual(f.card._snapshotKey(),oldKey);assert.equal(f.card._registryMetadata.entities.size,0);}finally{f.dom.window.close();}
});
test('compact rows expose name/state/id and native expanded detail retains focus',()=>{
 const f=fixture();try {const box=f.root.querySelector('[data-entity="sensor.a"]');box.click();const expand=f.root.querySelector('[data-expand="sensor.a"]');expand.focus();expand.click();assert.equal(expand.getAttribute('aria-expanded'),'true');const row=box.closest('tr');assert.match(row.querySelector('.entity-name').textContent,/Alpha/);assert.equal(row.querySelector('.state-val').textContent,'=1+1');assert.equal(row.querySelector('.entity-id').textContent,'sensor.a');f.card._updateEntities();assert.equal(f.root.activeElement.dataset.expand,'sensor.a');assert.equal(f.root.querySelector('[data-entity="sensor.a"]').checked,true);assert.match(f.root.querySelector('[data-attr-for="sensor.a"]').textContent,/last_changed|Last changed/);assert.match(Array.from(f.root.querySelectorAll('style'),node=>node.textContent).join('\n'),/@container[^}]*max-width:\s*499px/);}finally{f.dom.window.close();}
});
test('visual editor preserves unknown YAML and false values with immutable events and validation',()=>{
 const f=fixture();try {const editor=f.dom.window.document.createElement('ha-data-exporter-editor');editor.hass=f.hass;const original={type:'custom:ha-data-exporter',private_option:{keep:true},show_attributes:false,page_size:15};editor.setConfig(original);f.dom.window.document.body.append(editor);let emitted;editor.addEventListener('config-changed',e=>{emitted=e.detail.config;});const input=editor.shadowRoot.querySelector('#cf_storage_key');input.value='synthetic';input.dispatchEvent(new f.dom.window.Event('input'));assert.equal(emitted.private_option.keep,true);assert.equal(emitted.show_attributes,false);assert.equal(original.storage_key,undefined);assert.notEqual(emitted,editor._config);const page=editor.shadowRoot.querySelector('#cf_page_size');page.value='0';page.dispatchEvent(new f.dom.window.Event('input'));assert.match(editor.shadowRoot.querySelector('#editorError').textContent,/1.*1000/);assert.equal(emitted.page_size,15);const attrs=editor.shadowRoot.querySelector('#cf_show_attributes');assert.equal(attrs.checked,false);}finally{f.dom.window.close();}
});
test('registry controls use actual device IDs and permissions failure has explicit disabled filters', async () => {
 const f=fixture();try {
  await f.card._ensureRegistryMetadata();
  const device=f.root.querySelector('#deviceFilter');
  assert.equal(device.querySelector('option[value="dev"]').textContent,'Device');
  device.value='dev';device.dispatchEvent(new f.dom.window.Event('change'));
  assert.deepEqual(Array.from(f.card._getFilteredEntities(),row=>row.entity_id),['sensor.a','sensor.b']);
  f.card.hass={...f.hass,user:{id:'denied'},callWS:async()=>{throw Error('permission denied');}};
  await f.card._ensureRegistryMetadata();
  assert.equal(f.root.querySelector('#areaFilter').disabled,true);
  assert.match(f.root.querySelector('#registryStatus').textContent,/unavailable/);
 }finally{f.dom.window.close();}
});
test('legacy full-attribute snapshots require explicit read and never migrate or mutate storage', () => {
 const f=fixture();try {
  const key='ha-data-exporter-snapshots-default';
  const original=JSON.stringify([{ts:'old',entities:{'sensor.a':{state:'1',attributes:{token:'private'}}}},{ts:'new',entities:{'sensor.a':{state:'2',attributes:{token:'private'}}}}]);
  f.dom.window.localStorage.setItem(key,original);
  assert.equal(f.card._snapshotChoices().length,0);
  f.dom.window.confirm=()=>true;f.root.querySelector('#loadLegacySnapshots').click();
  assert.equal(f.card._snapshotChoices().length,2);
  f.card._comparison=[0,1];assert.equal(f.card._comparisonFrame()[0].change,'changed');
  assert.equal(JSON.stringify(f.card._comparisonFrame()).includes('private'),false);
  assert.equal(f.dom.window.localStorage.getItem(key),original);
  f.card.hass={...f.hass,user:{id:'other'}};
  assert.equal(f.card._snapshotChoices().length,0);
  assert.equal(f.dom.window.localStorage.getItem(key),original);
 }finally{f.dom.window.close();}
});
test('same-user connection switch changes snapshot namespace and clears comparison and preview', async () => {
 const f=fixture();try {
  f.card._comparison=[0,1];f.root.querySelector('#exportPreview').textContent='private preview';
  const old=f.card._snapshotKey();
  f.card.hass={...f.hass,connection:{options:{url:'ws://second.invalid/api/websocket'}}};
  assert.notEqual(f.card._snapshotKey(),old);
  assert.equal(f.card._comparisonFrame().length,0);
  assert.equal(f.root.querySelector('#exportPreview').textContent,'');
 }finally{f.dom.window.close();}
});
