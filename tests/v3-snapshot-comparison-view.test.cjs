'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const installNativeDialog=require('./helpers/native-dialog.cjs');
function fixture(states){
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://qa.invalid',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});installNativeDialog(dom.window);
 let clock=Date.parse('2026-10-15T00:00:00Z'),reads=0;const RealDate=dom.window.Date;dom.window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({storage_key:'qa-visible-comparison',show_support:false});dom.window.document.body.append(card);
 const hass={user:{id:'qa',is_admin:true},connection:{connected:true},language:'en',states,callWS:async()=>{reads++;return [];}};card.hass=hass;
 return {dom,card,hass,root:card.shadowRoot,reads:()=>reads,capture(){card.shadowRoot.querySelector('#snapshotNow').click();},advance(next){clock+=6000;card.hass={...hass,states:next};},compare(){for(const [id,value] of [['compareBefore','0'],['compareAfter','1']]){const select=card.shadowRoot.querySelector('#'+id);select.value=value;select.dispatchEvent(new dom.window.Event('change'));}},close(){card.remove();dom.window.close();}};
}
const entity=(state,extra={})=>({state,attributes:{friendly_name:'QA row',...extra}});
test('snapshot UI shows only changed states, both source times, zero, missing and literal text without HA reads',()=>{
 const f=fixture({'sensor.zero':entity('0'),'sensor.unavailable':entity('unavailable'),'sensor.same':entity('1',{note:'before'}),'sensor.removed':entity('1'),'sensor.html':entity('old')});try{
  f.capture();f.advance({'sensor.zero':entity('2'),'sensor.unavailable':entity('unknown'),'sensor.same':entity('1',{note:'after'}),'sensor.added':entity('0'),'sensor.html':entity('<img src=x onerror=alert(1)>')});f.capture();f.compare();
  const table=f.root.querySelector('table[aria-label="Snapshot state changes"]');assert.ok(table,'the selected pair must have a visible comparison, not only an export button');
  const rows=Object.fromEntries([...table.querySelectorAll('tbody tr')].map(row=>[row.cells[0].textContent,[row.cells[1].textContent,row.cells[2].textContent]]));
  assert.deepEqual(rows['sensor.zero'],['0','2']);assert.deepEqual(rows['sensor.unavailable'],['unavailable','unknown']);assert.deepEqual(rows['sensor.added'],['Not present','0']);assert.deepEqual(rows['sensor.removed'],['1','Not present']);assert.equal(rows['sensor.same'],undefined);
  assert.equal(rows['sensor.html'][1],'<img src=x onerror=alert(1)>');assert.equal(table.querySelector('img'),null);
  assert.deepEqual([...table.parentElement.querySelectorAll('time')].map(n=>n.dateTime),['2026-10-15T00:00:00.000Z','2026-10-15T00:00:06.000Z']);assert.doesNotMatch(table.parentElement.querySelector('.snapshot-times').textContent,/2026-10-15T/);assert.match(table.parentElement.textContent,/State only/);assert.equal(f.reads(),0);
  f.card.hass={...f.hass,language:'pl'};assert.ok(f.root.querySelector('table[aria-label="Zmiany stanów snapshotów"]'));assert.match(f.root.textContent,/Brak encji/);
 }finally{f.close();}
});
test('visible comparison pages all changes and clears when pair or identity becomes unavailable',()=>{
 const before=Object.fromEntries(Array.from({length:25},(_,i)=>['sensor.qa_'+String(i).padStart(2,'0'),entity('0')]));const after=Object.fromEntries(Object.keys(before).map(id=>[id,entity('1')]));const f=fixture(before);try{
  f.capture();f.advance(after);f.capture();f.compare();let table=f.root.querySelector('table[aria-label="Snapshot state changes"]');assert.ok(table);assert.equal(table.querySelectorAll('tbody tr').length,20);
  const next=[...f.root.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Next snapshot changes');assert.ok(next);next.click();table=f.root.querySelector('table[aria-label="Snapshot state changes"]');assert.equal(table.querySelectorAll('tbody tr').length,5);assert.match(table.textContent,/sensor.qa_24/);
  const select=f.root.querySelector('#compareBefore');select.value='1';select.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.root.querySelector('table[aria-label="Snapshot state changes"]'),null);assert.equal(f.root.querySelector('#exportDiff').disabled,true);
  select.value='0';select.dispatchEvent(new f.dom.window.Event('change'));assert.ok(f.root.querySelector('table[aria-label="Snapshot state changes"]'));
  f.card.hass={...f.hass,user:{id:'another',is_admin:false}};assert.equal(f.root.querySelector('table[aria-label="Snapshot state changes"]'),null);assert.equal(f.reads(),0);
 }finally{f.close();}
});
test('a stale pagination action cannot restore an older pair or another user history',()=>{
 const before=Object.fromEntries(Array.from({length:25},(_,i)=>['sensor.qa_'+String(i).padStart(2,'0'),entity('0')]));const after=Object.fromEntries(Object.keys(before).map(id=>[id,entity('1')]));const f=fixture(before);try{
  const errors=[];f.dom.window.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
  f.capture();f.advance(after);f.capture();f.compare();const oldNext=[...f.root.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Next snapshot changes');
  for(const [id,value] of [['compareBefore','1'],['compareAfter','0']]){const select=f.root.querySelector('#'+id);select.value=value;select.dispatchEvent(new f.dom.window.Event('change'));}
  oldNext.click();let table=f.root.querySelector('table[aria-label="Snapshot state changes"]');assert.equal(table.querySelector('tbody tr').cells[1].textContent,'1');assert.equal(table.querySelectorAll('tbody tr').length,20);
  f.card.hass={...f.hass,user:{id:'another',is_admin:false}};oldNext.click();assert.equal(errors.length,0);assert.equal(f.root.querySelector('table[aria-label="Snapshot state changes"]'),null);
 }finally{f.close();}
});
