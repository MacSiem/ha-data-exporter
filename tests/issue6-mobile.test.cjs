'use strict';
// Issue #6 (HA 2026.10.4, Home Assistant iOS app, v4.3.0): no select-all in the
// narrow layout, the page jumping during periodic updates, Save failing with
// NSURLErrorDomain -999, and a column summary counting every HA entity.
const installNativeDialog=require('./helpers/native-dialog.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const SOURCE=process.env.SOURCE_JS||'ha-data-exporter.js';
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(config={},language='en'){
 const dom=new JSDOM('',{runScripts:'dangerously',url:'https://local.invalid/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 installNativeDialog(dom.window);
 dom.window.Blob=class{constructor(parts,options){this.parts=parts;this.type=options?.type;}async text(){return this.parts.join('');}};
 dom.window.eval(fs.readFileSync(SOURCE,'utf8'));
 const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({show_support:false,show_help:false,...config});dom.window.document.body.append(card);
 const states={
  'sensor.a':{state:'1',attributes:{friendly_name:'Alpha',temperature:21,unit_of_measurement:'°C',note:'free text'}},
  'sensor.b':{state:'2',attributes:{friendly_name:'Beta',humidity:40}},
  'sensor.c':{state:'3',attributes:{friendly_name:'Gamma'}},
  'calendar.x':{state:'off',attributes:{friendly_name:'Calendar',message:'m',description:'d',location:'l',all_day:false,start_time:'s',end_time:'e'}},
  // Forty attribute keys on an entity outside the selection must not reach the column summary.
  'light.noise':{state:'on',attributes:Object.fromEntries(Array.from({length:40},(_,i)=>['noise_'+i,i]))},
 };
 const connection={connected:true,addEventListener(){},removeEventListener(){}};
 const hass={language,user:{id:'qa',is_admin:true},themes:{},connection,states,callWS:async()=>{throw Error('denied');}};
 card.hass=hass;
 const root=card.shadowRoot;
 const change=(id,value)=>{const node=root.getElementById(id);node.value=value;node.dispatchEvent(new dom.window.Event('change'));};
 return {dom,card,hass,states,root,change,close(){card.remove();dom.window.close();}};
}

test('issue #6: selection tools select everything within filters and clear the selection outside the table header',()=>{
 const f=fixture();try{
  const select=f.root.getElementById('selectFiltered'),clear=f.root.getElementById('clearSelection');
  assert.ok(select&&clear,'selection tools exist');
  assert.equal(select.closest('thead'),null,'the narrow layout hides thead, so the tools must live outside it');
  assert.equal(select.hidden,false);
  f.change('domainFilter','sensor');
  assert.match(select.textContent,/Select all within filters \(3\)/);
  select.click();
  assert.deepEqual([...f.card._selectedEntities].sort(),['sensor.a','sensor.b','sensor.c']);
  assert.equal(f.root.querySelectorAll('input[data-entity]:checked').length,3);
  assert.match(clear.textContent,/Clear selection \(3\)/);
  assert.match(f.root.getElementById('selectionScope').textContent,/Selected: 3; outside filters: 0; matching filters: 3/);
  assert.equal(f.root.getElementById('exportBtn').disabled,false);
  clear.click();
  assert.equal(f.card._selectedEntities.size,0);
  assert.equal(f.root.querySelectorAll('input[data-entity]:checked').length,0);
  assert.equal(f.root.getElementById('exportBtn').disabled,true);
 }finally{f.close();}
});

test('issue #6: selection tools are translated and show_select_all false hides only select-all',()=>{
 const pl=fixture({},'pl');try{
  assert.match(pl.root.getElementById('selectFiltered').textContent,/Zaznacz wszystkie w filtrach \(5\)/);
  assert.match(pl.root.getElementById('clearSelection').textContent,/Wyczyść zaznaczenie \(0\)/);
 }finally{pl.close();}
 const hidden=fixture({show_select_all:false});try{
  assert.equal(hidden.root.getElementById('selectFiltered').hidden,true);
  assert.equal(hidden.root.getElementById('clearSelection').hidden,false);
 }finally{hidden.close();}
});

test('issue #6: a periodic hass update patches the visible page in place instead of rebuilding it',()=>{
 const f=fixture();try{
  const row=f.root.querySelector('input[data-entity="sensor.a"]');
  const option=f.root.querySelector('#domainFilter option[value="sensor"]');
  const next=f.root.getElementById('nextPage');
  const expand=f.root.querySelector('[data-expand="sensor.a"]');
  expand.click();
  const history=f.root.getElementById('history-sensor_a');
  row.focus();
  f.card.hass={...f.hass,states:{...f.states,'sensor.a':{...f.states['sensor.a'],state:'42',attributes:{...f.states['sensor.a'].attributes,temperature:22}}}};
  f.card._updateEntities();
  assert.equal(f.root.querySelector('input[data-entity="sensor.a"]'),row,'the row keeps its node');
  assert.equal(f.root.querySelector('#domainFilter option[value="sensor"]'),option,'domain options keep their nodes');
  assert.equal(f.root.getElementById('nextPage'),next,'pagination keeps its nodes');
  assert.equal(f.root.getElementById('history-sensor_a'),history,'loaded history stays in place');
  assert.equal(f.root.activeElement,row,'focus never moves');
  assert.equal(row.closest('tr').querySelector('.state-val').textContent,'42');
  const details=f.root.querySelector('[data-attr-for="sensor.a"]');
  assert.notEqual(details.style.display,'none');assert.equal(expand.getAttribute('aria-expanded'),'true');
  assert.match(details.querySelector('.attr-grid').textContent,/22/);
  // A different page (sorting) still renders new rows.
  f.card._sortAsc=false;f.card._updateEntities();
  assert.equal(f.root.querySelector('#entityBody input[data-entity]').dataset.entity,'sensor.c');
  assert.match(f.root.getElementById('pageStatus').textContent,/Page 1 of 1 \(5\)/);
 }finally{f.close();}
});

test('issue #6: Save keeps the blob URL alive for the WebKit download handoff and never opens a new window',async()=>{
 const f=fixture();try{
  const events=[];let clicked=null;
  f.dom.window.URL.createObjectURL=()=>{events.push('create');return 'blob:qa';};
  f.dom.window.URL.revokeObjectURL=url=>events.push('revoke:'+url);
  f.dom.window.HTMLAnchorElement.prototype.click=function(){clicked={connected:this.isConnected,target:this.getAttribute('target'),download:this.download};events.push('click');};
  const timers=[],realSetTimeout=f.dom.window.setTimeout.bind(f.dom.window);
  f.dom.window.setTimeout=(fn,ms,...args)=>{timers.push({fn,ms,after:events.length});return realSetTimeout(fn,ms,...args);};
  f.change('previewMode','all');
  f.card._export('all');await tick();
  const dialog=f.root.querySelector('[data-ha-tools-export]').shadowRoot;
  dialog.querySelector('[data-export=save]').click();await tick();
  await new Promise(resolve=>realSetTimeout(resolve,30));
  assert.ok(clicked,'Save clicked a download link');
  assert.equal(clicked.connected,true,'the link is attached while clicked');
  assert.equal(clicked.target,null,'no target: the HA app would open target=_blank in a browser');
  assert.match(clicked.download,/^ha-export-.*\.(?:csv|json|yaml)$/);
  assert.equal(events.some(event=>event.startsWith('revoke')),false,'the URL is not revoked right after click');
  assert.equal(f.dom.window.document.querySelectorAll('a[download]').length,0,'the link is removed after click');
  const revoke=timers.filter(timer=>timer.after>=events.indexOf('click')+1&&timer.ms>=30000);
  assert.equal(revoke.length,1,'one delayed revoke is scheduled');
  revoke[0].fn();assert.deepEqual(events.filter(event=>event.startsWith('revoke')),['revoke:blob:qa']);
 }finally{f.close();}
});

test('issue #6: the column summary and picker describe the export scope, not every Home Assistant entity',()=>{
 const f=fixture();try{
  const summary=()=>f.root.getElementById('columnSummaryText').textContent;
  f.root.querySelector('input[data-entity="sensor.a"]').click();
  assert.match(summary(),/^11 columns/,'9 base columns plus temperature and unit of sensor.a');
  f.change('previewMode','all');
  assert.match(summary(),/^12 columns/,'all within filters adds humidity; free text and noise never count');
  const columns=f.root.getElementById('exportColumns');columns.open=true;columns.dispatchEvent(new f.dom.window.Event('toggle'));
  const labels=[...f.root.querySelectorAll('#columnControls input')].map(node=>node.getAttribute('aria-label'));
  assert.equal(labels.some(label=>/noise_|message|description|location|note/.test(label)),false);
  assert.ok(labels.includes('attributes.humidity'));
  f.change('previewMode','selected');
  const after=[...f.root.querySelectorAll('#columnControls input')].map(node=>node.getAttribute('aria-label'));
  assert.equal(after.includes('attributes.humidity'),false,'an open picker follows the scope');
 }finally{f.close();}
});
