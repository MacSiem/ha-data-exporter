'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync('ha-data-exporter.js','utf8');
function fixture(config={}){
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://qa.invalid',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 dom.window.eval(source);const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({show_support:false,...config});dom.window.document.body.append(card);
 const hass={user:{id:'alice',is_admin:true},connection:{connected:true},language:'en',themes:{darkMode:false},states:{'sensor.a':{state:'1',attributes:{friendly_name:'Zeta'}},'sensor.b':{state:'2',attributes:{friendly_name:'Alpha'}}}};card.hass=hass;
 return {dom,card,hass,get root(){return card.shadowRoot;},close(){card.remove();dom.window.close();}};
}
test('configured initial records and enabled tabs keep keyboard focus within the visible tabs',()=>{
 const f=fixture({default_tab:'records',tabs:['records']});try{
  assert.equal(f.root.querySelector('#recordsWorkspace').hidden,false);assert.equal(f.root.querySelector('#exportWorkspace').hidden,true);
  assert.equal(f.root.querySelector('#exportTab').hidden,true);
  const tab=f.root.querySelector('#recordsTab');tab.focus();tab.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(f.root.activeElement,tab);assert.equal(f.root.querySelector('#recordsWorkspace').hidden,false);
 }finally{f.close();}
});
test('invalid tab configuration fails before changing the live card and nested config is copied',()=>{
 const f=fixture();try{
  const config={tabs:['export','records'],custom:{name:'keep'}};f.card.setConfig(config);config.tabs.pop();config.custom.name='mutated';
  assert.equal(f.card._config.tabs.length,2);assert.equal(f.card._config.custom.name,'keep');
  for(const bad of [{tabs:[]},{tabs:['missing']},{default_tab:'missing'},{tabs:['export'],default_tab:'records'}])assert.throws(()=>f.card.setConfig(bad),/tab/i);
  assert.equal(f.card._config.custom.name,'keep');
 }finally{f.close();}
});
test('mobile sort chooses the same ordering and preserves selected entities',()=>{
 const f=fixture();try{
  f.card._selectedEntities.add('sensor.a');const select=f.root.querySelector('#mobileSort');assert.ok(select);
  select.value='name:asc';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
  assert.equal(f.card._getFilteredEntities()[0].entity_id,'sensor.b');assert.ok(f.card._selectedEntities.has('sensor.a'));
  assert.equal(f.root.querySelector('th[data-sort=name]').getAttribute('aria-sort'),'ascending');
 }finally{f.close();}
});
test('help is configurable and dismissal belongs to the current HA user',()=>{
 const f=fixture();try{
  const help=f.root.querySelector('details.intro-banner');assert.ok(help);assert.equal(help.open,false);
  f.root.querySelector('.intro-dismiss').click();assert.equal(f.root.querySelector('.intro-banner'),null);
  f.card.hass={...f.hass,user:{id:'bob',is_admin:true}};assert.ok(f.root.querySelector('.intro-banner'));
  f.card.hass=f.hass;assert.equal(f.root.querySelector('.intro-banner'),null);
  f.card.setConfig({show_help:false});assert.equal(f.root.querySelector('.intro-banner'),null);
 }finally{f.close();}
});
test('reloading the card resource does not duplicate its picker entry',()=>{
 const f=fixture();try{f.dom.window.eval(source);assert.equal(f.dom.window.customCards.filter(c=>c.type==='ha-data-exporter').length,1);}finally{f.close();}
});
test('HA dark mode and current primary color drive the active consumer',()=>{
 const f=fixture();try{
  f.card.style.setProperty('--primary-color','#ffff00');f.card.style.setProperty('--card-background-color','#ffffff');
  f.card.hass={...f.hass,themes:{darkMode:true}};
  assert.equal(f.card.classList.contains('bento-dark'),true);
  assert.equal(f.card.style.getPropertyValue('--hat-primary-fill-computed'),'#ffff00');
  assert.equal(f.card.style.getPropertyValue('--hat-on-primary-computed'),'#0f172a');
 }finally{f.close();}
});
test('visual editor publishes supported view options without mutating its input or losing foreign options',()=>{
 const f=fixture();try{
  const editor=f.dom.window.document.createElement('ha-data-exporter-editor');
  const original={type:'custom:ha-data-exporter',custom:{keep:7},tabs:['export','records']};
  editor.setConfig(original);editor.hass=f.hass;f.dom.window.document.body.append(editor);let emitted;
  editor.addEventListener('config-changed',event=>emitted=event.detail.config);
  const change=(id,value)=>{const node=editor.shadowRoot.getElementById(id);assert.ok(node,id);if(node.type==='checkbox')node.checked=value;else node.value=value;node.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));};
  change('cf_default_tab','records');assert.equal(emitted.default_tab,'records');assert.equal(emitted.custom.keep,7);
  change('cf_tab_records',false);assert.deepEqual([...emitted.tabs],['export']);assert.equal(emitted.default_tab,'export');
  change('cf_tab_export',false);assert.deepEqual([...emitted.tabs],['export']);assert.match(editor.shadowRoot.querySelector('#editorError').textContent,/one tab/);
  change('cf_show_help',false);assert.equal(emitted.show_help,false);
  change('cf_show_support',false);assert.equal(emitted.show_support,false);
  assert.deepEqual(original,{type:'custom:ha-data-exporter',custom:{keep:7},tabs:['export','records']});
 }finally{f.close();}
});
