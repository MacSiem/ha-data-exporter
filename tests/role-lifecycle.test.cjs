const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
function fixture(){
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost/'});
 dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
 const card=dom.window.document.createElement('ha-data-exporter');card.setConfig({show_support:true});dom.window.document.body.append(card);
 const hass={language:'en',user:{id:'admin',is_admin:true},themes:{},states:{'sensor.qa':{state:'17',attributes:{}}}};
 card.hass=hass;return {dom,card,hass};
}
test('support follows admin to household to unknown to admin without a language change',()=>{
 const f=fixture();try{
  assert.ok(f.card.shadowRoot.querySelector('.donate-section'));
  for(const user of [{id:'household',is_admin:false},null]){
   f.card.hass={...f.hass,user};assert.equal(f.card.shadowRoot.querySelector('.donate-section'),null);
  }
  f.card.hass=f.hass;assert.ok(f.card.shadowRoot.querySelector('.donate-section'));
 }finally{f.dom.window.close();}
});
test('an export awaiting registry metadata is cancelled after account replacement',async()=>{
 const f=fixture();try{
  const pending=[];let downloads=0;
  f.dom.window.confirm=()=>true;
  f.dom.window.URL.createObjectURL=()=>{downloads++;return 'blob:qa';};f.dom.window.URL.revokeObjectURL=()=>{};
  f.card.hass={...f.hass,callWS:()=>new Promise(resolve=>pending.push(resolve))};
  const operation=f.card._export('all');assert.equal(pending.length,3);
  f.card.hass={...f.hass,user:{id:'household',is_admin:false},states:{}};
  pending.forEach(resolve=>resolve([]));await operation;
  assert.equal(downloads,0);
 }finally{f.dom.window.close();}
});
