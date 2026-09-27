const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

function exporter() {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://localhost/' });
  dom.window.eval(readFileSync(join(__dirname, '..', 'ha-data-exporter.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-data-exporter');
  card._includeAttrsInExport = true;
  return { card, dom };
}

test('CSV export keeps untrusted cell text inert in a spreadsheet', () => {
  const { card, dom } = exporter();
  try {
    const row = {
      entity_id: 'sensor.test', friendly_name: '=HYPERLINK("https://example.test")',
      state: '\t=1+1', domain: 'sensor', last_changed: '2026-09-27T00:00:00Z',
      attributes: { note: '+SUM(1,1)', harmless: 'room, kitchen', negative_number: -7 },
    };
    const csv = card._toCSV([row]);
    assert.equal(csv, 'entity_id,friendly_name,state,domain,last_changed,device_id,device_name,area_id,area_name,harmless,negative_number,note\n' +
      'sensor.test,"\'=HYPERLINK(""https://example.test"")","\'\t=1+1",sensor,2026-09-27T00:00:00Z,,,,,"room, kitchen",-7,"\'+SUM(1,1)"');
  } finally {
    dom.window.close();
  }
});

test('export joins entity, device and area registries with entity area precedence', async () => {
  const { card, dom } = exporter();
  try {
    const calls = [];
    const registries = {
      'config/entity_registry/list': [
        { entity_id: 'sensor.lamp', device_id: 'dev1', area_id: 'living' },
        { entity_id: 'sensor.battery', device_id: 'dev1', area_id: null },
      ],
      'config/device_registry/list': [{ id: 'dev1', name: 'Lamp', name_by_user: 'Desk Lamp', area_id: 'office' }],
      'config/area_registry/list': [
        { area_id: 'living', name: 'Living Room' }, { area_id: 'office', name: 'Office' },
      ],
    };
    card._hass = {
      callWS: async ({ type }) => { calls.push(type); return registries[type]; },
      states: {
        'sensor.lamp': { state: 'on', last_changed: 'now', attributes: { friendly_name: 'Lamp' } },
        'sensor.battery': { state: '80', last_changed: 'now', attributes: {} },
        'sensor.orphan': { state: 'unknown', last_changed: 'now', attributes: {} },
      },
    };
    const metadata = await card._loadRegistryMetadata();
    const rows = card._buildExportData(card._getFilteredEntities(), metadata);
    assert.deepEqual(Array.from(calls).sort(), Object.keys(registries).sort());
    assert.deepEqual(Array.from(rows, row => ({
      entity_id: row.entity_id, device_id: row.device_id, device_name: row.device_name,
      area_id: row.area_id, area_name: row.area_name,
    })), [
      { entity_id: 'sensor.battery', device_id: 'dev1', device_name: 'Desk Lamp', area_id: 'office', area_name: 'Office' },
      { entity_id: 'sensor.lamp', device_id: 'dev1', device_name: 'Desk Lamp', area_id: 'living', area_name: 'Living Room' },
      { entity_id: 'sensor.orphan', device_id: '', device_name: '', area_id: '', area_name: '' },
    ]);
  } finally {
    dom.window.close();
  }
});

test('YAML export quotes entity names and states without changing document structure', () => {
  const { card, dom } = exporter();
  try {
    const yaml = card._toYAML([{
      entity_id: 'sensor.test', friendly_name: 'First "sensor"\n- injected: yes',
      state: 'line\nbreak', domain: 'sensor', last_changed: 'now',
      device_id: '', device_name: '', area_id: '', area_name: '', attributes: {},
    }]);
    assert.equal(yaml, '- entity_id: "sensor.test"\n' +
      '  friendly_name: "First \\"sensor\\"\\n- injected: yes"\n' +
      '  state: "line\\nbreak"\n' +
      '  domain: "sensor"\n' +
      '  last_changed: "now"\n' +
      '  device_id: ""\n  device_name: ""\n  area_id: ""\n  area_name: ""\n');
  } finally {
    dom.window.close();
  }
});
