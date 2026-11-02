'use strict';
// Synthetic HA only. Native browser Blob/URL/anchor methods are never replaced.
const send = value => window.webkit.messageHandlers.harness.postMessage(value);
const check = (ok, message) => { if (!ok) throw Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 25));
const card = document.createElement('ha-data-exporter');
card.setConfig({show_support: false});
document.body.append(card);
const states = {
  'sensor.zero': {state: '0', last_changed: '2026-10-12T00:00:00Z', attributes: {friendly_name: 'Temperature', unit_of_measurement: '°C', device_class: 'temperature', temperature: 0}},
  'sensor.background': {state: '10', attributes: {friendly_name: 'Background', unit_of_measurement: '°C', device_class: 'temperature'}}
};
const hass = {language: 'en', user: {id: 'synthetic-user', is_admin: false}, states,
  connection: {connected: true, addEventListener() {}, removeEventListener() {}},
  callWS: async () => { throw Error('Synthetic registry denied'); }};
card.hass = hass;
const root = card.shadowRoot;
const dialog = () => root.querySelector('[data-ha-tools-export]')?.shadowRoot;
const node = key => dialog()?.querySelector(`[data-export="${key}"]`);
window.prepareFormat = async format => {
  try {
    node('cancel')?.click();
    root.querySelector('#formatSelect').value = format;
    root.querySelector('#previewMode').value = 'all';
    card._updateStats();
    root.querySelector('#exportBtn').click();
    for (let i = 0; i < 200 && (!node('preview')?.textContent || node('save')?.disabled); i++) await pause();
    check(dialog()?.querySelector('dialog')?.open, 'Real export dialog is not open');
    const preview = node('preview').textContent;
    check(preview.length > 0 && !node('save').disabled, 'Preview not ready');
    // Change an exported sensor AFTER review: Save must retain reviewed bytes.
    states['sensor.zero'] = {...states['sensor.zero'], state: String(Number(states['sensor.zero'].state) + 1)};
    card.hass = {...hass, states: {...states}};
    await pause();
    const saveEnabledAfterMutation = !node('save').disabled;
    check(saveEnabledAfterMutation, 'Save disabled after synthetic sensor update');
    check(node('preview').textContent === preview, 'Review changed after synthetic sensor update');
    send({type: 'ready', format, filename: node('filename').value, preview, saveEnabledAfterMutation, dialogOpen: true});
  } catch (error) { send({type: 'error', message: String(error)}); }
};
window.saveReviewed = () => {
  try { check(!node('save').disabled, 'Save disabled at handoff'); node('save').click(); }
  catch (error) { send({type: 'error', message: String(error)}); }
};
window.addEventListener('error', event => send({type: 'error', message: event.message}));
send({type: 'loaded'});
