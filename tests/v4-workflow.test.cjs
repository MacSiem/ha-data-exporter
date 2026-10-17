'use strict';
process.env.TZ='Asia/Tokyo';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const installNativeDialog=require('./helpers/native-dialog.cjs');
function fixture(callWS=async()=>[]) {
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://qa.invalid',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});installNativeDialog(dom.window);
 let clock=Date.parse('2026-10-25T00:30:05Z');const RealDate=dom.window.Date;dom.window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({storage_key:'qa-v4-workflow',show_support:false});dom.window.document.body.append(card);
 const reads=[],hass={user:{id:'qa-v4',is_admin:true},connection:{connected:true},language:'en',locale:{language:'en-GB',time_format:'24',date_format:'language',time_zone:'local'},config:{time_zone:'Europe/Warsaw'},states:{'sensor.two':{state:'2',attributes:{friendly_name:'Lamp 2'}},'sensor.ten':{state:'10',attributes:{friendly_name:'Lamp 10'}}},callWS:async request=>{reads.push(request.type);return callWS(request);}};card.hass=hass;
 const root=card.shadowRoot,change=(id,value,type='change')=>{const node=root.getElementById(id);assert.ok(node,id);node.value=value;node.dispatchEvent(new dom.window.Event(type,{bubbles:true}));};
 return {dom,card,root,hass,reads,change,async settle(){await new Promise(resolve=>setImmediate(resolve));},capture(){root.querySelector('#snapshotNow').click();},advance(ms){clock+=ms;},close(){card.remove();dom.window.close();}};
}
test('export has one bottom action, collapsed columns and an independent records tab',()=>{
 const f=fixture();try{
  const panel=f.root.querySelector('#exportWorkspace'),records=f.root.querySelector('#recordsWorkspace');assert.ok(panel);assert.ok(records.hidden);assert.equal(panel.hidden,false);
  const table=panel.querySelector('.table-container'),columns=panel.querySelector('#exportColumns'),bar=panel.querySelector('#exportBar');assert.ok(table.compareDocumentPosition(columns)&4);assert.ok(columns.compareDocumentPosition(bar)&4);assert.equal(columns.open,false);
  assert.ok(columns.contains(f.root.querySelector('#formatSelect')));assert.equal(bar.querySelectorAll('button').length,1);assert.ok(bar.contains(f.root.querySelector('#exportBtn')));
  assert.equal(f.root.querySelector('#exportAllBtn, #previewExport, #loadRegistryFilters'),null);assert.ok(records.contains(f.root.querySelector('#snapshotNow')));assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('tab roundtrip keeps controls, selected rows, snapshot pair and the running timer',()=>{
 const f=fixture();try{
  f.card._selectedEntities.add('sensor.two');f.change('searchFilter','Lamp 2','input');f.capture();f.advance(6000);f.capture();f.change('compareBefore','0');f.change('compareAfter','1');
  const enabled=f.root.querySelector('#snapshotEnabled');enabled.checked=true;enabled.dispatchEvent(new f.dom.window.Event('change'));
  const timer=f.card._snapshotTimer,root=f.root,select=root.querySelector('#compareBefore'),search=root.querySelector('#searchFilter'),saved=f.card._snapshots.length;
  root.querySelector('#recordsTab').click();assert.equal(root.querySelector('#recordsWorkspace').hidden,false);root.querySelector('#exportTab').click();
  assert.equal(root.querySelector('#compareBefore'),select);assert.equal(root.querySelector('#searchFilter'),search);assert.equal(search.value,'Lamp 2');assert.equal(select.value,'0');assert.ok(f.card._selectedEntities.has('sensor.two'));assert.equal(f.card._snapshots.length,saved);assert.equal(f.card._snapshotTimer,timer);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('additional filters lazily load three registries once and reopening does not refetch',async()=>{
 const f=fixture();try{
  assert.equal(f.reads.length,0);f.root.querySelector('#addFilter').click();f.root.querySelector('#addFilter').click();await f.settle();
  assert.deepEqual([...f.reads].sort(),['config/area_registry/list','config/device_registry/list','config/entity_registry/list']);assert.equal(f.root.querySelector('#areaFilter').disabled,false);
  f.root.querySelector('#addFilter').click();await f.settle();assert.equal(f.reads.length,3);
 }finally{f.close();}
});
test('unavailable registry filters give an explicit retry instead of automatic retry',async()=>{
 let denied=true;const f=fixture(async()=>{if(denied)throw new Error('Not authorized');return [];});try{
  f.root.querySelector('#addFilter').click();await f.settle();assert.equal(f.root.querySelector('#areaFilter').disabled,true);assert.match(f.root.querySelector('#registryStatus').textContent,/unavailable/i);
  f.card.hass=f.hass;await f.settle();assert.equal(f.reads.length,3);denied=false;f.root.querySelector('#retryRegistryFilters').click();await f.settle();assert.equal(f.reads.length,6);assert.equal(f.root.querySelector('#areaFilter').disabled,false);
 }finally{f.close();}
});
test('one active chip clears only its filter, retains hidden selection and returns focus',()=>{
 const f=fixture();try{
  f.card._selectedEntities.add('sensor.ten');f.change('domainFilter','sensor');f.change('searchFilter','Lamp 2','input');
  const chip=f.root.querySelector('[data-clear-filter="search"]');assert.ok(chip);chip.click();assert.equal(f.root.querySelector('#searchFilter').value,'');assert.equal(f.root.querySelector('#domainFilter').value,'sensor');assert.ok(f.card._selectedEntities.has('sensor.ten'));assert.equal(f.root.activeElement,f.root.querySelector('#searchFilter'));assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('one export action passes the chosen scope to the reviewed dialog, including hidden selections',()=>{
 const f=fixture();try{
  f.card._selectedEntities.add('sensor.ten');f.change('searchFilter','Lamp 2','input');const calls=[];f.card._export=mode=>calls.push(mode);f.root.querySelector('#exportBtn').click();f.change('previewMode','all');f.root.querySelector('#exportBtn').click();assert.deepEqual(calls,['selected','all']);assert.equal(f.card._getSelectedEntities()[0].entity_id,'sensor.ten');assert.equal(f.card._getFilteredEntities()[0].entity_id,'sensor.two');assert.match(f.root.querySelector('#selectionScope').textContent,/outside filters: 1/);
 }finally{f.close();}
});
test('snapshot labels keep seconds and respond immediately to mutable profile and DST without extra reads',()=>{
 const f=fixture();try{
  f.capture();f.advance(3600000);f.capture();f.change('compareBefore','0');f.change('compareAfter','1');const before=f.root.querySelector('#compareBefore'),raw=JSON.stringify(f.card._snapshots);
  assert.match(before.options[1].textContent,/09:30:05/);assert.doesNotMatch(before.options[1].textContent,/2026-10-25T/);
  f.hass.locale.time_zone='server';f.card.hass=f.hass;
  assert.equal(f.root.querySelector('#compareBefore'),before);assert.equal(before.value,'0');assert.match(before.options[1].textContent,/02:30:05.*GMT\+2/);assert.match(before.options[2].textContent,/02:30:05.*GMT\+1/);
  assert.deepEqual([...f.root.querySelectorAll('.snapshot-times time')].map(n=>n.getAttribute('datetime')),['2026-10-25T00:30:05.000Z','2026-10-25T01:30:05.000Z']);
  f.hass.locale.time_format='12';f.card.hass=f.hass;assert.match(before.options[1].textContent,/am/i);assert.equal(JSON.stringify(f.card._snapshots),raw);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('formatting preserves epoch zero, rejects missing dates and follows the system date language',()=>{
 const f=fixture();try{
  assert.match(f.card._displayTimestamp(0),/1970.*09:00:00/);assert.equal(f.card._displayTimestamp(null),'—');assert.equal(f.card._displayTimestamp('old'),'—');
  f.hass.locale.language='pl-PL';f.hass.locale.date_format='system';f.card.hass=f.hass;
  const raw='2026-10-25T00:30:05Z',expected=new Intl.DateTimeFormat(f.dom.window.navigator.language,{timeZone:'Asia/Tokyo',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'}).format(Date.parse(raw));
  assert.equal(f.card._displayTimestamp(raw),expected);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('full HA locale sorts registry names naturally and updates an expanded history without a read',async()=>{
 const f=fixture(async({type})=>type.includes('area_registry')?[{area_id:'ten',name:'Area 10'},{area_id:'two',name:'Area 2'}]:[]);try{
  f.root.querySelector('#addFilter').click();await f.settle();assert.deepEqual([...f.root.querySelector('#areaFilter').options].slice(2).map(n=>n.textContent),['Area 2','Area 10']);
  const host=f.dom.window.document.createElement('div');f.root.append(host);f.card._renderHistory(host,[{time:'2026-10-25T00:30:05Z',state:'0'}],'sensor.two');assert.match(host.textContent,/09:30:05/);const count=f.reads.length;
  f.hass.locale.time_zone='server';f.card.hass=f.hass;assert.match(host.textContent,/02:30:05/);assert.match(host.textContent,/GMT\+2/);assert.equal(f.reads.length,count);
  f.hass.locale.language='sv-SE';f.card.hass=f.hass;assert.equal(f.card._collator().resolvedOptions().locale,'sv');assert.equal(f.reads.length,count);
 }finally{f.close();}
});
test('identity and time zone changing together remove the previous user rows immediately',()=>{
 const f=fixture();try{
  assert.match(f.root.querySelector('#entityBody').textContent,/sensor.two/);
  f.card.hass={...f.hass,user:{id:'other',is_admin:false},locale:{...f.hass.locale,time_zone:'server'},states:{'sensor.other':{state:'0',attributes:{friendly_name:'Other user row'}}}};
  assert.doesNotMatch(f.root.querySelector('#entityBody').textContent,/sensor.two|sensor.ten/);assert.match(f.root.querySelector('#entityBody').textContent,/sensor.other/);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('numeric history timestamps remain dates after an in-place profile change',()=>{
 const f=fixture();try{
  const host=f.dom.window.document.createElement('div');f.root.append(host);f.card._renderHistory(host,[{time:0,state:'0'},{time:Date.parse('2026-10-25T00:30:05Z'),state:'1'}],'sensor.two');assert.match(host.textContent,/1970/);assert.match(host.textContent,/09:30:05/);
  f.hass.locale.time_format='12';f.card.hass=f.hass;assert.match(host.textContent,/1970/);assert.match(host.textContent,/09:30:05.*am/i);assert.equal(host.textContent.includes('—'),false);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('entity counts use singular English and Polish forms after filtering',()=>{
 const f=fixture();try{
  f.change('searchFilter','Lamp 2','input');assert.equal(f.root.querySelector('#stats').textContent,'1 entity');
  f.hass.locale.language='pl-PL';f.card.hass=f.hass;assert.equal(f.root.querySelector('#stats').textContent,'1 encja');
  f.change('searchFilter','','input');assert.equal(f.root.querySelector('#stats').textContent,'2 encje');assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('saved comparison counts use singular and Polish few forms without changing its rows',()=>{
 const f=fixture();try{
  f.capture();f.hass.states['sensor.two'].state='3';f.advance(6000);f.capture();f.change('compareBefore','0');f.change('compareAfter','1');assert.match(f.root.querySelector('#diffCount').textContent,/^1 change;/);
  f.hass.locale.language='pl-PL';f.card.hass=f.hass;assert.match(f.root.querySelector('#diffCount').textContent,/^1 zmiana;/);
  for(let i=0;i<3;i++)f.hass.states['sensor.added_'+i]={state:'0',attributes:{}};f.advance(6000);f.capture();f.change('compareAfter','2');assert.match(f.root.querySelector('#diffCount').textContent,/^4 zmiany;/);assert.equal(f.root.querySelectorAll('#snapshotComparison tbody tr').length,4);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
test('collapsed columns have a separate step heading, compact choices and counts before the export scope',()=>{
 const f=fixture();try{
  const columns=f.root.querySelector('#exportColumns'),summary=columns.querySelector('summary');assert.match(columns.previousElementSibling.textContent,/2.*Columns and format/);assert.doesNotMatch(summary.textContent,/Columns and format/);assert.match(summary.textContent,/columns.*CSV.*Private.*off.*Change/);
  assert.equal(f.root.querySelector('#exportBar').firstElementChild.id,'selectionScope');assert.equal(columns.open,false);
  columns.open=true;f.change('formatSelect','json');const check=f.root.querySelector('#columnControls input[aria-label="entity_id"]');check.click();assert.match(summary.textContent,/JSON/);assert.equal(f.root.querySelector('#columnControls input[aria-label="entity_id"]').checked,false);assert.equal(f.reads.length,0);
 }finally{f.close();}
});
