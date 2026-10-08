const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('documented export options choose JSON, exclude attributes and hide bulk selection',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost/'});
 try {
  dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
  const card=dom.window.document.createElement('ha-data-exporter');
  card.setConfig({default_format:'json',show_attributes:false,show_select_all:false,show_support:false});dom.window.document.body.append(card);
  card.hass={language:'en',themes:{},states:{'sensor.qa':{state:'17',attributes:{secret:'omit',friendly_name:'QA'}}}};
  assert.equal(card.shadowRoot.querySelector('#formatSelect').value,'json');
  assert.equal(card.shadowRoot.querySelector('#includeAttrs').checked,false);
  const metadata={entities:new Map(),devices:new Map(),areas:new Map()};
  assert.equal('attributes' in card._buildExportData(card._getFilteredEntities(),metadata)[0],false);
  assert.equal(card.shadowRoot.querySelector('#selectAll').hidden,true);
 } finally {dom.window.close();}
});
