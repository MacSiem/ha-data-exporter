const installNativeDialog=require('./helpers/native-dialog.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
function fixture(){
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost/'});
 installNativeDialog(dom.window);
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
 const card=dom.window.document.createElement('ha-data-exporter');
 card.setConfig({domains:['sensor'],show_support:false});dom.window.document.body.append(card);
 const states={'sensor.a':{state:'1',attributes:{}},'sensor.b':{state:'2',attributes:{}},'switch.hidden':{state:'on',attributes:{}}};
 card.hass={language:'en',user:{id:'qa',is_admin:true},themes:{},states};
 return {dom,card,states};
}
test('selected export spans UI filters but respects configured domains and missing entities',async()=>{
 const f=fixture();try{
  f.card.hass={...f.card._hass,connection:{connected:true}};
  f.card._selectedEntities=new Set(['sensor.a','sensor.b','switch.hidden','sensor.removed']);
  f.card._filterSearch='no-match';f.card._filterDomain='switch';f.card._updateEntities();
  await f.card._export('selected');
  for(let i=0;i<8;i++)await Promise.resolve();let dialog=f.card.shadowRoot.querySelector('[data-ha-tools-export]').shadowRoot;assert.match(dialog.querySelector('[data-export=source-limit]').textContent,/Rows: 2/);dialog.querySelector('[data-export=cancel]').click();
  assert.equal(f.card.shadowRoot.getElementById('exportBtn').textContent,'Preview and save');assert.match(f.card.shadowRoot.getElementById('selectionScope').textContent,/Selected: 2/);
  await f.card._export('all');for(let i=0;i<8;i++)await Promise.resolve();dialog=f.card.shadowRoot.querySelector('[data-ha-tools-export]').shadowRoot;assert.equal(dialog.querySelector('[data-export=status]').dataset.resultState,'no_data');dialog.querySelector('[data-export=cancel]').click();
  f.card.hass={...f.card._hass,states:{'sensor.a':f.states['sensor.a']}};
  f.card._updateStats();assert.equal(f.card.shadowRoot.getElementById('exportBtn').textContent,'Preview and save');assert.match(f.card.shadowRoot.getElementById('selectionScope').textContent,/Selected: 1/);
 }finally{f.dom.window.close();}
});
test('standalone Settings exposes translated guidance without losing export choices',()=>{
 const f=fixture();try{
  const button=f.card.shadowRoot.getElementById('deGoSettingsBtn');
  button.click();const info=f.card.shadowRoot.getElementById('settingsInfo');
  assert.ok(info);assert.equal(info.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');
  assert.match(info.textContent,/Edit dashboard/);
  f.card.hass={...f.card._hass,language:'pl',user:{id:'qa',is_admin:false}};
  assert.match(info.textContent,/administratora/);
  button.click();assert.equal(info.hidden,true);
 }finally{f.dom.window.close();}
});
