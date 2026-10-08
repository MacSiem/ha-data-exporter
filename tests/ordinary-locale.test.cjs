const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
function fixture() {
  const dom = new JSDOM('', {runScripts:'dangerously',url:'http://qa.invalid/',virtualConsole:new VirtualConsole()});
  dom.window.eval(fs.readFileSync('ha-data-exporter.js','utf8'));
  const reads=[];
  const hass={language:'en',user:{is_admin:true},themes:{},states:{'sensor.qa':{state:'7',attributes:{friendly_name:'QA sensor'},last_changed:'2026-10-03T00:00:00Z'}},callWS:async m=>{reads.push(m);throw Error('No export or history reads allowed');}};
  function card(language='en') { const c=dom.window.document.createElement('ha-data-exporter');c.setConfig({show_support:false});dom.window.document.body.append(c);c.hass={...hass,language};return c; }
  return {dom,hass,reads,card};
}

test('ordinary language update refreshes existing translated snapshot and attribute controls immediately',()=>{
  const f=fixture(),c=f.card();
  try {
    assert.equal(c.shadowRoot.querySelector('#snapshotNow').getAttribute('aria-label'),'Take snapshot now');
    c.hass={...f.hass,language:'pl'};
    assert.equal(c.shadowRoot.querySelector('#snapshotNow').getAttribute('aria-label'),'Zrób snapshot teraz');
    assert.equal(c.shadowRoot.querySelector('#snapshotClear').getAttribute('aria-label'),'Wyczyść snapshoty');
    assert.match(c.shadowRoot.querySelector('#includeAttrs').parentElement.textContent,/Atrybuty/);
    assert.equal(c.shadowRoot.querySelector('#snapshotInterval option[value="300"]').textContent,'co 5 min');
    assert.match(c.shadowRoot.querySelector('#snapshotStatus').textContent,/zapisanych/);
    assert.equal(f.reads.length,0);
  } finally {f.dom.window.close();}
});

test('language roundtrip retains export selection, format, attribute choice and focused search DOM',()=>{
  const f=fixture(),c=f.card();
  try {
    const root=c.shadowRoot,search=root.querySelector('#searchFilter');
    search.value='sensor.qa';search.dispatchEvent(new f.dom.window.Event('input'));
    const cb=root.querySelector('[data-entity="sensor.qa"]');cb.checked=true;cb.dispatchEvent(new f.dom.window.Event('change'));
    root.querySelector('#formatSelect').value='json';
    const attrs=root.querySelector('#includeAttrs');attrs.checked=false;attrs.dispatchEvent(new f.dom.window.Event('change'));
    const interval=root.querySelector('#snapshotInterval');interval.value='900';interval.dispatchEvent(new f.dom.window.Event('change'));
    search.focus();search.setSelectionRange(1,6,'backward');
    for (const language of ['pl','en']) {
      c.hass={...f.hass,language};
      assert.equal(root.querySelector('#searchFilter'),search);assert.equal(root.activeElement,search);
      assert.equal(search.value,'sensor.qa');assert.equal(search.selectionStart,1);assert.equal(search.selectionEnd,6);assert.equal(search.selectionDirection,'backward');
      assert.equal(root.querySelector('#formatSelect').value,'json');assert.equal(root.querySelector('#includeAttrs').checked,false);
      assert.equal(root.querySelector('#snapshotInterval').value,'900');assert.deepEqual(Array.from(c._selectedEntities),['sensor.qa']);
      assert.equal(c._includeAttrsInExport,false);
      assert.equal(root.querySelector('#snapshotNow').getAttribute('aria-label'),language==='pl'?'Zrób snapshot teraz':'Take snapshot now');
    }
    assert.equal(f.reads.length,0);
  } finally {f.dom.window.close();}
});

test('two cards keep independent languages without export or history reads',()=>{
  const f=fixture(),first=f.card('en'),second=f.card('pl');
  try {
    first.hass={...f.hass,language:'pl'};second.hass={...f.hass,language:'en'};
    assert.equal(first.shadowRoot.querySelector('#snapshotNow').getAttribute('aria-label'),'Zrób snapshot teraz');
    assert.equal(second.shadowRoot.querySelector('#snapshotNow').getAttribute('aria-label'),'Take snapshot now');
    assert.equal(f.reads.length,0);
  } finally {f.dom.window.close();}
});


test('ordinary language updates refresh the already translated settings navigation button',()=>{
  const f=fixture(),c=f.card();
  try {
    c.hass={...f.hass,language:'pl'};
    assert.match(c.shadowRoot.querySelector('#deGoSettingsBtn').textContent,/Ustawienia/);
    c.hass={...f.hass,language:'en'};
    assert.match(c.shadowRoot.querySelector('#deGoSettingsBtn').textContent,/Settings/);
    assert.equal(f.reads.length,0);
  } finally {f.dom.window.close();}
});

test('language updates set the checkbox accessible label explicitly to avoid a cached old browser name',()=>{
  const f=fixture(),c=f.card();
  try {
    c.hass={...f.hass,language:'pl'};
    assert.equal(c.shadowRoot.querySelector('#includeAttrs').getAttribute('aria-label'),'Atrybuty');
    c.hass={...f.hass,language:'en'};
    assert.equal(c.shadowRoot.querySelector('#includeAttrs').getAttribute('aria-label'),'Attributes');
    assert.equal(f.reads.length,0);
  } finally {f.dom.window.close();}
});


test('the populated table and export toolbar follow Polish and English without dropping selection or focused search',()=>{
 const f=fixture(),c=f.card();
 try {
  const root=c.shadowRoot,search=root.querySelector('#searchFilter');
  search.value='sensor.qa';search.dispatchEvent(new f.dom.window.Event('input'));search.focus();
  const cb=root.querySelector('[data-entity="sensor.qa"]');cb.checked=true;cb.dispatchEvent(new f.dom.window.Event('change'));
  c.hass={...f.hass,language:'pl'};
  assert.equal(root.querySelector('#exportAllBtn').textContent,'Eksportuj wszystko');
  assert.equal(root.querySelector('#exportBtn').textContent,'Eksportuj wybrane (1)');
  assert.equal(search.placeholder,'Szukaj encji...');
  assert.equal(root.querySelector('th[data-sort="name"]').textContent.trim(),'Nazwa');
  assert.match(root.querySelector('#domainFilter option[value="all"]').textContent,/Wszystkie domeny/);
  assert.match(root.querySelector('#stats').textContent,/1 encji/);
  assert.equal(root.activeElement,search);assert.equal(search.value,'sensor.qa');
  c.hass={...f.hass,language:'en'};
  assert.equal(root.querySelector('#exportAllBtn').textContent,'Export All');
  assert.equal(root.querySelector('#exportBtn').textContent,'Export Selected (1)');
  assert.equal(root.querySelector('th[data-sort="name"]').textContent.trim(),'Name');
  assert.equal(root.activeElement,search);assert.equal(f.reads.length,0);
 } finally {f.dom.window.close();}
});
