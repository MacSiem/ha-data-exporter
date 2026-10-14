'use strict';
const installNativeDialog=require('./helpers/native-dialog.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
function fixture() {
 const dom=new JSDOM('',{runScripts:'dangerously',url:'https://local.invalid/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const blobs=[],anchors=[],timers=[];
 installNativeDialog(dom.window);
 dom.window.Blob=class {constructor(parts,options){this.parts=parts;this.type=options.type;blobs.push(this);}async text(){return this.parts.join('');}};
 dom.window.URL.createObjectURL=blob=>{assert.equal(blobs.includes(blob),true);return 'blob:test';};
 dom.window.URL.revokeObjectURL=()=>{};
 dom.window.HTMLAnchorElement.prototype.click=function(){anchors.push(this.download);};
 dom.window.confirm=()=>{throw Error('legacy export confirm');};
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
 const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({show_support:false});dom.window.document.body.append(card);
 const states={
  'sensor.zero':{state:'0',last_changed:'2026-10-12T00:00:00Z',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C',device_class:'temperature',temperature:0,token:'CANARY-TOKEN',note:'CANARY-FREEFORM',url:'https://private.invalid',ip_address:'192.168.1.42'}},
  'sensor.unknown':{state:'unknown',attributes:{friendly_name:'=CANARY-FORMULA',unit_of_measurement:'https://CANARY-URL.invalid'}},
  'sensor.text':{state:'CANARY-RAW-STATE',attributes:{friendly_name:'person@example.invalid',temperature:'CANARY-ATTR'}},
  'switch.a':{state:'on',attributes:{friendly_name:'Desk switch'}},
 };
 const connection={connected:true,addEventListener(){},removeEventListener(){}};
 const hass={language:'en',user:{id:'CANARY-USER',is_admin:false},connection,states,callWS:async()=>{throw Error('denied');}};
 card.hass=hass;
 const root=card.shadowRoot;
 const dialog=()=>root.querySelector('[data-ha-tools-export]')?.shadowRoot;
 const node=key=>dialog()?.querySelector(`[data-export="${key}"]`);
 const open=async(mode='all')=>{card._export(mode);await tick();assert.ok(dialog());};
 return {dom,card,hass,states,connection,root,blobs,anchors,timers,dialog,node,open,close(){card.remove();dom.window.close();}};
}
for(const format of ['json','csv','yaml']) test(`${format}: actual button opens inertly; Save consumes the exact UTF-8 preview once`,async()=>{
 const f=fixture();try{
  f.root.querySelector('#formatSelect').value=format;f.root.querySelector('#exportAllBtn').click();await tick();
  assert.ok(f.dialog());assert.equal(f.anchors.length,0);assert.equal(f.node('private').checked,false);
  const bytes=f.node('preview').textContent;assert.ok(bytes.includes('0'));assert.equal(f.blobs.length,1);
  assert.equal(await f.blobs[0].text(),bytes);assert.equal(Buffer.from(await f.blobs[0].text(),'utf8').equals(Buffer.from(bytes,'utf8')),true);
  f.card._serializeReviewedExport=()=>{throw Error('Save serialized twice');};
  f.node('save').click();f.node('save').click();await tick();assert.equal(f.anchors.length,1);assert.equal(f.blobs.length,1);
  assert.equal(f.node('status').dataset.resultState,'unconfirmed');assert.match(f.node('message').textContent,/filesystem.*not confirmed/);
 }finally{f.close();}
});
test('reviewed schema excludes danger canaries in BOTH modes and retains numeric zero, known states and unit',async()=>{
 const f=fixture();try{
  await f.open();let rows=JSON.parse((f.node('format').value='json',f.node('format').dispatchEvent(new f.dom.window.Event('change')),f.node('filename').value='safe.json',f.node('filename').dispatchEvent(new f.dom.window.Event('input')),f.node('refresh').click(),await tick(),f.node('preview').textContent)).rows;
  const zero=rows.find(r=>r.state===0);assert.ok(zero);assert.equal(rows[0].entity_id,'row-1');assert.equal(zero.attributes.temperature,0);assert.equal(zero.attributes.unit_of_measurement,'°C');assert.ok(rows.some(r=>r.state==='unknown'));
  for(const includePrivate of [false,true]) {
   f.node('private').checked=includePrivate;f.node('private').dispatchEvent(new f.dom.window.Event('change'));f.node('refresh').click();await tick();
   const bytes=f.node('preview').textContent;
   for(const danger of ['CANARY-TOKEN','CANARY-USER','CANARY-FREEFORM','CANARY-RAW-STATE','CANARY-ATTR','CANARY-URL','CANARY-FORMULA','person@example.invalid','192.168.1.42','https://'])assert.equal(bytes.includes(danger),false,danger);
  }
  assert.match(f.node('preview').textContent,/sensor.zero/);
  f.node('cancel').click();await f.open();assert.equal(f.node('private').checked,false);
 }finally{f.close();}
});
test('column order, selected outside filters, all current filters, and attribute choice survive W6',async()=>{
 const f=fixture();try{
  f.card._selectedEntities=new Set(['sensor.zero','switch.a']);f.card._filterSearch='unknown';f.card._exportColumns=['state','entity_id','attributes.temperature'];f.card._includeAttrsInExport=false;f.card._updateEntities();
  await f.open('selected');const selected=f.node('preview').textContent;assert.match(selected,/state,entity_id,attributes.temperature/);assert.match(selected,/Rows: 2/);assert.match(selected,/outside filters/);assert.equal(selected.includes('sensor.zero'),false);
  f.node('cancel').click();await f.open('all');assert.match(f.node('preview').textContent,/Rows: 1/);assert.match(f.node('preview').textContent,/unknown/);
 }finally{f.close();}
});
test('denied registries retain safe partial own states with no guessed area/device metadata',async()=>{
 const f=fixture();try{await f.card._ensureRegistryMetadata();await f.open();assert.equal(f.node('status').dataset.resultState,'partial');assert.match(f.node('source-limit').textContent,/Registry metadata unavailable/);assert.equal(f.node('save').disabled,false);f.node('save').click();await tick();assert.equal(f.anchors.length,1);}finally{f.close();}
});
test('private metadata uses only safe IDs/labels; config URLs/address/token fields never enter bytes',async()=>{
 const f=fixture();try{
  f.card._registryMetadata={entities:new Map([['sensor.zero',{device_id:'device_1',area_id:'area_1',config_entry_id:'CANARY-CONFIG'}]]),devices:new Map([['device_1',{name:'https://CANARY-DEVICE.invalid',configuration_url:'https://CANARY-CONFIG.invalid',connections:[['mac','00:11:22:33:44:55']]}]]),areas:new Map([['area_1',{name:'123 Secret Street',aliases:['CANARY-ALIAS']}]] )};f.card._registryStatus='ready';
  await f.open();f.node('private').checked=true;f.node('private').dispatchEvent(new f.dom.window.Event('change'));f.node('refresh').click();await tick();const bytes=f.node('preview').textContent;
  assert.ok(bytes.includes('device_1'));assert.ok(bytes.includes('area_1'));for(const danger of ['CANARY-DEVICE','CANARY-CONFIG','Secret Street','CANARY-ALIAS','00:11'])assert.equal(bytes.includes(danger),false);
 }finally{f.close();}
});
test('snapshot diff is local, pseudonymized and retains numeric/unknown/absent null',async()=>{
 const f=fixture();try{
  f.card._snapshots=[{ts:'2026-10-11T00:00:00Z',entities:{'sensor.zero':{state:'0'},'sensor.old':{state:'unavailable'}}},{ts:'2026-10-12T00:00:00Z',entities:{'sensor.zero':{state:'unknown'},'sensor.new':{state:'CANARY-DIFF'}}}];f.card._comparison=[0,1];
  await f.open('diff');f.node('format').value='json';f.node('format').dispatchEvent(new f.dom.window.Event('change'));f.node('filename').value='diff.json';f.node('filename').dispatchEvent(new f.dom.window.Event('input'));f.node('refresh').click();await tick();
  const bytes=f.node('preview').textContent,data=JSON.parse(bytes);assert.equal(bytes.includes('sensor.zero'),false);assert.equal(bytes.includes('CANARY-DIFF'),false);assert.match(data.source_limit,/browser-local/);assert.ok(data.rows.some(r=>r.before_state===0&&r.after_state==='unknown'));assert.ok(data.rows.some(r=>r.before_state===null));assert.ok(data.rows.some(r=>r.after_state===null));
 }finally{f.close();}
});
for(const mutate of ['filter','selection','columns','attrs','comparison','state','registry','role','offline','language','config'])test(`${mutate} context invalidates ready bytes; restoration uses a newer revision`,async()=>{
 const f=fixture();try{await f.open();const first=f.card._getExportContext().revision;
  const actions={filter:()=>{f.card._filterSearch='zero';f.card._updateEntities();},selection:()=>{f.card._selectedEntities.add('sensor.zero');f.card._updateStats();},columns:()=>{f.card._exportColumns=['state'];f.card._refreshColumnControls();},attrs:()=>{f.root.querySelector('#includeAttrs').click();},comparison:()=>{f.card._comparison=[0,1];f.card._refreshComparisonControls();},state:()=>{f.states['sensor.zero'].state='1';f.card.hass=f.hass;},registry:()=>{f.card._registryStatus='unavailable';f.card._refreshRegistryControls();},role:()=>{f.card.hass={...f.hass,user:{id:'other',is_admin:true}};},offline:()=>{f.connection.connected=false;f.card.hass=f.hass;},language:()=>{f.card.hass={...f.hass,language:'pl'};},config:()=>f.card.setConfig({show_support:false,page_size:15})};actions[mutate]();await tick();
  assert.ok(f.card._getExportContext().revision>first);if(f.dialog()){assert.equal(f.node('preview').textContent,'');assert.equal(f.node('save').disabled,true);f.node('save').click();}assert.equal(f.anchors.length,0);
  f.connection.connected=true;f.card.hass=f.hass;assert.ok(f.card._getExportContext().revision>first);
 }finally{f.close();}
});
test('unchanged source setter and background table render preserve open dialog and bytes',async()=>{
 const f=fixture();try{await f.open();const dialog=f.dialog(),bytes=f.node('preview').textContent,revision=f.card._getExportContext().revision;f.card.hass=f.hass;f.card._updateEntities();assert.equal(f.dialog(),dialog);assert.equal(f.node('preview').textContent,bytes);assert.equal(f.card._getExportContext().revision,revision);}finally{f.close();}
});
test('Cancel/Escape restore focus; root replacement/disconnect discard and remove document traps',async()=>{
 const f=fixture();try{
  const opener=f.root.querySelector('#exportAllBtn');opener.focus();opener.click();await tick();f.node('cancel').click();assert.equal(f.root.activeElement,opener);
  opener.click();await tick();f.dialog().querySelector('dialog').dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));assert.equal(f.dialog(),undefined);assert.equal(f.root.activeElement,opener);
  await f.open();f.card._render();assert.equal(f.dialog(),undefined);const outside=f.dom.window.document.createElement('button');f.dom.window.document.body.append(outside);outside.focus();assert.equal(f.dom.window.document.activeElement,outside);
  await f.open();f.card.remove();assert.equal(f.dialog(),undefined);assert.equal(f.anchors.length,0);
 }finally{f.close();}
});
test('late payload after cancellation and timeout cannot create ready bytes',async()=>{
 const f=fixture();try{
  let complete;f.card._buildReviewedExport=()=>new Promise(resolve=>complete=resolve);await f.open();f.node('cancel').click();complete({serialized:'CANARY-LATE',confirmed:true,sourceConfirmed:true,status:'success',included:['safe'],excluded:['private'],sourceLimit:'local'});await tick();assert.equal(f.blobs.length,0);assert.equal(f.anchors.length,0);
  const realTimer=f.dom.window.setTimeout;f.dom.window.setTimeout=(fn,ms)=>{if(ms===10000){f.timers.push(fn);return 999;}return realTimer(fn,ms);};await f.open();assert.equal(f.timers.length,1);f.timers[0]();complete({serialized:'CANARY-LATE',confirmed:true,sourceConfirmed:true,status:'success',included:['safe'],excluded:['private'],sourceLimit:'local'});await tick();assert.equal(f.blobs.length,0);assert.equal(f.node('save').disabled,true);
 }finally{f.close();}
});
test('invalid filename has no adapter call and PL opens with localized policy/count',async()=>{
 const f=fixture();try{f.card.hass={...f.hass,language:'pl'};await f.open();assert.equal(f.node('save').textContent,'Zapisz');assert.match(f.node('source-limit').textContent,/Wiersze: 4/);f.node('filename').value='../bad.csv';f.node('filename').dispatchEvent(new f.dom.window.Event('input'));f.node('refresh').click();await tick();assert.equal(f.node('status').dataset.resultState,'error');f.node('save').click();assert.equal(f.anchors.length,0);}finally{f.close();}
});

test('credential-bearing numeric sources and unreviewed attribute names never leak in either mode',async()=>{
 const f=fixture();try{
  f.states['sensor.access_token']={state:'735791',attributes:{friendly_name:'API token',temperature:987654}};
  f.card.hass=f.hass;
  for(const includePrivate of [false,true]){
   await f.open();f.node('private').checked=includePrivate;f.node('private').dispatchEvent(new f.dom.window.Event('change'));f.node('refresh').click();await tick();
   const bytes=f.node('preview').textContent;assert.equal(bytes.includes('735791'),false);assert.equal(bytes.includes('987654'),false);f.node('cancel').click();
  }
  f.card._exportColumns=['attributes.https://CANARY-HEADER.invalid','state'];f.card._refreshColumnControls();await f.open();assert.equal(f.node('preview').textContent.includes('CANARY-HEADER'),false);assert.match(f.node('preview').textContent,/excluded-column-1,state/);
 }finally{f.close();}
});
test('real connection events discard ready state and all subscriptions detach on removal',async()=>{
 const f=fixture();try{
  const listeners=new Map();const connection={connected:true,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  f.card.hass={...f.hass,connection};await f.open();assert.equal(listeners.size,2);connection.connected=false;listeners.get('disconnected')();assert.equal(f.dialog(),undefined);assert.equal(f.anchors.length,0);
  connection.connected=true;listeners.get('ready')();await f.open();const context=f.card._getExportContext();assert.equal(JSON.stringify(context).includes('CANARY-USER'),false);assert.equal(JSON.stringify(context).includes('sensor.zero'),false);
  f.card.remove();assert.equal(listeners.size,0);
 }finally{f.close();}
});
test('cached hass data with no actual connection cannot become a confirmed source',async()=>{
 const f=fixture();try{f.card.hass={...f.hass,connection:null};await f.open();assert.equal(f.node('status').dataset.resultState,'no_data');assert.equal(f.node('save').disabled,true);assert.equal(f.blobs.length,0);assert.equal(f.anchors.length,0);}finally{f.close();}
});

test('disconnect event fences exports before the connection flag catches up',async()=>{
 const f=fixture();try{
  const listeners=new Map(),connection={connected:true,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  f.card.hass={...f.hass,connection};await f.open();listeners.get('disconnected')();
  assert.equal(f.dialog(),undefined);assert.equal(f.card._getExportContext().connected,false);assert.equal(f.anchors.length,0);
  listeners.get('ready')();await f.open();assert.equal(f.node('save').disabled,false);assert.equal(f.anchors.length,0);
 }finally{f.close();}
});

test('browser offline clears the preview even while cached HA connection says connected',async()=>{
 const f=fixture();try{
  await f.open();f.dom.window.dispatchEvent(new f.dom.window.Event('offline'));
  assert.equal(f.dialog(),undefined);assert.equal(f.card._getExportContext().connected,false);
  f.dom.window.dispatchEvent(new f.dom.window.Event('online'));await f.open();assert.equal(f.node('save').disabled,false);assert.equal(f.anchors.length,0);
 }finally{f.close();}
});

test('international monetary and tariff units retain their meaning while unsafe unit text is excluded',async()=>{
 const f=fixture();try{
  for(const unit of ['JPY','EUR','PLN/kWh']){
   f.states['sensor.zero'].attributes.unit_of_measurement=unit;f.card.hass=f.hass;await f.open();
   f.node('format').value='json';f.node('format').dispatchEvent(new f.dom.window.Event('change'));f.node('filename').value='currency.json';f.node('filename').dispatchEvent(new f.dom.window.Event('input'));f.node('refresh').click();await tick();
   const rows=JSON.parse(f.node('preview').textContent).rows;
   assert.equal(rows.find(r=>r.state===0).attributes.unit_of_measurement,unit);f.node('cancel').click();
  }
 }finally{f.close();}
});


test('native cancel closes and restores opener; full render closes before root replacement and reopen resets consent',async()=>{
 const f=fixture();try{
  const opener=f.root.querySelector('#exportAllBtn');opener.focus();opener.click();await tick();
  const native=f.dialog().querySelector('dialog');assert(native);assert(native.open);assert(native.matches(':modal'));
  native.dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));await tick();assert.equal(native.open,false);assert.equal(f.dialog(),undefined);assert.equal(f.root.activeElement,opener);assert.equal(f.anchors.length,0);
  await f.open();const replacement=f.dialog().querySelector('dialog'),host=f.root.querySelector('[data-ha-tools-export]');f.node('private').checked=true;f.node('private').dispatchEvent(new f.dom.window.Event('change'));
  f.card._render();assert.equal(replacement.open,false);assert.equal(host.isConnected,false);assert.equal(f.dialog(),undefined);
  await f.open();assert(f.dialog().querySelector('dialog').matches(':modal'));assert.equal(f.node('private').checked,false);assert.equal(f.anchors.length,0);
 }finally{f.close();}
});
