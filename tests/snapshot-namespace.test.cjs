const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('ha-data-exporter.js','utf8');
test('configured snapshot namespace restores its own data instead of default data',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost/'});
 try {
  const storage=dom.window.localStorage;
  storage.setItem('ha-data-exporter-snapshots-default',JSON.stringify([{ts:'default',entities:{}}]));
  storage.setItem('ha-data-exporter-snapshots-bedroom',JSON.stringify([{ts:'bedroom',entities:{}}]));
  storage.setItem('ha-data-exporter-settings-default',JSON.stringify({enabled:true,interval:30,maxSnapshots:20}));
  storage.setItem('ha-data-exporter-settings-bedroom',JSON.stringify({enabled:false,interval:900,maxSnapshots:100}));
  dom.window.eval(source);
  const card=dom.window.document.createElement('ha-data-exporter');
  card.setConfig({storage_key:'bedroom'});
  assert.equal(card._snapshots[0]?.ts,'bedroom');
  assert.equal(card._snapshotSettings.interval,900);
  assert.equal(card._snapshotSettings.enabled,false);
 } finally {dom.window.close();}
});


test('changing the namespace starts empty when absent and never copies old snapshots to the new key',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously',url:'http://localhost/'});
 try {
  dom.window.eval(source);
  const card=dom.window.document.createElement('ha-data-exporter');
  card.setConfig({storage_key:'bedroom'});
  card._hass={states:{'sensor.qa':{state:'17',attributes:{}}}};
  card._snapshotSettings.interval=900;card._saveSnapshotSettings();card._takeSnapshot();
  const before=dom.window.localStorage.getItem('ha-data-exporter-snapshots-bedroom');
  card._hass=null;card.setConfig({storage_key:'living_room'});
  assert.equal(card._getEntityHistory('sensor.qa').length,0);
  assert.equal(card._snapshotSettings.interval,60);
  card._hass={states:{'sensor.qa':{state:'18',attributes:{}}}};card._takeSnapshot();
  assert.equal(dom.window.localStorage.getItem('ha-data-exporter-snapshots-bedroom'),before);
  const living=JSON.parse(dom.window.localStorage.getItem('ha-data-exporter-snapshots-living_room'));
  assert.deepEqual(living.map(s=>s.entities['sensor.qa'].state),['18']);
 } finally {dom.window.close();}
});
