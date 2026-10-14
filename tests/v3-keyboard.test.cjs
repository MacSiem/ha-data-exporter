'use strict';
const installNativeDialog=require('./helpers/native-dialog.cjs');
// Catches inaccessible sorting and focus loss when HA refreshes entity rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
function fixture() {
  const dom = new JSDOM('<body></body>', { runScripts:'dangerously', url:'http://localhost/', pretendToBeVisual:true, virtualConsole:new VirtualConsole() });
  installNativeDialog(dom.window);
  dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
  const card=dom.window.document.createElement('ha-data-exporter');
  card.setConfig({show_support:false});dom.window.document.body.append(card);
  const hass={user:{id:'synthetic-admin',is_admin:true},language:'en',themes:{},states:{
    'sensor.synthetic_a':{state:'2',attributes:{friendly_name:'Zebra'},last_changed:'2026-10-12T00:00:00Z'},
    'sensor.synthetic_z':{state:'1',attributes:{friendly_name:'Alpha'},last_changed:'2026-10-12T00:00:00Z'},
  },callWS:async()=>{throw Error('No history/export read needed');}};
  card.hass=hass;
  return {dom,card,hass,root:card.shadowRoot};
}
test('sorting is a native keyboard-focusable button and announces direction',()=>{
  const f=fixture();try{
    const th=f.root.querySelector('th[data-sort="name"]'),button=th.querySelector('button');
    assert.ok(button,'native keyboard sorting control');assert.equal(button.type,'button');
    button.focus();assert.equal(f.root.activeElement,button);
    button.click();assert.equal(th.getAttribute('aria-sort'),'ascending');
    assert.equal(f.root.querySelector('.entity-id').textContent,'sensor.synthetic_z');
    button.click();assert.equal(th.getAttribute('aria-sort'),'descending');
    assert.equal(f.root.querySelector('.entity-id').textContent,'sensor.synthetic_a');
    assert.equal(f.root.querySelectorAll('th[aria-sort="ascending"],th[aria-sort="descending"]').length,1);
  }finally{f.dom.window.close();}
});
test('each checkbox names the concrete entity and retains focus/selection across a state update',()=>{
  const f=fixture();try{
    let checkbox=f.root.querySelector('[data-entity="sensor.synthetic_a"]');
    assert.match(checkbox.getAttribute('aria-label')||'',/sensor\.synthetic_a/);
    checkbox.click();checkbox.focus();
    f.card._lastRenderTime=0;
    f.card.hass={...f.hass,states:{...f.hass.states,'sensor.synthetic_a':{...f.hass.states['sensor.synthetic_a'],state:'3'}}};
    checkbox=f.root.querySelector('[data-entity="sensor.synthetic_a"]');
    assert.equal(checkbox.checked,true);assert.equal(f.root.activeElement,checkbox);
    assert.equal(f.root.querySelector('[data-entity="sensor.synthetic_a"]').closest('tr').querySelector('.state-val').textContent,'3');
    assert.equal(f.root.querySelector('#exportBtn').disabled,false);
  }finally{f.dom.window.close();}
});
test('ordinary language update translates sort controls without replacing the focused button',()=>{
  const f=fixture();try{
    const button=f.root.querySelector('th[data-sort="name"] button');assert.ok(button);
    button.focus();f.card.hass={...f.hass,language:'pl'};
    assert.equal(f.root.querySelector('th[data-sort="name"] button'),button);
    assert.equal(f.root.activeElement,button);assert.match(button.textContent,/Nazwa/);
    assert.match(f.root.querySelector('[data-entity="sensor.synthetic_a"]').getAttribute('aria-label'),/Zaznacz.*sensor\.synthetic_a/);
  }finally{f.dom.window.close();}
});

test('touch label selects one record and keeps its export identity',()=>{
 const f=fixture();try {
  const input=f.root.querySelector('[data-entity="sensor.synthetic_a"]');
  const hitbox=input.closest('label');assert.ok(hitbox,'record has a native label hit area');
  hitbox.click();assert.equal(input.checked,true);
  assert.deepEqual([...f.card._selectedEntities],['sensor.synthetic_a']);
  assert.equal(f.root.querySelector('#exportBtn').disabled,false);
  hitbox.click();assert.equal(input.checked,false);assert.equal(f.card._selectedEntities.size,0);
 } finally {f.dom.window.close();}
});
test('header touch label selects filtered records without dropping an outside selection',()=>{
 const f=fixture();try {
  const row=f.root.querySelector('[data-entity="sensor.synthetic_a"]');row.click();
  const search=f.root.querySelector('#searchFilter');search.value='Alpha';search.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  const select=f.root.querySelector('#selectAll');const hitbox=select.closest('label');assert.ok(hitbox,'header has native label hit area');
  hitbox.click();assert.equal(f.card._selectedEntities.has('sensor.synthetic_z'),true);assert.equal(f.card._selectedEntities.has('sensor.synthetic_a'),true);
  hitbox.click();assert.equal(f.card._selectedEntities.has('sensor.synthetic_z'),false);assert.equal(f.card._selectedEntities.has('sensor.synthetic_a'),true);
 } finally {f.dom.window.close();}
});
