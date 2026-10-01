const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

function fixture() {
  const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/ha-data-exporter' });
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-data-exporter.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-data-exporter');
  card._hass = { states: {}, user: { is_admin: false } };
  return { dom, card };
}

test('sidebar shows its title without a Lovelace setConfig call', () => {
  const { dom, card } = fixture();
  try {
    card._render();
    assert.equal(card.shadowRoot.querySelector('h2').textContent, 'Data Exporter');
  } finally { dom.window.close(); }
});

test('Lovelace card keeps its configured title', () => {
  const { dom, card } = fixture();
  try {
    card.setConfig({ title: 'QA export title' });
    card._render();
    assert.equal(card.shadowRoot.querySelector('h2').textContent, 'QA export title');
  } finally { dom.window.close(); }
});
