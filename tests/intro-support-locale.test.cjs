const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
function fixture() {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
  dom.window.eval(fs.readFileSync('ha-data-exporter.js', 'utf8'));
  const reads = [];
  const hass = { language: 'en', user: { is_admin: true }, themes: {}, states: {
    'sensor.qa': { state: '7', attributes: { friendly_name: 'QA sensor' }, last_changed: '2026-10-03T00:00:00Z' }
  }, callWS: async m => { reads.push(m); throw Error('No export/history reads allowed'); } };
  function card(language = 'en') {
    const c = dom.window.document.createElement('ha-data-exporter');
    c.setConfig({ show_support: true }); dom.window.document.body.append(c); c.hass = { ...hass, language }; return c;
  }
  return { dom, hass, reads, card };
}

test('ordinary first-run locale roundtrip preserves focused search, full selection and export choices in place', () => {
  const f = fixture(), c = f.card();
  try {
    const root = c.shadowRoot, search = root.querySelector('#searchFilter');
    search.value = 'sensor.qa'; search.dispatchEvent(new f.dom.window.Event('input'));
    const selected = root.querySelector('[data-entity="sensor.qa"]'); selected.checked = true; selected.dispatchEvent(new f.dom.window.Event('change'));
    root.querySelector('#formatSelect').value = 'json';
    const attrs = root.querySelector('#includeAttrs'); attrs.checked = false; attrs.dispatchEvent(new f.dom.window.Event('change'));
    search.focus(); search.setSelectionRange(0, search.value.length, 'backward');
    for (const language of ['pl-PL', 'en']) {
      c.hass = { ...f.hass, language };
      const intro = root.querySelector('.intro-banner'), pl = language.startsWith('pl');
      assert.match(intro.querySelector('.intro-headline').textContent, pl ? /dane encji/ : /entity data/);
      assert.equal(intro.querySelectorAll('li').length, 3);
      assert.match(intro.querySelectorAll('li')[1].textContent, pl ? /snapshot|migawk/ : /snapshot/);
      assert.equal(intro.querySelector('.intro-dismiss').getAttribute('aria-label'), pl ? 'Ukryj instrukcję' : 'Dismiss');
      assert.equal(root.querySelector('#searchFilter'), search); assert.equal(root.activeElement, search);
      assert.equal(search.value, 'sensor.qa'); assert.equal(search.selectionStart, 0); assert.equal(search.selectionEnd, search.value.length); assert.equal(search.selectionDirection, 'backward');
      assert.equal(root.querySelector('#formatSelect').value, 'json'); assert.equal(root.querySelector('#includeAttrs').checked, false);
      assert.deepEqual(Array.from(c._selectedEntities), ['sensor.qa']); assert.equal(c._includeAttrsInExport, false);
    }
    assert.equal(f.reads.length, 0);
  } finally { f.dom.window.close(); }
});

test('initial Polish and English cards show their own first-run and support language', () => {
  const f = fixture(), pl = f.card('pl'), en = f.card('en');
  try {
    assert.match(pl.shadowRoot.querySelector('.intro-banner').textContent, /dane encji/);
    assert.match(pl.shadowRoot.querySelector('.donate-section a').textContent, /Dobrowolne wsparcie/);
    assert.equal(pl.shadowRoot.querySelector('.support-dismiss').getAttribute('aria-label'), 'Ukryj link wsparcia');
    assert.match(en.shadowRoot.querySelector('.intro-banner').textContent, /entity data/);
    assert.match(en.shadowRoot.querySelector('.donate-section a').textContent, /Optional support/);
    assert.equal(en.shadowRoot.querySelector('.donate-section a').href, 'https://buymeacoffee.com/macsiem');
    assert.equal(en.shadowRoot.querySelector('.donate-section a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(f.reads.length, 0);
  } finally { f.dom.window.close(); }
});

test('dismissed first-run and support are not recreated by a locale update', () => {
  const f = fixture(), c = f.card();
  try {
    c.shadowRoot.querySelector('.intro-dismiss').click(); c.shadowRoot.querySelector('.support-dismiss').click();
    for (const language of ['pl', 'en']) {
      c.hass = { ...f.hass, language };
      assert.equal(c.shadowRoot.querySelector('.intro-banner'), null);
      assert.equal(c.shadowRoot.querySelector('.donate-section[data-source="own-card"]'), null);
    }
    assert.equal(f.reads.length, 0);
  } finally { f.dom.window.close(); }
});
