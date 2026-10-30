/* HA Tools split — ha-data-exporter v4.3.1 (2026-10-30) — single-tool standalone repo */
(function() {
'use strict';

// BEGIN VENDORED ha-tools-format.js
// Localized presentation; raw values remain available to callers for details/export.
function createFormatUi(language = 'en', timeZone = 'UTC', preferences = {}) {
  const hourCycle = preferences.hourCycle || 'h23';
  const dateLanguage = preferences.dateLanguage || language;
  const stamp = value => typeof value === 'number' ? (Number.isFinite(value) ? value : NaN) : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  const localized = (value, options, locale = language) => {
    const time = stamp(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(locale, {timeZone, ...options}).format(time); } catch (_) { return null; }
  };
  const clock = (value, withOffset = false) => localized(value, {hour:'2-digit', minute:'2-digit', hourCycle, ...(withOffset ? {timeZoneName:'shortOffset'} : {})});
  const date = (value, short = false) => localized(value, {day:'numeric', month:'short', ...(short ? {} : {year:'numeric'})}, dateLanguage);
  const pointLabel = (value, precise = false) => localized(value, {...(precise ? {second:"2-digit"} : {}), year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle, timeZoneName:'shortOffset'}, dateLanguage);
  const chartLabels = (values, resolution = 'hour') => {
    const showDate = resolution === 'day' || values.length > 1 && stamp(values.at(-1)) - stamp(values[0]) >= 86400000;
    const labels = values.map(value => resolution === 'day' ? date(value, true) : `${showDate ? date(value, true) + ' ' : ''}${clock(value)}`);
    const counts = new Map();
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    return labels.map((label, index) => counts.get(label) < 2 ? label : resolution === 'day' ? pointLabel(values[index])
      : `${showDate ? date(values[index], true) + ' ' : ''}${clock(values[index], true)}`);
  };
  const key = JSON.stringify([language, timeZone, hourCycle, dateLanguage]);
  const numbers = new Intl.NumberFormat(language);
  const plurals = new Intl.PluralRules(language);
  const count = (value, forms) => `${numbers.format(value)} ${forms[plurals.select(value)] || forms.other}`;
  const dateTime = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium', timeStyle:'short', hourCycle}).format(new Date(time)); }
    catch (_) { return null; }
  };
  const range = (from, to) => {
    const first = Date.parse(from), last = Date.parse(to);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return null;
    try {
      const day = new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium'});
      const clock = new Intl.DateTimeFormat(language, {timeZone, hour:'2-digit', minute:'2-digit', hourCycle});
      return day.format(first) === day.format(last)
        ? `${day.format(first)} (${clock.format(first)}–${clock.format(last)})`
        : `${dateTime(from)} – ${dateTime(to)}`;
    } catch (_) { return null; }
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const periodMarkup = ({start, end, label, source, measured, expected, unit, details = '', sourceTimeZone = ''}) => {
    const local = range(start, end);
    if (!local) return '';
    const coverage = typeof measured === 'number' && Number.isFinite(measured) && typeof expected === 'number' && Number.isFinite(expected)
      ? `${numbers.format(measured)}/${numbers.format(expected)} ${unit}` : '';
    const pl = String(language).startsWith('pl');
    return `<div class="energy-period-v4" style="overflow-wrap:anywhere"><p data-energy-period-summary>${[source, label, local, coverage, timeZone].filter(Boolean).map(escape).join(' · ')}</p><details data-energy-period-details data-energy-period-key="${escape(start + '|' + end)}"><summary style="min-height:44px;box-sizing:border-box;padding:12px 0;display:list-item;list-style-position:inside;cursor:pointer">${pl ? 'Źródło i szczegóły czasu' : 'Source and time details'}</summary><p>${escape(details)}</p>${sourceTimeZone && sourceTimeZone !== timeZone ? `<p>${escape(pl ? 'Strefa pomiarów i granic okresu' : 'Measurement calendar time zone')}: ${escape(sourceTimeZone)}</p>` : ''}<p>UTC: ${escape(start)} — ${escape(end)}</p></details></div>`;
  };
  const capturePeriods = (root, previous, current) => {
    if (!previous || ['epoch','connection','user'].some(key => previous[key] !== current[key])) return [];
    return [...root.querySelectorAll('[data-energy-period-key]')].map(element => ({
      key:element.dataset.energyPeriodKey, open:element.open, focused:root.activeElement === element.querySelector('summary')
    }));
  };
  const restorePeriods = (root, records) => {
    for (const element of root.querySelectorAll('[data-energy-period-key]')) {
      const record = records.find(row => row.key === element.dataset.energyPeriodKey);
      if (!record) continue;
      element.open = record.open;
      if (record.focused) element.querySelector('summary')?.focus({preventScroll:true});
    }
  };
  return {timeZone, key, clock, date, pointLabel, chartLabels, number:(value, options)=>options ? new Intl.NumberFormat(language, options).format(value) : numbers.format(value), count, dateTime, range, periodMarkup, capturePeriods, restorePeriods};
}
// Presentation follows the HA profile; measurement and tariff calendars remain separate.
createFormatUi.forHass = hass => {
  const locale = hass?.locale || {};
  const systemLanguage = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const language = locale.language || hass?.language || systemLanguage || 'en';
  const validZone = value => {
    if (typeof value !== 'string' || !(value === 'UTC' || value.includes('/')) || /^[+-]/.test(value)) return null;
    try { new Intl.DateTimeFormat('en', {timeZone:value}).format(0); return value; } catch (_) { return null; }
  };
  let systemZone;
  try { systemZone = validZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (_) {}
  const serverZone = validZone(hass?.config?.time_zone);
  const timeZone = (locale.time_zone === 'server' ? serverZone : systemZone) || serverZone || 'UTC';
  const clockLanguage = locale.time_format === 'system' ? systemLanguage || language : language;
  const hourCycle = locale.time_format === '12' ? 'h12' : locale.time_format === '24' ? 'h23'
    : new Intl.DateTimeFormat(clockLanguage, {hour:'numeric'}).resolvedOptions().hourCycle;
  return createFormatUi(language, timeZone, {hourCycle, dateLanguage:locale.date_format === 'system' ? systemLanguage || language : language});
};
// END VENDORED ha-tools-format.js

// BEGIN VENDORED ha-tools-export.js
/**
 * W6 export dialog. Pure ES module; vendor this factory INSIDE each consumer's
 * own IIFE (remove only the `export` keyword). Never attach it to window.
 * Construction is inert. open() appends only its own container to root.
 *
 * Required dependency injection:
 * root: Element/ShadowRoot; getLanguage(): 'pl'|'en'; createUiV3: existing W4 factory.
 * getContext(): {role,userId,connectionId,datasetId,revision,connected,canExport,
 *                sourceConfirmed}. Identities/revision are nonempty scalar values;
 * bump revision monotonically for source/filter/selection/identity changes,
 * including a restored source; never reuse an old revision. Never return tokens or data.
 * policy: {id,allowlistedFields:string[],neverInclude:[tokens,users,addresses,raw_config]}.
 * formats: explicit subset of ['json','csv','txt']; defaults must be explicit valid choices.
 * buildPayload({context,draft,policy,signal}): read-only, Promise or sync result:
 * {serialized:string,confirmed:true,sourceConfirmed:true,status:'success'|'partial',
 *  included:string[],excluded:string[],sourceLimit:string}.
 * Included/Excluded/sourceLimit describe the REVIEWED CONSUMER policy and actual
 * source limitations in the current language. The consumer MUST explicitly select
 * allowed fields, exclude tokens/users/addresses/raw configuration under EVERY
 * private opt-in, and sanitize CSV formula cells where applicable. A generic
 * recursive export/redactor of arbitrary raw state/config is NOT a valid consumer.
 * This factory cannot inspect or truthfully sanitize an unknown arbitrary schema.
 * For partial reports the consumer also encodes the partial status, inclusion
 * scope and source limitations IN its allowlisted file schema, not only UI text.
 * performDownload({serialized,blob,filename,format,context,signal}): explicit Save
 * only. Return {outcome:'initiated'|'saved'|'unknown'}; 'saved' requires actual
 * adapter confirmation, never infer disk persistence from an anchor click.
 * Optional clock(): monotonic milliseconds; setTimer(fn,ms), clearTimer(handle).
 *
 * Returned API: open({opener}), cancel(), contextChanged(), destroy(). Every open
 * resets private consent. contextChanged() discards bytes/consent immediately;
 * owner also calls cancel/destroy on disconnect. Save ALWAYS rechecks context.
 * One preview on open, explicit Refresh thereafter; bounded 10s, no automatic
 * retries/downloads/persistence. AbortSignal is advisory; late results are ignored.
 */
function createExportDialog(options) {
  const { root, getContext, getLanguage, createUiV3, buildPayload, performDownload,
    clock = () => globalThis.performance.now(), setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer = id => globalThis.clearTimeout(id), defaultFormat, defaultFilename } = options || {};
  const allowedFormats = ['json', 'csv', 'txt', 'yaml'];
  const excludedCategories = ['tokens', 'users', 'addresses', 'raw_config'];
  const strings = value => Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && v.trim());
  if (!root?.append || !root.ownerDocument || [getContext, getLanguage, createUiV3, buildPayload, performDownload, clock, setTimer, clearTimer].some(fn => typeof fn !== 'function')) {
    throw new TypeError('root and injected getContext/getLanguage/createUiV3/buildPayload/performDownload/clock/timers are required');
  }
  const suppliedPolicy = options.policy;
  if (!suppliedPolicy || typeof suppliedPolicy.id !== 'string' || !suppliedPolicy.id.trim() || !strings(suppliedPolicy.allowlistedFields) || !strings(suppliedPolicy.neverInclude) || excludedCategories.some(key => !suppliedPolicy.neverInclude.includes(key))) {
    throw new TypeError('Explicit reviewed consumer policy with allowlistedFields and neverInclude is required');
  }
  const policy = Object.freeze({ id: suppliedPolicy.id, allowlistedFields: Object.freeze([...suppliedPolicy.allowlistedFields]), neverInclude: Object.freeze([...suppliedPolicy.neverInclude]) });
  if (!strings(options.formats) || options.formats.some(f => !allowedFormats.includes(f)) || new Set(options.formats).size !== options.formats.length || !options.formats.includes(defaultFormat) || typeof defaultFilename !== 'string') {
    throw new TypeError('Explicit formats/defaultFormat/defaultFilename are required');
  }
  const formats = Object.freeze([...options.formats]);
  const doc = root.ownerDocument;
  const mime = { json: 'application/json;charset=utf-8', csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8', yaml: 'application/yaml;charset=utf-8' };
  const copy = {
    en: { title: 'Export', filename: 'Filename', format: 'Format', private: 'Include reviewed private fields (this export only)', included: 'Included in the file', excluded: 'Excluded from the file', source: 'Source and limits', preview: 'Exact file content', save: 'Save', refresh: 'Refresh preview', cancel: 'Cancel', busy: 'Building preview… Save waits for confirmed bytes.', changed: 'Choices changed. Refresh preview before Save.', context: 'The selected data or your Home Assistant access changed. Choose Refresh preview to review the current data before saving.', unavailable: 'Source unavailable or unconfirmed. Reconnect or confirm the source, then refresh.', invalidFormat: 'Choose an allowed format: JSON, CSV, TXT or YAML as offered.', invalidName: 'Use a basename of 1–128 characters: no paths, control characters, reserved names or leading/trailing spaces.', extension: 'Filename must end with the selected extension. Edit the filename, then refresh.', timeout: 'Preview exceeded 10 seconds. Check the source and explicitly refresh.', buildError: 'Could not build a confirmed preview. Check the source and refresh.', unconfirmed: 'Bytes or source metadata are unconfirmed. Confirm the source and refresh.', noData: 'No confirmed file content. Select available data and refresh.', saving: 'Handing off the confirmed preview… Wait for the adapter result.', initiated: 'Download initiated. Saving to the filesystem is not confirmed. Refresh only for a new export intent.', saved: 'Save confirmed by the download adapter.', unknown: 'Download result unconfirmed. Check the previous attempt before explicitly refreshing for a new export intent.' },
    pl: { title: 'Eksport', filename: 'Nazwa pliku', format: 'Format', private: 'Dołącz sprawdzone pola prywatne (tylko ten eksport)', included: 'W pliku jest', excluded: 'W pliku nie ma', source: 'Źródło i ograniczenia', preview: 'Dokładna zawartość pliku', save: 'Zapisz', refresh: 'Odśwież podgląd', cancel: 'Anuluj', busy: 'Przygotowywanie podglądu… Zapis wymaga potwierdzonej zawartości.', changed: 'Wybór zmieniony. Odśwież podgląd przed zapisem.', context: 'Wybrane dane lub Twój dostęp do Home Assistant zmieniły się. Wybierz Odśwież podgląd, sprawdź aktualne dane i zapisz plik.', unavailable: 'Źródło niedostępne lub niepotwierdzone. Połącz lub potwierdź źródło i odśwież.', invalidFormat: 'Wybierz dostępny format: JSON, CSV, TXT lub YAML z listy.', invalidName: 'Użyj nazwy pliku o długości 1–128 znaków: bez ścieżek, znaków sterujących, nazw zastrzeżonych i skrajnych spacji.', extension: 'Nazwa pliku musi mieć rozszerzenie wybranego formatu. Popraw nazwę i odśwież.', timeout: 'Podgląd przekroczył 10 sekund. Sprawdź źródło i jawnie odśwież.', buildError: 'Nie udało się przygotować potwierdzonego podglądu. Sprawdź źródło i odśwież.', unconfirmed: 'Zawartość lub opis źródła niepotwierdzony. Potwierdź źródło i odśwież.', noData: 'Brak potwierdzonej zawartości pliku. Wybierz dostępne dane i odśwież.', saving: 'Przekazywanie potwierdzonego podglądu… Poczekaj na wynik zapisu.', initiated: 'Pobieranie rozpoczęte. Zapis na dysku nie jest potwierdzony. Odśwież tylko dla nowej próby eksportu.', saved: 'Adapter pobierania potwierdził zapis.', unknown: 'Wynik pobierania niepotwierdzony. Sprawdź poprzednią próbę przed jawnym odświeżeniem dla nowego eksportu.' },
  };
  const css = `
[data-ha-tools-export] { min-width:0;max-width:100%;color:var(--primary-text-color,#1e293b);font:inherit; }
[data-ha-tools-export] * { box-sizing:border-box; }
[data-ha-tools-export] dialog { width:min(520px,calc(100vw - 32px));max-width:none;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);min-width:0;margin:auto;padding:0;border:1px solid var(--divider-color,#e2e8f0);border-radius:18px;background:var(--card-background-color,#fff);color:inherit;font:inherit;box-shadow:0 24px 64px #0f172a33;overflow:hidden; }
[data-ha-tools-export] dialog[open] { display:flex;flex-direction:column; }
[data-ha-tools-export] dialog::backdrop { background:#0f172a66; }
[data-ha-tools-export] .ht-export-body { min-height:0;overflow:auto;overscroll-behavior:contain;padding:24px; }
[data-ha-tools-export] h2,[data-ha-tools-export] h3,[data-ha-tools-export] p,[data-ha-tools-export] li { overflow-wrap:anywhere;white-space:normal; }
[data-ha-tools-export] h2 { margin:0 0 16px;font-size:1.25em;line-height:1.4; }
[data-ha-tools-export] h3 { margin:16px 0 6px;font-size:1em;line-height:1.5; }
[data-ha-tools-export] p { line-height:1.5; }
[data-ha-tools-export] .ht-export-fields { display:grid;grid-template-columns:minmax(0,1fr);gap:12px; }
[data-ha-tools-export] label { display:flex;flex-direction:column;gap:6px;min-width:0;overflow-wrap:anywhere; }
[data-ha-tools-export] .ht-export-format { margin-top:16px; }
[data-ha-tools-export] .ht-export-private { flex-direction:row;align-items:center;min-height:44px;margin-top:12px; }
[data-ha-tools-export] input:not([type=checkbox]),[data-ha-tools-export] select,[data-ha-tools-export] button { font:inherit;min-width:44px;min-height:44px;max-width:100%; }
[data-ha-tools-export] input:not([type=checkbox]),[data-ha-tools-export] select { width:100%;color:inherit;background:var(--ht-export-field-bg,#f8fafc);border:1px solid var(--divider-color,#cbd5e1);border-radius:8px;padding:8px 12px; }
[data-ha-tools-export] input[type=checkbox] { width:24px;height:24px;flex:none;margin:10px; }
[data-ha-tools-export] [data-export-scope] { padding:12px 14px;border-radius:10px;margin-top:14px; }
[data-ha-tools-export] [data-export-scope] h3 { margin:0 0 6px; }
[data-ha-tools-export] [data-export-scope=included] { background:var(--ht-export-included-bg,#ecfdf3);color:var(--ht-export-included-text,#166534); }
[data-ha-tools-export] [data-export-scope=excluded] { background:var(--ht-export-excluded-bg,#fff1f2);color:var(--ht-export-excluded-text,#9f1239); }
[data-ha-tools-export] ul { padding:0;margin:0;list-style:none; }
[data-ha-tools-export] li { display:flex;gap:6px;line-height:1.5; }
[data-ha-tools-export] li + li { margin-top:4px; }
[data-ha-tools-export] [data-export-scope=included] li::before { content:'✓';flex:none; }
[data-ha-tools-export] [data-export-scope=excluded] li::before { content:'×';flex:none; }
[data-ha-tools-export] button { padding:8px 12px;white-space:normal;overflow-wrap:anywhere;cursor:pointer;border:1px solid transparent;border-radius:8px;color:var(--ht-export-accent,#0369a1);background:transparent; }
[data-ha-tools-export] [data-export=save] { color:var(--hat-on-primary-computed,var(--ht-export-save-text,#fff));background:var(--hat-primary-fill-computed,var(--ht-export-accent,#0369a1)); }
[data-ha-tools-export] :focus-visible { outline:3px solid var(--ht-export-accent,#0369a1);outline-offset:2px; }
[data-ha-tools-export] button:disabled { cursor:default;opacity:.6; }
[data-ha-tools-export] .ht-export-actions { display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;flex:none;padding:12px 24px;border-top:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff); }
[data-ha-tools-export] pre { max-width:100%;min-width:0;max-height:260px;overflow:auto;white-space:pre;margin:0;padding:12px;border:1px solid var(--divider-color,#cbd5e1);border-radius:8px;background:var(--ht-export-field-bg,#f8fafc); }
:host(.bento-dark) { --ht-export-field-bg:#0f172a;--ht-export-included-bg:#103827;--ht-export-included-text:#bbf7d0;--ht-export-excluded-bg:#43212a;--ht-export-excluded-text:#fda4af;--ht-export-accent:#7dd3fc;--ht-export-save-text:#0f172a; }
@media (max-width:399px) { [data-ha-tools-export] .ht-export-body { padding:16px; } [data-ha-tools-export] .ht-export-actions { padding:12px 16px;gap:6px; } }
@media (max-width:319px) { [data-ha-tools-export] dialog { width:calc(100vw - 16px); } [data-ha-tools-export] .ht-export-actions button { flex:1 1 auto; } }
`;  let container, nodes, L, ui, opener, alive = false, destroyed = false, serial = 0;
  let pending = null, handoff = null, ready = null, observed = null;
  const listeners = [];
  const on = (target, event, handler, capture = false) => {
    target.addEventListener(event, handler, capture);
    listeners.push(() => target.removeEventListener(event, handler, capture));
  };
  const contextKeys = ['role', 'userId', 'connectionId', 'datasetId', 'revision'];
  function readContext() {
    try {
      const value = getContext();
      if (!value || contextKeys.some(k => !['string', 'number'].includes(typeof value[k]) || String(value[k]).trim() === '' || (typeof value[k] === 'number' && !Number.isFinite(value[k])))) return null;
      return Object.freeze(Object.fromEntries([...contextKeys, 'connected', 'canExport', 'sourceConfirmed'].map(k => [k, value[k]])));
    } catch { return null; }
  }
  const same = (a, b) => !!a && !!b && [...contextKeys, 'connected', 'canExport', 'sourceConfirmed'].every(k => a[k] === b[k]);
  const available = c => !!c && c.connected === true && c.canExport === true && c.sourceConfirmed === true;
  const draft = () => Object.freeze({ filename: nodes.filename.value, format: nodes.format.value, includePrivate: nodes.private.checked });
  const sameDraft = (a, b) => a.filename === b.filename && a.format === b.format && a.includePrivate === b.includePrivate;
  function validation(value) {
    if (!formats.includes(value.format)) return 'invalidFormat';
    const name = value.filename;
    if (!name || [...name].length > 128 || name !== name.trim() || /[\p{Cc}\p{Cf}/\\<>:"|?*]/u.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(name)) return 'invalidName';
    if (!name.endsWith(`.${value.format}`) || name.length <= value.format.length + 1) return 'extension';
    return null;
  }
  function status(code, message) {
    if (!alive) return;
    const result = ui.status(code); // exact existing W4 labels/icons/codes
    nodes.status.className = `ht-result-state ht-result-state--${result.code}`;
    nodes.status.dataset.resultState = result.code;
    nodes.status.replaceChildren();
    const icon = doc.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = result.icon;
    nodes.status.append(icon, doc.createTextNode(` ${result.label}`));
    nodes.message.textContent = ` ${L[message]}`;
    nodes.save.disabled = !ready || !!pending || !!handoff;
    nodes.refresh.disabled = !!pending || !!handoff;
  }
  function stop(job) {
    if (!job) return;
    if (job.timer !== null) clearTimer(job.timer);
    job.timer = null; job.controller.abort();
  }
  function discard(resetPrivate = false) {
    serial++; stop(pending); pending = null; ready = null;
    if (alive) {
      nodes.preview.textContent = ''; nodes.included.replaceChildren(); nodes.excluded.replaceChildren(); nodes['source-limit'].textContent = '';
      if (resetPrivate) nodes.private.checked = false;
    }
  }
  function contextChanged() {
    if (!alive) return;
    observed = readContext(); discard(true);
    // Once a handoff began we cannot retract a browser download. Ignore its late
    // callback and retain the prohibition on a second write until it settles.
    if (handoff) handoff.controller.abort();
    status(root.isConnected && available(observed) ? 'unconfirmed' : 'no_data', 'context');
  }
  function validContext(original) {
    const current = readContext();
    if (!root.isConnected || !same(original, current) || !available(current)) { contextChanged(); return false; }
    return true;
  }
  function changeDraft() {
    if (!alive) return;
    if (!same(observed, readContext())) { contextChanged(); return; }
    discard();
    const error = validation(draft()); status(error ? 'error' : 'not_checked', error || 'changed');
  }
  function fillList(node, items) {
    node.replaceChildren(...items.map(text => { const li = doc.createElement('li'); li.textContent = text; return li; }));
  }
  async function refresh() {
    if (!alive || pending || handoff) return;
    const current = readContext();
    if (!same(observed, current)) { observed = current; discard(true); }
    const value = draft(), error = validation(value);
    discard();
    if (error) { status('error', error); return; }
    if (!root.isConnected || !available(current)) { status(!root.isConnected || current?.connected === false ? 'no_data' : 'unconfirmed', 'unavailable'); return; }
    observed = current;
    const job = { id: serial, context: current, draft: value, started: clock(), controller: new globalThis.AbortController(), timer: null };
    pending = job; status('not_checked', 'busy');
    const timeout = () => {
      if (!alive || pending !== job) return;
      discard(); status('unconfirmed', 'timeout');
    };
    job.timer = setTimer(timeout, 10000);
    try {
      const payload = await buildPayload(Object.freeze({ context: current, draft: value, policy, signal: job.controller.signal }));
      if (!alive || pending !== job || job.id !== serial) return;
      if (clock() - job.started >= 10000) { timeout(); return; }
      if (!validContext(current)) return;
      clearTimer(job.timer); job.timer = null;
      if (!sameDraft(value, draft())) { changeDraft(); return; }
      const { serialized, confirmed, sourceConfirmed, status: resultState, included, excluded, sourceLimit } = payload || {};
      if (resultState === 'no_data' || serialized === '') { pending = null; status('no_data', 'noData'); return; }
      if (confirmed !== true || sourceConfirmed !== true || !['success', 'partial'].includes(resultState) || typeof serialized !== 'string' || !strings(included) || !strings(excluded) || typeof sourceLimit !== 'string' || !sourceLimit.trim()) {
        pending = null; status('unconfirmed', 'unconfirmed'); return;
      }
      // Freeze the only serialized bytes and build the only Blob NOW; Save never
      // re-runs serialization or builds a second payload from potentially newer data.
      ready = Object.freeze({ serialized, blob: new globalThis.Blob([serialized], { type: mime[value.format] }), context: current, draft: value });
      nodes.preview.textContent = ready.serialized;
      fillList(nodes.included, [...included]); fillList(nodes.excluded, [...excluded]);
      nodes['source-limit'].textContent = sourceLimit;
      pending = null; status(resultState, 'changed'); nodes.message.textContent = '';
    } catch {
      if (!alive || pending !== job || job.id !== serial) return;
      if (clock() - job.started >= 10000) { timeout(); return; }
      if (!validContext(current)) return;
      discard(); status('error', 'buildError');
    }
  }
  async function save() {
    if (!alive || !ready || pending || handoff) return;
    if (!validContext(ready.context)) return;
    const value = draft(), error = validation(value);
    if (error || !sameDraft(value, ready.draft) || nodes.preview.textContent !== ready.serialized) {
      discard(); status(error ? 'error' : 'unconfirmed', error || 'changed'); return;
    }
    const snapshot = ready; ready = null; // consume intent BEFORE invoking adapter
    const job = { id: serial, context: snapshot.context, controller: new globalThis.AbortController() };
    handoff = job; status('unconfirmed', 'saving');
    // choices cannot initiate another preview while the adapter result is unknown
    for (const key of ['filename', 'format', 'private']) nodes[key].disabled = true;
    try {
      const result = await performDownload(Object.freeze({ serialized: snapshot.serialized, blob: snapshot.blob, filename: snapshot.draft.filename, format: snapshot.draft.format, context: snapshot.context, signal: job.controller.signal }));
      if (!alive || handoff !== job || job.id !== serial || !validContext(job.context)) return;
      status(result?.outcome === 'saved' ? 'success' : 'unconfirmed', result?.outcome === 'saved' ? 'saved' : result?.outcome === 'initiated' ? 'initiated' : 'unknown');
    } catch {
      if (alive && handoff === job && job.id === serial && validContext(job.context)) status('unconfirmed', 'unknown');
    } finally {
      if (handoff === job) {
        handoff = null;
        if (alive) {
          for (const key of ['filename', 'format', 'private']) nodes[key].disabled = false;
          nodes.refresh.disabled = false; nodes.save.disabled = true;
          if (job.id !== serial) status('unconfirmed', 'unknown');
        }
      }
    }
  }
  function focusable() {
    return Array.from(nodes.dialog.querySelectorAll('input,select,button,[tabindex="0"]')).filter(el => !el.disabled);
  }
  function keydown(event) {
    if (!alive) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
    if (event.key === 'Tab') {
      const items = focusable(), first = items[0], last = items.at(-1);
      const active = nodes.dialog.getRootNode().activeElement || root.activeElement || doc.activeElement;
      if (event.shiftKey && (active === first || !nodes.dialog.contains(active))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || !nodes.dialog.contains(active))) { event.preventDefault(); first?.focus(); }
    }
  }
  function cancel() {
    if (!alive) return;
    discard(true); if (handoff) handoff.controller.abort();
    alive = false; listeners.splice(0).forEach(off => off());
    if (nodes.dialog.open) nodes.dialog.close();
    container.remove();
    container = null; nodes = null; observed = null;
    // A pending handoff remains latched until settled: reopening never repeats it.
    if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }
  function open({ opener: target } = {}) {
    if (destroyed) throw new Error('Export dialog destroyed');
    if (alive) return;
    const language = String(getLanguage());
    L = copy[language.startsWith('pl') ? 'pl' : 'en'];
    ui = createUiV3({ language });
    opener = target || root.activeElement || doc.activeElement;
    container = doc.createElement('div'); container.setAttribute('data-ha-tools-export', '');
    // The own shadow boundary contains CSS and local IDs; adjacent W4 status
    // elements retain their existing styling. Consumers can query this open root.
    const shadow = container.attachShadow({ mode: 'open' });
    if (root.host?.classList.contains('bento-dark')) container.classList.add('bento-dark');
    const style = doc.createElement('style'); style.textContent = ':host{display:block;min-width:0;max-width:100%;}' + css + '\n' + ui.css;
    shadow.append(style);
    const shell = doc.createElement('div'); shell.setAttribute('data-ha-tools-export', ''); shadow.append(shell);
    nodes = {};
    const make = (tag, key, parent, text) => { const node = doc.createElement(tag); if (key) { node.dataset.export = key; nodes[key] = node; } if (text) node.textContent = text; parent.append(node); return node; };
    const dialog = make('dialog', 'dialog', shell); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    const body = make('div', null, dialog); body.className = 'ht-export-body';
    const title = make('h2', 'title', body, L.title);
    // Locally unique IDs, no random or global counters/persistent state.
    const prefix = `ht-export-${String(clock()).replace(/\W/g, '')}`;
    title.id = prefix + '-title'; dialog.setAttribute('aria-labelledby', title.id);
    const fields = make('div', null, body); fields.className = 'ht-export-fields';
    const filenameLabel = make('label', null, fields); make('span', null, filenameLabel, L.filename);
    const filename = make('input', 'filename', filenameLabel); filename.type = 'text'; filename.value = defaultFilename; filename.autocomplete = 'off';
    for (const key of ['included', 'excluded']) {
      const scope = make('section', null, body); scope.dataset.exportScope = key;
      make('h3', null, scope, L[key]); make('ul', key, scope);
    }
    const formatLabel = make('label', null, body); formatLabel.className = 'ht-export-format'; make('span', null, formatLabel, L.format);
    const format = make('select', 'format', formatLabel);
    formats.forEach(value => { const option = make('option', null, format, value.toUpperCase()); option.value = value; }); format.value = defaultFormat;
    const privateLabel = make('label', null, body); privateLabel.className = 'ht-export-private';
    const privateInput = make('input', 'private', privateLabel); privateInput.type = 'checkbox'; privateInput.checked = false; make('span', null, privateLabel, L.private);
    const statusLine = make('p', null, body); statusLine.setAttribute('role', 'status'); statusLine.setAttribute('aria-live', 'polite');
    make('span', 'status', statusLine); make('span', 'message', statusLine);
    make('h3', null, body, L.source); make('p', 'source-limit', body);
    const previewHeading = make('h3', null, body, L.preview); previewHeading.id = prefix + '-preview';
    const preview = make('pre', 'preview', body); preview.tabIndex = 0; preview.setAttribute('aria-labelledby', previewHeading.id);
    const actions = make('div', null, dialog); actions.className = 'ht-export-actions';
    for (const key of ['refresh', 'save', 'cancel']) { const button = make('button', key, actions, L[key]); button.type = 'button'; }
    root.append(container); alive = true; observed = readContext();
    for (const [key, event] of [['filename', 'input'], ['format', 'change'], ['private', 'change']]) on(nodes[key], event, changeDraft);
    on(nodes.refresh, 'click', refresh); on(nodes.save, 'click', save); on(nodes.cancel, 'click', cancel);
    on(dialog, 'keydown', keydown);
    on(dialog, 'cancel', event => { event.preventDefault(); cancel(); });
    on(dialog, 'close', () => { if (alive && nodes?.dialog === dialog) cancel(); });
    try {
      if (typeof dialog.showModal !== 'function') throw new Error('Native export dialog is unavailable');
      dialog.showModal();
    } catch (error) {
      cancel();
      throw error;
    }
    // The consumer supplies exact opener even when its shadow DOM hides activeElement.
    filename.focus();
    if (handoff) {
      for (const key of ['filename', 'format', 'private']) nodes[key].disabled = true;
      preview.focus();
      status('unconfirmed', 'saving');
    } else { status('not_checked', 'changed'); void refresh(); }
  }
  function updateTheme() {
    if (container) container.classList.toggle('bento-dark', !!root.host?.classList.contains('bento-dark'));
  }
  function destroy() { cancel(); destroyed = true; }
  return Object.freeze({ open, cancel, contextChanged, updateTheme, destroy });
}
// END VENDORED ha-tools-export.js

// BEGIN VENDORED ha-tools-ui.js
// HA Tools v3: vendored inside each consumer's own closure, never a window API.
function createUiV3({ language = 'en' } = {}) {
  const pl = String(language).startsWith('pl');
  const states = {
    success: ['Success', 'Sukces', '✓'],
    partial: ['Partial', 'Częściowo', '½'],
    unconfirmed: ['Unconfirmed', 'Niepotwierdzony', '?'],
    error: ['Error', 'Błąd', '✕'],
    not_checked: ['Not checked', 'Nie sprawdzono', '–'],
    no_data: ['No data', 'Brak danych', '∅'],
  };
  const status = (value) => {
    const code = typeof value === 'string' && Object.hasOwn(states, value) ? value : 'not_checked';
    const row = states[code];
    return { code, label: row[pl ? 1 : 0], icon: row[2], countsAsSuccess: code === 'success' };
  };
  const statusHtml = (value) => {
    const result = status(value);
    return `<span class="ht-result-state ht-result-state--${result.code}" data-result-state="${result.code}"><span aria-hidden="true">${result.icon}</span> ${result.label}</span>`;
  };
  const parseColor = value => {
    const text = typeof value === 'string' ? value.trim() : '';
    const hex = /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(text);
    if (hex) return (hex[1].length === 3 ? [...hex[1]].map(c=>c+c).join('') : hex[1]).match(/../g).map(c=>parseInt(c,16));
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*1(?:\.0+)?)?\s*\)$/i.exec(text);
    return rgb ? rgb.slice(1,4).map(c=>Math.min(255,Math.round(Number(c)))) : null;
  };
  const hexColor = rgb => '#' + rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
  const luminance = rgb => rgb.map(c=>c/255).map(c=>c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const primaryColors = (value, {dark = false} = {}) => {
    const original = parseColor(value) || parseColor(dark ? '#818cf8' : '#2563eb');
    const white = [255,255,255], ink = [15,23,42];
    const foreground = ratio(original,white) >= ratio(original,ink) ? white : ink;
    const target = foreground === white ? 0 : 255;
    let fill = original;
    // The nearest 5% step keeps a supplied theme color when it is readable.
    for (let step=1; ratio(fill,foreground)<4.5 && step<=20; step++)
      fill = original.map(c=>Math.round(c+(target-c)*step*.05));
    return {fill:hexColor(fill),foreground:hexColor(foreground),contrast:ratio(fill,foreground)};
  };
  const applyTheme = host => {
    const view = host?.ownerDocument?.defaultView;
    if (!host?.isConnected || !view?.getComputedStyle) return null;
    const raw = view.getComputedStyle(host).getPropertyValue('--primary-color').trim();
    let resolved = raw;
    // Resolve ordinary named colors through the browser without a persistent node.
    if (raw && !parseColor(raw) && !raw.includes('var(') && raw !== 'transparent' && view.CSS?.supports?.('color',raw)) {
      const probe = host.ownerDocument.createElement('span');
      probe.style.display = 'none'; probe.style.color = raw;
      host.append(probe);
      try { resolved = view.getComputedStyle(probe).color; } finally { probe.remove(); }
    }
    const result = primaryColors(resolved,{dark:host.classList.contains('bento-dark') || host.classList.contains('hat-dark')});
    for (const [key,value] of [['--hat-primary-fill-computed',result.fill],['--hat-on-primary-computed',result.foreground]])
      if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key,value);
    return result;
  };
  // v5.3: public tokens stay inheritable; private defaults follow the HA dark flag.
  const css = `
:host, .hat {
  color-scheme: light;
  /* powierzchnie i tekst — z motywu HA, w nawiasie wartość domyślna */
  --_hat-bg:       var(--primary-background-color, #f3f4f6);
  --_hat-card:     var(--ha-card-background, var(--card-background-color, #ffffff));
  --_hat-chip:     var(--secondary-background-color, #f3f4f6);
  --_hat-border:   var(--ha-card-border-color, var(--divider-color, #e5e7eb));
  --_hat-text:     var(--primary-text-color, #111827);
  --_hat-text-2:   var(--secondary-text-color, #4b5563);
  --_hat-text-3:   var(--hat-text-3-theme, #6b7280);   /* tylko na tle karty; ≥ 12 px */
  --_hat-grid:     color-mix(in srgb, var(--hat-text, var(--_hat-text)) 6%, var(--hat-card, var(--_hat-card)));
  --_hat-radius:   var(--ha-card-border-radius, 12px);

  /* Computed values supplied by the host when available; literals are explicit fallback colors, not dynamic contrast. */
  --_hat-primary:      var(--primary-color, #2563eb);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #2563eb);
  --_hat-on-primary:   var(--hat-on-primary-computed, #ffffff);

  /* stany: wypełnienie (≥ 3:1) i tekst (≥ 4,5:1) */
  --_hat-good: #0ca30c;  --_hat-good-text: #15803d;
  --_hat-warn: #fab219;  --_hat-warn-text: #a16207;  --_hat-warn-readout: #9a5b05;
  --_hat-crit: #d03b3b;  --_hat-crit-text: #b91c1c;

  /* serie (W23) */
  --_hat-s1: #2a78d6; --_hat-s2: #eb6834; --_hat-s3: #1baf7a; --_hat-s4: #eda100; --_hat-s5: #e87ba4;
  --_hat-zone-cheap: #1baf7a; --_hat-zone-exp: #2a78d6;
  --_hat-d1: #eb6834; --_hat-d2: #6250d6; --_hat-d3: #e87ba4; --_hat-d4: #eda100;
  --_hat-unmeasured: #9ca3af;

  /* typografia (W16: treść ≥ 14, metadane ≥ 12, wersaliki ≥ 12) */
  --_hat-font: var(--ha-font-family-body, Roboto, Inter, system-ui, sans-serif);
  --_hat-fs-display: 28px;  --_hat-fs-number2: 20px;  --_hat-fs-title: 16px;
  --_hat-fs-body: 14px;     --_hat-fs-meta: 12px;     --_hat-fs-caps: 12px;
  --_hat-fw-regular: 400;   --_hat-fw-medium: 500;    --_hat-fw-bold: 600;

  /* odstępy (siatka 4 px) i rozmiary */
  --_hat-space-1: 4px; --_hat-space-2: 8px; --_hat-space-3: 12px; --_hat-space-4: 16px; --_hat-space-5: 24px;
  --_hat-icon-lg: 36px; --_hat-icon-lg-glyph: 20px;   /* nagłówek, kafelek */
  --_hat-icon-md: 28px; --_hat-icon-md-glyph: 16px;   /* wiersz, launcher */
  --_hat-icon-sm: 24px; --_hat-icon-sm-glyph: 14px;   /* odznaka */
  --_hat-tint: 18%;                                   /* tło ikony = akcent 18 % */
  --_hat-pill-h: 32px;  --_hat-pill-h-mini: 28px;  --_hat-target: 44px;
  --_hat-row-h: 56px;   --_hat-gap: 8px;           /* siatka Sections HA */
  --_hat-motion: 150ms ease;
  font-family: var(--hat-font, var(--_hat-font));
  color: var(--hat-text, var(--_hat-text));
}

/* ---------- 2. Tokeny: ciemny (hass.themes.darkMode → klasa .hat-dark) ---------- */
:host(.hat-dark), :host(.bento-dark), .hat.hat-dark {
  --_hat-bg:     var(--primary-background-color, #111214);
  --_hat-card:   var(--ha-card-background, var(--card-background-color, #1c1c1e));
  --_hat-chip:   var(--secondary-background-color, #26272b);
  --_hat-border: var(--ha-card-border-color, var(--divider-color, #2e2f33));
  --_hat-text:   var(--primary-text-color, #e5e7eb);
  --_hat-text-2: var(--secondary-text-color, #a1a1aa);
  --_hat-text-3: var(--hat-text-3-theme, #8b8b93);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #818cf8);
  --_hat-on-primary:   var(--hat-on-primary-computed, #0f172a);
  --_hat-good: #22c55e;  --_hat-good-text: #22c55e;
  --_hat-warn: #fab219;  --_hat-warn-text: #fab219;  --_hat-warn-readout: #fab219;
  --_hat-crit: #e05252;  --_hat-crit-text: #f87171;
  --_hat-s1: #3987e5; --_hat-s2: #d95926; --_hat-s3: #199e70; --_hat-s4: #c98500; --_hat-s5: #d55181;
  --_hat-zone-cheap: #199e70; --_hat-zone-exp: #3987e5;
  --_hat-d1: #d95926; --_hat-d2: #9085e9; --_hat-d3: #d55181; --_hat-d4: #c98500;
  --_hat-unmeasured: #6b7280;
  color-scheme: dark;
}



.ht-result-state { display:inline-flex;align-items:center;gap:var(--hat-space-1,4px);min-height:24px;padding:0 10px;border:1px solid currentColor;border-radius:999px;font-size:var(--hat-fs-meta,12px);font-weight:600;line-height:16px;white-space:normal;background:transparent; }
.ht-result-state--success { color:var(--hat-good-text, var(--_hat-good-text)); }
.ht-result-state--partial,.ht-result-state--unconfirmed { color:var(--hat-warn-text, var(--_hat-warn-text)); }
.ht-result-state--error { color:var(--hat-crit-text, var(--_hat-crit-text)); }
.ht-result-state--not_checked,.ht-result-state--no_data { color:var(--hat-text-2, var(--_hat-text-2)); }
.ht-result-state--no_data { border-style:dashed; }
`;
  return { status, statusHtml, css, primaryColors, applyTheme };
}
// END VENDORED ha-tools-ui.js

// Reviewed consumer schema. New fields require an explicit review and test.
const DATA_NUMERIC_DOMAINS = new Set(['sensor', 'number', 'input_number', 'counter']);
const DATA_STATE_ENUMS = Object.freeze({
  binary_sensor: ['on', 'off'], switch: ['on', 'off'], input_boolean: ['on', 'off'],
  light: ['on', 'off'], fan: ['on', 'off'], lock: ['locked', 'unlocked', 'locking', 'unlocking', 'jammed'],
  cover: ['open', 'closed', 'opening', 'closing'], climate: ['off', 'heat', 'cool', 'auto', 'heat_cool', 'dry', 'fan_only'],
  vacuum: ['cleaning', 'docked', 'idle', 'paused', 'returning', 'error'],
  media_player: ['off', 'on', 'idle', 'playing', 'paused', 'standby']
});
const DATA_NUMERIC_ATTRIBUTES = Object.freeze(['temperature', 'current_temperature', 'target_temp_high', 'target_temp_low', 'humidity', 'current_humidity', 'brightness', 'color_temp', 'color_temp_kelvin', 'battery_level', 'current_position', 'current_tilt_position', 'percentage', 'power', 'energy', 'voltage', 'current', 'pressure', 'illuminance', 'min', 'max', 'step', 'supported_features']);
const DATA_BOOLEAN_ATTRIBUTES = Object.freeze(['assumed_state', 'restored']);
const DATA_ATTRIBUTE_ENUMS = Object.freeze({
  unit_of_measurement: ['°C', '°F', 'K', '%', 'W', 'kW', 'Wh', 'kWh', 'V', 'mV', 'A', 'mA', 'Hz', 'Pa', 'hPa', 'kPa', 'bar', 'psi', 'lx', 'lm', 'm', 'cm', 'mm', 'km', 'm²', 'm³', 'L', 'mL', 'l', 's', 'min', 'h', 'd', 'g', 'kg', 'mg', 'µg/m³', 'mg/m³', 'ppm', 'ppb', 'dB', 'dBm', 'B', 'kB', 'MB', 'GB', 'bit/s', 'kbit/s', 'Mbit/s', 'm/s', 'km/h', 'mph', 'mm/h', 'mm/d', 'm³/h', 'L/min', 'rpm', '°'],
  device_class: ['temperature', 'humidity', 'battery', 'power', 'energy', 'voltage', 'current', 'pressure', 'illuminance', 'duration', 'distance', 'speed', 'volume', 'volume_flow_rate', 'water', 'weight', 'carbon_dioxide', 'carbon_monoxide', 'pm1', 'pm10', 'pm25', 'signal_strength', 'frequency', 'data_size', 'data_rate', 'monetary', 'timestamp', 'enum', 'apparent_power', 'reactive_power', 'power_factor', 'energy_storage', 'gas', 'atmospheric_pressure', 'sound_pressure', 'precipitation', 'precipitation_intensity', 'absolute_humidity', 'aqi', 'volatile_organic_compounds', 'volatile_organic_compounds_parts', 'battery_charging', 'cold', 'connectivity', 'door', 'garage_door', 'heat', 'light', 'lock', 'moisture', 'motion', 'moving', 'occupancy', 'opening', 'plug', 'power', 'presence', 'problem', 'running', 'safety', 'smoke', 'sound', 'tamper', 'update', 'vibration', 'window'],
  state_class: ['measurement', 'total', 'total_increasing'], hvac_action: ['off', 'idle', 'heating', 'cooling', 'drying', 'fan'],
  color_mode: ['onoff', 'brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white']
});
// Blob URLs for Save stay valid long enough for WebKit download handoffs (issue #6).
const DOWNLOAD_URL_LIFETIME_MS = 60000;
const DATA_EXPORT_POLICY = Object.freeze({
  id: 'ha-data-exporter-reviewed-v1',
  allowlistedFields: ['entity_id', 'friendly_name', 'state', 'domain', 'last_changed', 'device_id', 'device_name', 'area_id', 'area_name', 'change', 'before_state', 'after_state', 'before_timestamp', 'after_timestamp', 'source',
    ...DATA_NUMERIC_ATTRIBUTES.map(key => `attributes.${key}`), ...DATA_BOOLEAN_ATTRIBUTES.map(key => `attributes.${key}`), ...Object.keys(DATA_ATTRIBUTE_ENUMS).map(key => `attributes.${key}`)],
  neverInclude: ['tokens', 'users', 'addresses', 'raw_config']
});


// Component-local XSS protection: never reads from or publishes a global helper.
const _esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

// Component-local persistence retains this card's existing localStorage keys.
const haToolsPersistence = { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-data-exporter-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-data-exporter] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-data-exporter-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-data-exporter-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };


/**
 * Home Assistant Data Exporter Card
 * Export devices, entities, states, and attributes to CSV/JSON
 */

/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
const HA_DATA_EXPORTER_BENTO_CSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v2.0 (Premium)
   ═══════════════════════════════════════════════ */

/* keyboard a11y */
:focus-visible { outline: 2px solid var(--bento-primary, #6366f1); outline-offset: 2px; border-radius: 3px; }

:host {
  /* Brand palette — diamond top, gradient-friendly */
  --bento-primary: #6366f1;
  --bento-primary-2: #8b5cf6;
  --bento-primary-3: #ec4899;
  --bento-primary-hover: #4f46e5;
  --bento-primary-light: rgba(99, 102, 241, 0.08);
  --bento-primary-glow: rgba(99, 102, 241, 0.35);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.10);
  --bento-success-border: rgba(16, 185, 129, 0.25);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.10);
  --bento-error-border: rgba(239, 68, 68, 0.25);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.10);
  --bento-warning-border: rgba(245, 158, 11, 0.25);
  --bento-info: #06b6d4;
  --bento-info-light: rgba(6, 182, 212, 0.10);
  --bento-info-border: rgba(6, 182, 212, 0.25);

  /* Theme */
  --bento-bg:     var(--primary-background-color, #fafaf9);
  --bento-bg-2:   var(--card-background-color, #f5f5f4);
  --bento-card:   var(--card-background-color, #ffffff);
  --bento-glass:  rgba(255, 255, 255, 0.7);
  --bento-border: var(--divider-color, #e7e5e4);
  --bento-border-strong: rgba(0, 0, 0, 0.08);
  --bento-text:           var(--primary-text-color,   #0c0a09);
  --bento-text-secondary: var(--secondary-text-color, #57534e);
  --bento-text-muted:     var(--disabled-text-color,  #a8a29e);

  /* Radii */
  --bento-radius-xs: 8px;
  --bento-radius-sm: 12px;
  --bento-radius-md: 18px;
  --bento-radius-lg: 24px;
  --bento-radius-pill: 999px;

  /* Shadows — modern, layered */
  --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
  --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.10), 0 12px 24px -8px rgba(0,0,0,0.05);
  --bento-shadow-glow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px -8px rgba(99,102,241,0.25);

  /* Gradients */
  --bento-grad-primary: linear-gradient(135deg, #6366f1, #8b5cf6);
  --bento-grad-rainbow: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  --bento-grad-success: linear-gradient(135deg, #10b981, #34d399);
  --bento-grad-error:   linear-gradient(135deg, #ef4444, #f87171);
  --bento-grad-warning: linear-gradient(135deg, #f59e0b, #fbbf24);

  /* Motion */
  --bento-trans-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans:      0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv11" 1, "ss01" 1;
  letter-spacing: -0.01em;
  display: block;
  color: var(--bento-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Dark mode ───────────────────────────────── */
:host(.bento-dark) {
    --bento-bg:     var(--primary-background-color, #0a0a0f);
    --bento-bg-2:   var(--card-background-color,    #111119);
    --bento-card:   var(--card-background-color,    #16161f);
    --bento-glass:  rgba(22, 22, 31, 0.7);
    --bento-border: var(--divider-color,            #27272f);
    --bento-border-strong: rgba(255, 255, 255, 0.08);
    --bento-text:           var(--primary-text-color,   #fafaf9);
    --bento-text-secondary: var(--secondary-text-color, #d6d3d1);
    --bento-text-muted:     var(--disabled-text-color,  #78716c);
    --bento-primary:        #818cf8;
    --bento-primary-2:      #a78bfa;
    --bento-primary-3:      #f472b6;
    --bento-primary-light:  rgba(129, 140, 248, 0.12);
    --bento-primary-glow:   rgba(129, 140, 248, 0.45);
    --bento-success: #34d399;
    --bento-success-light:  rgba(52, 211, 153, 0.12);
    --bento-success-border: rgba(52, 211, 153, 0.30);
    --bento-error:   #f87171;
    --bento-error-light:    rgba(248, 113, 113, 0.12);
    --bento-error-border:   rgba(248, 113, 113, 0.30);
    --bento-warning: #fbbf24;
    --bento-warning-light:  rgba(251, 191, 36, 0.12);
    --bento-warning-border: rgba(251, 191, 36, 0.30);
    --bento-info:    #22d3ee;
    --bento-info-light:     rgba(34, 211, 238, 0.12);
    --bento-info-border:    rgba(34, 211, 238, 0.30);
    --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2);
    --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.6), 0 12px 24px -8px rgba(0,0,0,0.3);
    --bento-shadow-glow: 0 0 0 1px rgba(129,140,248,0.2), 0 8px 32px -8px rgba(129,140,248,0.5);
    --bento-grad-primary: linear-gradient(135deg, #818cf8, #a78bfa);
    --bento-grad-rainbow: linear-gradient(135deg, #818cf8, #a78bfa 50%, #f472b6);
    color-scheme: dark !important;
  }
:host(.bento-dark) .card, :host(.bento-dark) .card-container, :host(.bento-dark) .main-card, :host(.bento-dark) .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
:host(.bento-dark) input, :host(.bento-dark) select, :host(.bento-dark) textarea { background: var(--bento-bg-2); color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) table th { background: var(--bento-bg-2); color: var(--bento-text-secondary); border-color: var(--bento-border); }
:host(.bento-dark) table td { color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) pre, :host(.bento-dark) code { background: #1e1e2e !important; color: #e2e8f0 !important; }

/* ── Reset & motion preferences ──────────────── */
* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0s !important; transition-duration: 0s !important; } }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-md);
  color: var(--bento-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  transition: box-shadow var(--bento-trans), border-color var(--bento-trans);
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 20px 24px 0;
  display: flex; align-items: center; gap: 12px;
}
.header-icon { font-size: 24px; }
.header-title {
  font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-grad-primary); color: #fff;
  font-size: 11px; padding: 4px 10px; border-radius: var(--bento-radius-pill);
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.content { padding: 20px 24px 24px; }

/* ── Tabs (modern pill style) ────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important; gap: 4px !important;
  padding: 4px !important;
  background: var(--bento-bg-2) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 20px !important;
  overflow: visible !important;
  -webkit-overflow-scrolling: touch !important;
  flex-wrap: wrap !important; border-bottom: 0 !important;
  width: 100%; max-width: 100%; box-sizing: border-box;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 8px 16px !important;
  border: none !important; background: transparent !important; cursor: pointer !important;
  font-size: 13px !important; font-weight: 600 !important;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif !important;
  color: var(--bento-text-secondary) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 0 !important;
  transition: all var(--bento-trans) !important;
  white-space: nowrap !important; flex: 1 1 auto !important; text-align: center !important; min-height: 40px !important;
  letter-spacing: -0.005em !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-text) !important;
  background: var(--bento-card) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  background: var(--bento-card) !important;
  color: var(--bento-primary) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-weight: 700 !important;
}
.tab-content { display: block; }
.tab-content.active { animation: bentoFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards (premium) ──────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-bg-2) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-sm) !important;
  padding: 18px !important;
  text-align: left !important;
  transition: transform var(--bento-trans), box-shadow var(--bento-trans), border-color var(--bento-trans);
  position: relative; overflow: hidden;
}
.stat-card::before, .metric-card::before, .kpi-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--bento-grad-primary);
  opacity: 0; transition: opacity var(--bento-trans);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  transform: translateY(-2px); box-shadow: var(--bento-shadow-lg); border-color: var(--bento-primary-light);
}
.stat-card:hover::before, .metric-card:hover::before, .kpi-card:hover::before { opacity: 1; }
.stat-icon { font-size: 22px; margin-bottom: 6px; opacity: 0.85; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 26px; font-weight: 800; line-height: 1.1;
  letter-spacing: -0.02em; color: var(--bento-text);
  font-feature-settings: "tnum" 1;
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px; color: var(--bento-text-secondary);
  margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.stat-num {
  font-size: 24px; font-weight: 800; color: var(--bento-primary);
  font-feature-settings: "tnum" 1; letter-spacing: -0.02em;
}
.stat-sub { font-size: 12px; color: var(--bento-text-muted); font-weight: 500; }

/* ── Overview grid ───────────────────────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 20px;
}

/* ── Section headers ─────────────────────────── */
.section-header, .section-title {
  display: flex; align-items: center; justify-content: space-between;
  position: relative; padding-left: 12px;
  font-size: 12px; font-weight: 700; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 16px 0 10px;
}
.section-header::before, .section-title::before {
  content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--bento-primary);
  position: absolute; left: 0; top: 50%; transform: translateY(-50%); flex-shrink: 0;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px; border-radius: var(--bento-radius-pill);
  background: linear-gradient(90deg, var(--bento-primary), var(--bento-primary-2), transparent);
  background-size: 200% 100%;
  animation: bentoLoad 1.5s linear infinite; margin-bottom: 12px;
}
@keyframes bentoLoad { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty-state, .no-data, .no-results {
  text-align: center; color: var(--bento-text-secondary);
  padding: 40px 20px; font-size: 14px;
  background: var(--bento-bg-2); border-radius: var(--bento-radius-md);
  border: 1px dashed var(--bento-border);
}
.info-note, .tip-box {
  font-size: 13px; color: var(--bento-text-secondary);
  background: var(--bento-primary-light);
  border-radius: var(--bento-radius-sm); padding: 12px 14px;
  border-left: 3px solid var(--bento-primary); margin-top: 12px;
  line-height: 1.55;
}
.last-updated {
  font-size: 11px; color: var(--bento-text-muted);
  text-align: right; margin-top: 12px; font-feature-settings: "tnum" 1;
}

/* ── Buttons (premium) ───────────────────────── */
.refresh-btn {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-pill); padding: 6px 14px;
  font-size: 12px; color: var(--bento-text-secondary);
  cursor: pointer; font-weight: 600; transition: all var(--bento-trans);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
}
.refresh-btn:hover {
  background: var(--bento-card); color: var(--bento-primary);
  border-color: var(--bento-primary); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-sm);
}
.toggle-btn, .action-btn {
  background: var(--bento-grad-primary); border: none;
  border-radius: var(--bento-radius-xs); padding: 8px 16px;
  font-size: 13px; color: #fff; cursor: pointer; font-weight: 600;
  transition: all var(--bento-trans); font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.005em;
  box-shadow: 0 4px 12px -2px var(--bento-primary-glow);
}
.toggle-btn:hover, .action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -4px var(--bento-primary-glow);
}
.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-grad-primary); color: #fff;
  border: none; border-radius: var(--bento-radius-sm);
  padding: 12px 20px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.01em;
  transition: all var(--bento-trans);
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.send-btn:hover, .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px var(--bento-primary-glow);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
}

/* ── Badges / Status (modern pill) ───────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 12px; border-radius: var(--bento-radius-pill);
  font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
  letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); border-color: var(--bento-warning-border); }
.badge-info { background: var(--bento-info-light); color: var(--bento-info); border-color: var(--bento-info-border); }

.count-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: var(--bento-radius-pill); display: inline-flex; align-items: center;
  font-feature-settings: "tnum" 1;
}
.error-badge { background: var(--bento-error-light); color: var(--bento-error); border: 1px solid var(--bento-error-border); }
.warn-badge  { background: var(--bento-warning-light); color: var(--bento-warning); border: 1px solid var(--bento-warning-border); }
.info-badge  { background: var(--bento-primary-light); color: var(--bento-primary); border: 1px solid var(--bento-border); }
.ok-badge    { background: var(--bento-success-light); color: var(--bento-success); border: 1px solid var(--bento-success-border); }

/* ── Tables (modern) ─────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg-2); color: var(--bento-text-secondary);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--bento-border);
}
th:first-child { border-top-left-radius: var(--bento-radius-sm); }
th:last-child  { border-top-right-radius: var(--bento-radius-sm); }
td {
  padding: 14px 16px; border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text); font-size: 13px;
}
tr { transition: background var(--bento-trans-fast); }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: 0; }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 10px 14px; border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card); color: var(--bento-text);
  font-size: 14px; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  transition: all var(--bento-trans); outline: none;
  letter-spacing: -0.005em;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 4px var(--bento-primary-light);
}
input::placeholder, textarea::placeholder { color: var(--bento-text-muted); }

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-bg-2); padding: 2px 6px;
  border-radius: 4px; font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  border: 1px solid var(--bento-border);
}
pre {
  background: #1e1e2e; color: #e2e8f0;
  padding: 16px; border-radius: var(--bento-radius-sm);
  font-size: 12.5px; overflow-x: auto; line-height: 1.65;
  white-space: pre-wrap; word-break: break-word;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  box-shadow: var(--bento-shadow-md);
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); padding: 16px;
  transition: all var(--bento-trans);
}
.schedule-card:hover, .send-card:hover, .info-card:hover {
  border-color: var(--bento-primary-light); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-md);
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 4px 8px; padding: 10px 12px;
  border-radius: var(--bento-radius-sm); margin-bottom: 6px;
  font-size: 12.5px; min-width: 0; overflow: hidden;
  border: 1px solid transparent; transition: all var(--bento-trans-fast);
}
.error-entry { background: var(--bento-error-light); border-color: var(--bento-error-border); }
.warn-entry  { background: var(--bento-warning-light); border-color: var(--bento-warning-border); }
.log-time { color: var(--bento-text-muted); font-feature-settings: "tnum" 1; flex-shrink: 0; font-family: "JetBrains Mono", monospace; }
.log-domain {
  font-weight: 700; flex-shrink: 1; min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary); flex-basis: 100%;
  word-break: break-word; overflow-wrap: anywhere;
  white-space: pre-wrap; min-width: 0; line-height: 1.55;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 12px 16px; border-radius: var(--bento-radius-sm);
  margin-top: 14px; font-size: 13px; font-weight: 600;
  text-align: center; letter-spacing: -0.005em;
  border: 1px solid;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); border-color: var(--bento-border); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: var(--bento-radius-pill); border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); background-clip: content-box; }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin  { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes bentoSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bentoStaggerIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* Apply stagger to grids of stat-cards */
.stats-grid > *, .overview-grid > *, .summary-grid > * {
  animation: bentoStaggerIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.stats-grid > *:nth-child(1)  { animation-delay: 0.02s; }
.stats-grid > *:nth-child(2)  { animation-delay: 0.06s; }
.stats-grid > *:nth-child(3)  { animation-delay: 0.10s; }
.stats-grid > *:nth-child(4)  { animation-delay: 0.14s; }
.stats-grid > *:nth-child(5)  { animation-delay: 0.18s; }
.stats-grid > *:nth-child(6)  { animation-delay: 0.22s; }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 16px; }
  .header { padding: 16px 16px 0; }
  .tabs { gap: 2px !important; padding: 3px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 12px !important; font-size: 12px !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
    grid-template-columns: repeat(2, 1fr); gap: 10px;
  }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 22px; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; padding: 8px 10px; }
  .log-domain { max-width: 60%; font-size: 11.5px; }
  .log-msg { flex-basis: 100%; max-width: 100%; font-size: 11.5px; }
  pre { padding: 12px; font-size: 11.5px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
  table { font-size: 12.5px; }
  th, td { padding: 10px 12px; }
}
@media (max-width: 480px) {
  .tabs { gap: 1px !important; padding: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 10px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 18px; }
}
`;
// Card-owned support footer. Never mutates document or foreign cards.
const _LOCAL_INTRO_KEY = 'ha-intro-dismissed-ha-data-exporter';
const _LOCAL_INTRO = {
  headline: "Browse, filter, and export Home Assistant entity data.",
  steps: ["Filter by domain or search entities live.","Take a snapshot or export selection to CSV / JSON.","Review exact file content and private fields before saving."]
};
const _LOCAL_INTRO_PL = {
  headline: 'Przeglądaj, filtruj i eksportuj dane encji Home Assistant.',
  steps: ['Filtruj według domeny lub wyszukuj encje na bieżąco.', 'Zrób snapshot lub eksportuj zaznaczone encje do CSV / JSON.', 'Sprawdź dokładną zawartość pliku i pola prywatne przed zapisem.']
};
const _LOCAL_SUPPORT_KEY = 'ha-data-exporter-support-dismissed';
const _LOCAL_DONATE_HTML = '<div class="donate-section" data-source="own-card" style="margin:8px 0 0;padding:4px 0;background:none;border:0;box-shadow:none;min-height:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-direction:row;justify-content:flex-start;text-align:left"><a href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;min-height:44px;min-width:44px;font-size:11px;color:var(--secondary-text-color,#64748b);font-weight:400;text-decoration:underline">Optional support for HA Tools</a><button type="button" class="support-dismiss" aria-label="Dismiss support link" style="margin-left:auto;padding:2px 6px;min-height:44px;min-width:44px;line-height:1;border:0;background:none;color:var(--secondary-text-color,#64748b);cursor:pointer">×</button></div>';
function _renderLocalSupport(language) {
  return language === 'pl' ? _LOCAL_DONATE_HTML
    .replace('Optional support for HA Tools', 'Dobrowolne wsparcie HA Tools')
    .replace('Dismiss support link', 'Ukryj link wsparcia') : _LOCAL_DONATE_HTML;
}
function _refreshLocalGuidance(root, language) {
  const pl = language === 'pl';
  const intro = pl ? _LOCAL_INTRO_PL : _LOCAL_INTRO;
  const banner = root.querySelector('.intro-banner[data-intro="ha-data-exporter"]');
  if (banner) {
    const headline = banner.querySelector('.intro-headline');
    if (headline) headline.textContent = pl ? 'Jak eksportować dane encji' : 'How to export entity data';
    banner.querySelectorAll('.intro-steps li').forEach((li, index) => {
      if (intro.steps[index]) li.textContent = intro.steps[index];
    });
    const dismiss = banner.querySelector('.intro-dismiss');
    if (dismiss) {
      dismiss.title = pl ? 'Ukryj instrukcję' : 'Dismiss';
      dismiss.setAttribute('aria-label', dismiss.title);
    }
  }
  const support = root.querySelector('.donate-section[data-source="own-card"]');
  if (support) {
    const link = support.querySelector('a');
    if (link) link.textContent = pl ? 'Dobrowolne wsparcie HA Tools' : 'Optional support for HA Tools';
    support.querySelector('.support-dismiss')?.setAttribute('aria-label', pl ? 'Ukryj link wsparcia' : 'Dismiss support link');
  }
}
function _localSupportDismissed() { try { return localStorage.getItem(_LOCAL_SUPPORT_KEY) === '1'; } catch (_) { return false; } }
function _bindLocalSupportDismiss(root) { root.querySelector('.support-dismiss')?.addEventListener('click', () => { try { localStorage.setItem(_LOCAL_SUPPORT_KEY, '1'); } catch (_) {} root.querySelector('.donate-section[data-source="own-card"]')?.remove(); }); }
function _localIntroKey(user) { return _LOCAL_INTRO_KEY + ":" + encodeURIComponent(user || "unknown"); }
function _localIntroDismissed(user) {
  try { return localStorage.getItem(_localIntroKey(user)) === '1'; } catch(e) { return false; }
}
function _renderLocalIntro(language, user) {
  if (_localIntroDismissed(user)) return '';
  const intro = language === 'pl' ? _LOCAL_INTRO_PL : _LOCAL_INTRO;
  const dismiss = language === 'pl' ? 'Ukryj instrukcję' : 'Dismiss';
  const steps = intro.steps.map(step => '<li>' + _esc(step) + '</li>').join('');
  return '<details class="intro-banner" data-intro="ha-data-exporter">'
    + '<button class="intro-dismiss" type="button" title="' + _esc(dismiss) + '" aria-label="' + _esc(dismiss) + '">✕</button>'
    + '<summary class="intro-headline">' + _esc(language === 'pl' ? 'Jak eksportować dane encji' : 'How to export entity data') + '</summary>'
    + '<ol class="intro-steps">' + steps + '</ol>'
    + '</details>';
}
function _bindLocalIntroDismiss(root, user) {
  const button = root && root.querySelector('.intro-banner[data-intro="ha-data-exporter"] .intro-dismiss');
  if (!button) return;
  button.addEventListener('click', event => {
    event.stopPropagation();
    try { localStorage.setItem(_localIntroKey(user), '1'); } catch(e) {}
    button.closest('.intro-banner')?.remove();
  });
}
/* ============================================================ */

// BEGIN VENDORED ha-tools-tariff-guard.js
'use strict';

// One wire fence for the card-owned host and settings editor. A public timeout
// is uncertainty, never permission to dispatch another raw operation.
function createTariffGuardV3({ getHass, getContext = () => null, browser = typeof window === 'object' ? window : null, timeoutMs = 15000 }) {
  const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  let epoch = 0, association, connection, connectionOffline = false, browserOffline = browser?.navigator?.onLine === false;
  let raw = null, suspended = false;
  const listeners = new Set(), wireListeners = new Set();
  const notify = () => { epoch++; for (const listener of [...listeners]) listener(); };
  const connectionEvent = event => {
    if (event.type === 'disconnected' || event.type === 'reconnect-error') connectionOffline = true;
    else if (event.type === 'ready') connectionOffline = false;
    notify();
  };
  const types = ['disconnected', 'ready', 'reconnect-error'];
  const bind = next => {
    if (connection === next) return;
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    connection = next; connectionOffline = next?.connected === false;
    if (!suspended) for (const type of types) connection?.addEventListener?.(type, connectionEvent);
  };
  const browserEvent = event => { browserOffline = event.type === 'offline'; notify(); };
  browser?.addEventListener?.('offline', browserEvent);
  browser?.addEventListener?.('online', browserEvent);
  const read = h => {
    bind(h?.connection);
    return { user: h?.user?.id, admin: h?.user?.is_admin === true, owner: h?.user?.is_owner === true,
      active: h?.user?.is_active !== false, groups: canonical(h?.user?.groups || []), groupIds: canonical(h?.user?.group_ids || []),
      connection: h?.connection, callWS: h?.callWS,
      connected: h?.connection?.connected !== false && !connectionOffline,
      online: !suspended && !browserOffline && browser?.navigator?.onLine !== false,
      haConfig: canonical(h?.config || {}), context: canonical(getContext()) };
  };
  const equal = (a, b) => a && b && Object.keys(b).every(k => a[k] === b[k]);
  const observe = (...prospectiveHass) => {
    const now = read(prospectiveHass.length ? prospectiveHass[0] : getHass()), changed = association && !equal(association, now);
    association = now;
    if (changed) notify();
    return { ...now, epoch };
  };
  const available = a => !!a?.user && a.active && !!a.connection && a.connected && a.online && typeof a.callWS === 'function';
  const snapshot = () => observe();
  const current = (token, admin = false) => {
    const now = observe();
    return token?.epoch === now.epoch && equal(token, Object.fromEntries(Object.entries(now).filter(([k]) => k !== 'epoch'))) && available(now) && (!admin || now.admin);
  };
  const call = (token, payload, admin = false) => {
    if (!current(token, admin)) return Promise.reject({ code: 'authority_changed' });
    if (raw) return Promise.reject({ code: 'wire_occupied' });
    let resolvePublic, rejectPublic, finished = false;
    const result = new Promise((resolve, reject) => { resolvePublic = resolve; rejectPublic = reject; });
    const slot = {}; raw = slot;
    const timer = setTimeout(() => { finished = true; rejectPublic({ code: 'timeout' }); }, timeoutMs);
    let request;
    try { request = Promise.resolve(token.callWS.call(getHass(), payload)); }
    catch (error) { request = Promise.reject(error); }
    // Both branches handle late settlement; no floating rejected finally promise.
    const settled = () => {
      clearTimeout(timer); if (raw === slot) raw = null;
      for (const listener of [...wireListeners]) listener();
    };
    request.then(value => {
      settled();
      if (!finished) { finished = true; current(token, admin) ? resolvePublic(value) : rejectPublic({ code: 'authority_changed' }); }
    }, error => { settled(); if (!finished) { finished = true; rejectPublic(error); } });
    return result;
  };
  const suspend = () => {
    if (suspended) return;
    suspended = true;
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    browser?.removeEventListener?.('offline', browserEvent); browser?.removeEventListener?.('online', browserEvent);
    notify();
  };
  const resume = () => {
    if (!suspended) return;
    suspended = false; browserOffline = browser?.navigator?.onLine === false;
    for (const type of types) connection?.addEventListener?.(type, connectionEvent);
    browser?.addEventListener?.('offline', browserEvent); browser?.addEventListener?.('online', browserEvent);
    notify(); observe();
  };
  const dispose = () => {
    for (const type of types) connection?.removeEventListener?.(type, connectionEvent);
    browser?.removeEventListener?.('offline', browserEvent); browser?.removeEventListener?.('online', browserEvent);
    notify(); listeners.clear(); wireListeners.clear(); // Raw occupancy intentionally survives disposal.
  };
  observe(); // Observe typed edges before the card/editor is ever mounted.
  return { snapshot, observe, current, available, call, occupied: () => raw !== null,
    subscribeWire: listener => { wireListeners.add(listener); return () => wireListeners.delete(listener); },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, invalidate: notify, suspend, resume, dispose };
}
// END VENDORED ha-tools-tariff-guard.js

// BEGIN VENDORED ha-tools-dashboard-placement.js
// Data adaptation of Smart ae7b379066f3d9e93f10f40fde8d1adbdc080c57. Distinct tag and Data-only allowlist.
// Native HA dialog-manager (frontend 20260826.7) owns this transient session.
// Its provideHass subscription supplies current identity after Lovelace replaces
// the initiating card. Neither an old card nor a cached hass authorizes Undo.
function createNativeDashboardPlacementV53(options) {
  const {host, getHass, getCardConfig, getSourceKey, createGuard} = options;
  let ancestor = host;
  while (ancestor && ancestor.localName !== 'home-assistant')
    ancestor = ancestor.parentElement || ancestor.getRootNode?.().host;
  if (!ancestor || typeof ancestor.provideHass !== 'function') return null;
  const doc = host.ownerDocument, win = doc.defaultView;
  const tag = 'ha-data-exporter-dashboard-placement-dialog-v53';
  const copy = value => JSON.parse(JSON.stringify(value));
  const route = () => win.location.pathname + win.location.search + win.location.hash;
  if (!win.customElements.get(tag)) {
    win.customElements.define(tag, class extends win.HTMLElement {
      set hass(value) {
        this._hass = value;
        this._guard?.observe(value);
        if (this._request && !this._sourceCurrent()) this.closeDialog();
        this._controller?.update();
      }
      get hass() { return this._hass; }
      _sourceCurrent() {
        const request = this._request;
        if (!request || request.cancelled || route() !== request.route) return false;
        return request.transferred || request.sourceCurrent();
      }
      showDialog(request) {
        this.closeDialog();
        if (request.cancelled) return;
        this._request = request; request.owner = this;
        // HA calls showDialog before appending the native element.
        win.queueMicrotask(() => this._start());
      }
      connectedCallback() { this._start(); }
      disconnectedCallback() { this.closeDialog(); }
      _start() {
        const request = this._request;
        if (!request || this._guard || !this.isConnected) return;
        if (!this._sourceCurrent() || this._hass?.connection !== request.connection ||
            this._hass?.user?.id !== request.user) { this.closeDialog(); return; }
        const guard = createGuard({getHass:() => this._hass,
          getContext:() => ({card:request.card,route:route()}),browser:win});
        this._guard = guard; this._token = guard.snapshot();
        if (!guard.current(this._token,true)) { this.closeDialog(); return; }
        this._unsubscribe = guard.subscribe(() => this.closeDialog());
        this._routeChanged = () => { if (!this._sourceCurrent()) this.closeDialog(); };
        for (const event of ['location-changed','popstate','hashchange']) win.addEventListener(event,this._routeChanged);
        this._controller ||= createDashboardPlacementV53({host:this,nativeOwned:true,
          getHass:() => this._sourceCurrent() && this._guard?.current(this._token,true) ? this._hass : null,
          getCardConfig:() => this._request?.card,
          getSourceKey:() => this._token?.epoch,
          onClose:() => { if (this._request) this.closeDialog(); }});
        if (!this._controller.open()) this.closeDialog();
      }
      transfer(request) {
        // Only a transaction already sent by the user's Add/Undo may outlive
        // a real source disconnect. A preview or unrelated teardown closes.
        if (this._request !== request || request.cancelled || route() !== request.route ||
            !this.isConnected || !this._guard?.current(this._token,true)) return false;
        // The source is already disconnected when its lifecycle callback runs.
        // Validate the sent transaction using the live native owner, rather
        // than requiring that detached source to remain connected.
        request.transferred = true;
        if (!this._controller?.acceptsOwnRemount()) { request.transferred = false; return false; }
        request.sourceCurrent = null; // Release all references to the old source.
        return true;
      }
      closeDialog() {
        const request = this._request;
        if (!request) return true;
        this._request = null; request.cancelled = true; request.owner = null;
        request.sourceCurrent = null; request.card = null; request.connection = null; request.user = null;
        this._unsubscribe?.(); this._unsubscribe = null;
        for (const event of ['location-changed','popstate','hashchange']) win.removeEventListener(event,this._routeChanged);
        this._routeChanged = null;
        const guard = this._guard; this._guard = null; this._token = null;
        this._controller?.close(); // Retain the raw lane until actual settlement.
        guard?.dispose();
        this.dispatchEvent(new win.CustomEvent('dialog-closed',{detail:{dialog:tag},bubbles:true,composed:true}));
        return true;
      }
    });
  }
  let request = null;
  function close() {
    if (!request) return;
    request.cancelled = true;
    if (request.owner?._request === request) request.owner.closeDialog();
    request.sourceCurrent = null; request.card = null; request = null;
  }
  return {
    open() {
      if (request && !request.cancelled) return true;
      const hass = getHass();
      if (!hass || !host.isConnected) return false;
      const card = copy(getCardConfig());
      const known = ['custom:ha-data-exporter'];
      if (!known.includes(card?.type) || !options.cardTypes.includes(card.type)) return false;
      const source = JSON.stringify(getSourceKey()), signature = JSON.stringify(card);
      const next = {card,route:route(),connection:hass.connection,user:hass.user.id,cancelled:false,transferred:false,owner:null,
        sourceCurrent:() => {
          const live = getHass();
          return host.isConnected && live?.connection === next.connection && live?.user?.id === next.user &&
            JSON.stringify(getCardConfig()) === signature && JSON.stringify(getSourceKey()) === source;
        }};
      request = next;
      host.dispatchEvent(new win.CustomEvent('show-dialog',{bubbles:true,composed:true,detail:{
        dialogTag:tag,dialogImport:() => Promise.resolve(),dialogParams:next,addHistory:false}}));
      return true;
    },
    close,destroy:close,
    update() {
      if (!request || request.cancelled) return;
      if (!request.transferred && !request.sourceCurrent()) close();
      else request.owner?._controller?.update();
    },
    sourceDisconnected() {
      if (request?.owner?.transfer(request)) return true;
      close(); return false;
    }
  };
}
// Lovelace save has no CAS: compare-before-save reduces, but cannot eliminate,
// the race with another editor between the final read and the native save.
function createDashboardPlacementV53({host, getHass, getCardConfig,
  cardTypes = ['custom:ha-data-exporter'],
  getSourceKey = () => null, createGuard, nativeOwned = false, onClose = () => {}}) {
  if (!nativeOwned) {
    const native = createNativeDashboardPlacementV53({host,getHass,getCardConfig,getSourceKey,cardTypes,createGuard});
    if (native) return native;
  }
  const known = ['custom:ha-data-exporter'];
  const allowed = known.filter(type => cardTypes.includes(type));
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = value => JSON.stringify(value);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const pathOK = path => path === null || typeof path === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(path);
  const titleId = 'ha-tools-placement-' + Math.random().toString(36).slice(2);
  let session = null, dialog = null, destroyed = false, running = false, queued = null, returnFocus = null;
  let cancelledWrite = false;
  const text = (en, pl) => String(getHass()?.locale?.language || getHass()?.language || 'en').startsWith('pl') ? pl : en;
  function identity() {
    const hass = getHass();
    if (!host.isConnected || hass?.connected === false || !hass?.connection || hass.connection.connected === false ||
        typeof hass.callWS !== 'function' || typeof hass.user?.id !== 'string' || !hass.user.id ||
        hass.user.is_admin !== true || hass.user.is_active === false) return null;
    const card = clone(getCardConfig());
    if (!object(card) || !allowed.includes(card.type)) return null;
    return {connection:hass.connection, user:hass.user.id, card, signature:key(card), source:key(getSourceKey())};
  }
  function current(s, intent = s?.intent) {
    if (!s || session !== s || destroyed || s.intent !== intent) return false;
    if (!dialog?.isConnected) { close(); return false; }
    let live;
    try { live = identity(); } catch (_) { live = null; }
    if (!live || live.connection !== s.connection || live.user !== s.user || live.signature !== s.signature || live.source !== s.source) {
      close(); // Purge private snapshots and detached previews on identity/source revocation.
      return false;
    }
    return true;
  }
  // Single raw operation lane, including reads. Replacement intent never starts
  // another operation while a previous promise is unsettled, even after close().
  function enqueue(task) { queued = task; pump(); }
  async function pump() {
    if (running || !queued || destroyed) return;
    const task = queued; queued = null; running = true; paint();
    try { await task(); } catch (_) { /* Tasks expose localized states, never raw backend/private errors. */ }
    finally { running = false; paint(); pump(); }
  }
  async function call(s, intent, type, extra = {}) {
    if (!current(s, intent)) throw Error('cancelled');
    const message = {type, ...extra};
    if (type !== 'lovelace/dashboards/list' && s.target !== null) message.url_path = s.target;
    // Native HA performs fresh require_admin authorization independently.
    let value;
    try { value = await getHass().callWS(message); }
    catch (error) {
      if (['unauthorized','not_allowed','forbidden'].includes(error?.code) && session === s) close();
      throw error;
    }
    if (!current(s, intent)) throw Error('cancelled');
    return value;
  }
  function read(s, intent) { return call(s, intent, 'lovelace/config', {force:true}); }
  function validateConfig(config) {
    if (!object(config) || !Array.isArray(config.views) && !object(config.strategy)) throw Error('invalid_config');
    return clone(config);
  }
  function destination(s) {
    const config = s.baseline, view = config?.views?.[s.view];
    if (!object(config) || config.strategy || !object(view) || view.strategy) return null;
    const type = view.type || (view.panel === true ? 'panel' : 'masonry');
    if (type === 'sections') {
      const section = view.sections?.[s.section];
      return object(section) && !section.strategy && section.type === 'grid' &&
        (section.cards === undefined || Array.isArray(section.cards)) ? ['views',s.view,'sections',s.section,'cards'] : null;
    }
    if (type !== 'masonry' && type !== 'panel' || view.cards !== undefined && !Array.isArray(view.cards)) return null;
    if (type === 'panel' && view.cards?.length) return null;
    return ['views',s.view,'cards'];
  }
  function candidate(s) {
    const path = destination(s);
    if (!path) throw Error('readonly');
    const result = clone(s.baseline);
    let parent = result;
    for (const segment of path.slice(0,-1)) parent = parent[segment];
    parent.cards = [...(parent.cards || []), clone(s.card)];
    return result;
  }
  function clearTarget(s) {
    s.baseline = null; s.tx = null; s.previewReady = false; s.blocked = false;
    s.view = 0; s.section = 0; s.status = 'select';
    dialog?.querySelector('[data-preview]')?.replaceChildren();
  }
  function selectDashboard(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; clearTarget(s);
    const choice = s.dashboards[Number(value)];
    if (value === '' || !choice) { s.target = undefined; paint(); return; }
    s.target = choice.url_path;
    if (choice.mode !== 'storage') { s.status = 'readonly'; paint(); return; }
    const intent = s.intent; s.status = 'loading'; paint();
    enqueue(async () => {
      if (!current(s, intent)) return;
      try {
        const config = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        s.baseline = config; s.status = 'ready'; chooseView(0);
      } catch (_) { if (current(s, intent)) { s.status = 'error'; paint(); } }
    });
  }
  function chooseView(value) {
    const s = session;
    if (!current(s) || s.writing || !s.baseline) return;
    s.intent++; s.view = Number(value); s.tx = null; s.blocked = false; s.status = 'ready';
    const sections = s.baseline.views?.[s.view]?.sections;
    s.section = Array.isArray(sections) ? sections.findIndex(section => section?.type === 'grid' && !section.strategy) : -1;
    preview(); paint();
  }
  function chooseSection(value) {
    const s = session;
    if (!current(s) || s.writing) return;
    s.intent++; s.section = Number(value); s.tx = null; s.blocked = false; s.status = 'ready'; preview(); paint();
  }
  function preview() {
    const s = session, area = dialog?.querySelector('[data-preview]');
    if (!current(s) || !area) return;
    area.replaceChildren(); s.previewReady = false;
    if (!destination(s)) { s.status = 'readonly'; return; }
    // The allowlist is intersected with the concrete Data type. No user HTML,
    // YAML forms, guessed dialog imports, or arbitrary custom-element names.
    const name = s.card.type.slice(7);
    if (!host.ownerDocument.defaultView.customElements.get(name)) { s.status = 'previewerror'; return; }
    try {
      const card = host.ownerDocument.createElement(name);
      // Prevent interactions in the visual preview from invoking card actions.
      card.preview = true; card.inert = true; card.setAttribute('inert',''); card.setConfig(clone(s.card)); card.hass = getHass();
      card.style.display='block';card.style.width=s.card.grid_options?.columns===6?'50%':'100%';
      area.append(card); s.previewReady = true;
    } catch (_) { area.replaceChildren(); s.status = 'previewerror'; }
  }
  async function confirm(s, intent) {
    const value = validateConfig(await read(s, intent));
    if (!current(s, intent)) return;
    const tx = s.tx;
    if (key(value) === key(tx.expected)) {
      s.baseline = clone(value); s.blocked = true;
      if (tx.undoing) { s.tx = null; s.status = 'undone'; }
      else { tx.confirmed = clone(value); s.status = 'confirmed'; }
    } else { s.status = 'unconfirmed'; s.blocked = true; }
  }
  function write(undoing) {
    const s = session;
    if (!current(s) || running || s.writing || !s.baseline || s.target === undefined) return;
    if (undoing ? !s.tx?.confirmed : s.blocked || !s.previewReady || !destination(s)) return;
    const intent = s.intent, expectedCurrent = clone(undoing ? s.tx.confirmed : s.baseline);
    const expected = clone(undoing ? s.tx.before : candidate(s));
    const before = clone(undoing ? s.tx.before : s.baseline);
    s.writing = true; s.status = 'saving'; paint();
    enqueue(async () => {
      try {
        const latest = validateConfig(await read(s, intent));
        if (!current(s, intent)) return;
        if (key(latest) !== key(expectedCurrent)) { s.blocked = true; s.tx = null; s.status = 'conflict'; return; }
        // Private backup is detached and bound to this session's user,
        // connection and target. No persistent storage or exports.
        s.tx = {before, expected, confirmed:null, undoing}; s.blocked = true;
        // Deliberate compare-before-save, NOT atomic compare-and-swap.
        // Call exactly once, even if the response is lost or rejected.
        try { await call(s, intent, 'lovelace/config/save', {config:clone(expected)}); }
        catch (_) { if (!current(s, intent)) return; }
        if (!current(s, intent)) return;
        s.status = 'unconfirmed';
        await confirm(s, intent); // Reconcile an uncertain ACK using a read only.
      } catch (_) { if (current(s, intent)) { s.blocked = true; s.status = s.tx ? 'unconfirmed' : 'error'; } }
      finally { if (current(s, intent)) { s.writing = false; paint(); } }
    });
  }
  function reconcile() {
    const s = session;
    if (!current(s) || running || s.writing || !s.tx || s.tx.confirmed) return;
    const intent = s.intent; s.status = 'loading';
    enqueue(async () => {
      try { await confirm(s, intent); }
      catch (_) { if (current(s, intent)) s.status = 'unconfirmed'; }
    });
  }
  const messages = {
    select: ['Choose an existing dashboard.', 'Wybierz istniejący dashboard.'],
    loading: ['Loading…', 'Wczytywanie…'],
    ready: ['Preview only. Add saves this card to the selected place.', 'To podgląd. Dodaj zapisze kartę w wybranym miejscu.'],
    saving: ['Saving once and checking the result…', 'Jednorazowy zapis i sprawdzanie wyniku…'],
    confirmed: ['Save confirmed. Undo is available while nobody changes this dashboard.', 'Zapis potwierdzony. Cofnij jest dostępne, dopóki nikt nie zmieni tego dashboardu.'],
    undone: ['Original configuration restored and confirmed.', 'Przywrócenie pierwotnej konfiguracji potwierdzone.'],
    conflict: ['Dashboard changed. Nothing was overwritten. Reopen to review the current version.', 'Dashboard zmienił się. Niczego nie nadpisano. Otwórz ponownie, aby sprawdzić bieżącą wersję.'],
    unconfirmed: ['Save unconfirmed. Do not repeat Add. Check the result using read only.', 'Zapis niepotwierdzony. Nie powtarzaj Dodaj. Sprawdź wynik przez sam odczyt.'],
    error: ['Cannot load or compare the dashboard. Reopen to review it.', 'Nie można wczytać lub porównać dashboardu. Otwórz ponownie, aby go sprawdzić.'],
    readonly: ['Read-only here: YAML, strategy, occupied Panel or unsupported layout. Use the native HA editor.', 'Tutaj tylko odczyt: YAML, strategia, zajęty Panel lub nieobsługiwany układ. Użyj natywnego edytora HA.'],
    previewerror: ['Card preview unavailable. Add is disabled.', 'Podgląd karty jest niedostępny. Dodaj jest wyłączone.']
  };
  function options(select, choices, value) {
    // Preserve focused native select nodes and avoid rebuilding their options on busy changes.
    const signature = key(choices);
    if (select._choices !== signature) {
      select.replaceChildren();
      for (const [id, label] of choices) {
        const option = host.ownerDocument.createElement('option'); option.value = id; option.textContent = label; select.append(option);
      }
      select._choices = signature;
    }
    select.value = String(value);
  }
  function paint() {
    const s = session;
    if (!s || !dialog || !current(s)) return;
    const q = selector => dialog.querySelector(selector);
    q('h2').textContent = text('Add to dashboard', 'Dodaj do dashboardu');
    q('[data-label-dashboard]').textContent = text('Dashboard', 'Dashboard');
    q('[data-label-size]').textContent=text('Width in Sections','Szerokość w sekcji');
    q('[data-size]').disabled=s.writing || running;
    q('[data-size]').value=String(s.card.grid_options?.columns === 6 ? 6 : 12);
    q('[data-copy-label]').textContent=text('Card configuration for a YAML dashboard (copy only)','Konfiguracja karty dla dashboardu YAML (tylko kopiowanie)');
    q('[data-copy-area]').hidden=s.status!=='readonly';
    q('[data-copy-config]').value=JSON.stringify(s.card,null,2);
    q('[data-copy]').textContent=text('Copy card configuration','Kopiuj konfigurację karty');
    q('[data-label-view]').textContent = text('View', 'Widok'); q('[data-label-section]').textContent = text('Section', 'Sekcja');
    q('[data-preview-label]').textContent = text('Card preview (destination layout may resize it)', 'Podgląd karty (układ miejsca docelowego może zmienić rozmiar)');
    q('[data-limit]').textContent = (cancelledWrite ? text('A previous save was cancelled while pending and may have completed. Inspect the dashboard in HA before another Add. ', 'Poprzedni zapis anulowano w trakcie i mógł się zakończyć. Przed kolejnym Dodaj sprawdź dashboard w HA. ') : '') + text('You can undo this addition until this window closes.', 'Możesz cofnąć dodanie karty do zamknięcia tego okna.');
    q('[role=status]').textContent = text(...messages[s.status]);
    const selected = s.dashboards.findIndex(d => d.url_path === s.target);
    options(q('[data-dashboard]'), [['',text('Choose…','Wybierz…')],...s.dashboards.map((d,i)=>[String(i),d.title])], selected < 0 ? '' : selected);
    options(q('[data-view]'), (s.baseline?.views || []).map((v,i)=>[String(i),v.title || v.path || text(`View ${i+1}`,`Widok ${i+1}`)]), s.view);
    const sections = s.baseline?.views?.[s.view]?.sections;
    options(q('[data-section]'), Array.isArray(sections) ? sections.flatMap((v,i)=>v?.type === 'grid' && !v.strategy ? [[String(i),v.title || text(`Section ${i+1}`,`Sekcja ${i+1}`)]] : []) : [], s.section);
    q('[data-section-label]').hidden = !Array.isArray(sections);
    q('[data-dashboard]').disabled = s.writing || !s.dashboards.length;
    q('[data-view]').disabled = s.writing || !s.baseline;
    q('[data-section]').disabled = s.writing || !s.baseline;
    q('[data-add]').textContent = text('Add','Dodaj');
    q('[data-add]').disabled = running || s.writing || s.blocked || !s.previewReady || !destination(s);
    q('[data-undo]').textContent = text('Undo','Cofnij'); q('[data-undo]').disabled = running || s.writing || !s.tx?.confirmed;
    q('[data-reconcile]').textContent = text('Check result (read only)','Sprawdź wynik (tylko odczyt)');
    q('[data-reconcile]').hidden = !s.tx || !!s.tx.confirmed; q('[data-reconcile]').disabled = running || s.writing;
    q('[data-cancel]').textContent = text('Cancel','Anuluj');
    const native = q('[data-native]'); native.textContent = text('Open dashboard in Home Assistant','Otwórz dashboard w Home Assistant');
    native.hidden = s.target === undefined;
    native.setAttribute('href', s.target === undefined ? '/lovelace' : `/${s.target || 'lovelace'}`);
  }
  function mount() {
    dialog = host.ownerDocument.createElement('dialog');
    dialog.setAttribute('data-ha-tools-placement','');
    dialog.setAttribute('aria-labelledby',titleId);
    dialog.setAttribute('aria-describedby',titleId+'-limit');
    dialog.innerHTML = `<style>
dialog[data-ha-tools-placement]{box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--divider-color,#888);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color,#fff);color:var(--primary-text-color,#202124);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}dialog[data-ha-tools-placement]::backdrop{background:rgba(0,0,0,.45)}dialog[data-ha-tools-placement] h2{font-size:20px;margin:0 0 16px}dialog[data-ha-tools-placement] label{display:block;margin:12px 0}dialog[data-ha-tools-placement] select,dialog[data-ha-tools-placement] button,dialog[data-ha-tools-placement] a{box-sizing:border-box;min-height:44px;font:inherit}dialog[data-ha-tools-placement] select{width:100%;padding:8px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px}dialog[data-ha-tools-placement] button{padding:10px 16px;background:var(--secondary-background-color,#eee);color:inherit;border:1px solid var(--divider-color,#888);border-radius:8px;cursor:pointer}dialog[data-ha-tools-placement] button:disabled{opacity:.55;cursor:default}dialog[data-ha-tools-placement] [data-add]{background:var(--primary-color,#1565c0);color:var(--text-primary-color,#fff)}dialog[data-ha-tools-placement] button:focus-visible,dialog[data-ha-tools-placement] select:focus-visible,dialog[data-ha-tools-placement] a:focus-visible{outline:3px solid var(--primary-color,#1565c0);outline-offset:2px}dialog[data-ha-tools-placement] [data-actions]{display:flex;gap:8px;flex-wrap:wrap}dialog[data-ha-tools-placement] [data-preview]{max-width:100%;overflow:hidden}dialog[data-ha-tools-placement] [data-meta]{font-size:12px;color:var(--secondary-text-color,#555)}dialog[data-ha-tools-placement] a{display:inline-flex;align-items:center;color:var(--primary-color,#1565c0)}dialog[data-ha-tools-placement] [hidden]{display:none!important}
      dialog[data-ha-tools-placement] textarea{box-sizing:border-box;width:100%;min-height:140px;background:var(--secondary-background-color,#eee);color:inherit;font:12px/1.5 ui-monospace,monospace}dialog[data-ha-tools-placement] [data-add]{background:var(--hat-primary-fill-computed,#1565c0);color:var(--hat-on-primary-computed,#fff)}
      dialog[data-ha-tools-placement] a{color:inherit;text-decoration:underline}dialog[data-ha-tools-placement] :focus-visible{outline-color:var(--primary-text-color,#202124)}
      </style><h2 id="${titleId}"></h2>
      <label><span data-label-dashboard></span><select data-dashboard></select></label>
      <label><span data-label-view></span><select data-view></select></label>
      <label data-section-label hidden><span data-label-section></span><select data-section></select></label>
      <label><span data-label-size></span><select data-size><option value="12">12</option><option value="6">6</option></select></label>
      <section data-copy-area hidden><label><span data-copy-label></span><textarea readonly data-copy-config></textarea></label><button type="button" data-copy></button></section>
      <p data-preview-label></p><div data-preview></div><p role="status" aria-live="polite"></p>
      <p data-meta data-limit id="${titleId}-limit"></p><a data-native hidden></a>
      <div data-actions><button type="button" data-add></button><button type="button" data-undo></button><button type="button" data-reconcile hidden></button><button type="button" data-cancel></button></div>`;
    dialog.querySelector('[data-dashboard]').addEventListener('change', e => selectDashboard(e.target.value));
    dialog.querySelector('[data-view]').addEventListener('change', e => chooseView(e.target.value));
    dialog.querySelector('[data-section]').addEventListener('change', e => chooseSection(e.target.value));
    dialog.querySelector('[data-size]').addEventListener('change',e=>{
      const s=session;if(!current(s)||s.writing||running||s.tx)return;
      s.card={...s.card,grid_options:{...s.card.grid_options,columns:e.target.value==='6'?6:12}};
      s.intent++;preview();paint();
    });
    dialog.querySelector('[data-copy]').addEventListener('click',async()=>{
      const s=session;if(!current(s))return;
      try{await host.ownerDocument.defaultView.navigator.clipboard.writeText(JSON.stringify(s.card,null,2));}
      catch(_){if(current(s)){const field=dialog.querySelector('[data-copy-config]');field.focus();field.select();}}
    });
    dialog.querySelector('[data-add]').addEventListener('click', () => write(false));
    dialog.querySelector('[data-undo]').addEventListener('click', () => write(true));
    dialog.querySelector('[data-reconcile]').addEventListener('click', reconcile);
    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('cancel', e => {e.preventDefault(); close();});
    dialog.addEventListener('close', () => { if (dialog && !dialog.open) close(); });
    host.append(dialog);
    createUiV3().applyTheme(host);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.open = true;
  }
  function open() {
    if (destroyed) return false;
    if (session && current(session)) { dialog.querySelector('[data-dashboard]').focus(); return true; }
    let token;
    try { token = identity(); } catch (_) { return false; }
    if (!token) return false;
    returnFocus = host.ownerDocument.activeElement;
    while (returnFocus?.shadowRoot?.activeElement) returnFocus = returnFocus.shadowRoot.activeElement;
    const s = {...token,intent:0,dashboards:[],target:undefined,baseline:null,tx:null,view:0,section:0,writing:false,blocked:false,previewReady:false,status:'loading'};
    session = s; mount(); paint();
    dialog.querySelector('[data-cancel]').focus();
    enqueue(async () => {
      if (!current(s)) return;
      const intent = s.intent;
      try {
        const result = await call(s, intent, 'lovelace/dashboards/list');
        if (!current(s, intent)) return;
        if (!Array.isArray(result)) throw Error('invalid_dashboards');
        const mode = getHass()?.panels?.lovelace?.config?.mode;
        const list = mode === 'storage' || mode === 'yaml' ? [{url_path:null,title:text('Default dashboard','Domyślny dashboard'),mode}] : [];
        for (const d of result) if (object(d) && typeof d.url_path === 'string' && pathOK(d.url_path) && !list.some(v=>v.url_path===d.url_path)) {
          list.push({url_path:d.url_path,title:typeof d.title === 'string' ? d.title : d.url_path,mode:d.mode});
        }
        s.dashboards = list; s.status = list.length ? 'select' : 'readonly';
      } catch (_) { if (current(s, intent)) s.status = 'error'; }
    });
    return true;
  }
  function close() {
    const old = session; session = null; queued = null;
    // In-flight promise cannot be cancelled at HA. The lane remains occupied
    // until it settles; its continuation cannot render, read or write again.
    if (old) { if (old.writing && old.tx) cancelledWrite = true; old.intent++; old.baseline = null; old.tx = null; old.card = null; old.dashboards = []; }
    const node = dialog; dialog = null; node?.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
    if (old) onClose();
  }
  function update() {
    if (!session || !current(session)) return;
    const card = dialog.querySelector('[data-preview]')?.firstElementChild;
    if (card) card.hass = getHass();
    paint();
  }
  function destroy() { close(); destroyed = true; }
  return {open,close,destroy,update,sourceDisconnected:()=>{close();return false;},acceptsOwnRemount:() => !!session?.tx && current(session)};
}
// END VENDORED ha-tools-dashboard-placement.js

class HADataExporter extends HTMLElement {
  constructor() {
    super();
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this.attachShadow({ mode: 'open' });
    // --- Throttle fields ---
    this._lastRenderTime = 0;
    this._renderScheduled = false;
    this._renderTimer = null;
    this._firstHassRender = false;
    // --- Pagination ---
    this._currentPage = 0;
    this._tabPages = {};
    this._pageSize = 15;
    this._hass = null;
    this._identityEpoch = 0;
    this._exportRevision = 0;
    this._exportSignature = null;
    this._exportHandles = new WeakMap();
    this._exportHandleSequence = 0;
    this._exportDialog = null;
    this._exportMode = 'all';
    this._exportConnection = null;
    this._exportConnectionListener = null;
    this._exportTransportOffline = false;
    this._exportBrowserOffline = navigator.onLine === false;
    this._exportBrowserListeners = null;
    this._config = {};
    this._selectedEntities = new Set();
    this._filterDomain = 'all';
    this._filterSearch = '';
    this._filterArea = 'all';
    this._filterDevice = 'all';
    this._registryMetadata = null;
    this._registryPromise = null;
    this._registryStatus = 'idle';
    this._exportColumns = null;
    this._comparison = [null, null];
    this._snapshotScope = '';
    this._legacySnapshots = [];
    this._sortBy = 'entity_id';
    this._sortAsc = true;
    this._expandedEntities = new Set();
    this._historyCache = {};
    this._includeAttrsInExport = true;
    // Snapshot system
    this._snapshots = [];
    this._snapshotTimer = null;
    this._snapshotSettings = { enabled: false, interval: 60, maxSnapshots: 50 };
    this._loadSnapshotSettings();
    this._loadSnapshots();
    for (const eventName of ['input', 'change', 'click']) this.shadowRoot.addEventListener(eventName, event => {
      if (event.composedPath().some(node => node?.hasAttribute?.('data-ha-tools-export'))) return;
      this._syncExportContext();
    });
  }

  // --- Snapshot persistence ---
  _snapshotKey() { return 'ha-data-exporter-snapshots-' + (this._config.storage_key || 'default') + (this._snapshotScope || ''); }

  _sanitize(str) {
    if (!str) return str;
    try { return decodeURIComponent(escape(str)); } catch(e) { return str; }
  }

  _settingsKey() { return 'ha-data-exporter-settings-' + (this._config.storage_key || 'default') + (this._snapshotScope || ''); }

  _loadSnapshotSettings() {
    try {
      const raw = localStorage.getItem(this._settingsKey());
      if (raw) this._snapshotSettings = { ...this._snapshotSettings, ...JSON.parse(raw) };
    } catch(e) { console.debug('[ha-data-exporter] caught:', e); }
  }

  _saveSnapshotSettings() {
    try { localStorage.setItem(this._settingsKey(), JSON.stringify(this._snapshotSettings)); } catch(e) { console.debug('[ha-data-exporter] caught:', e); }
  }

  _loadSnapshots() {
    try {
      const raw = localStorage.getItem(this._snapshotKey());
      if (raw) this._snapshots = JSON.parse(raw);
    } catch(e) { this._snapshots = []; }
  }

  _saveSnapshots() {
    try {
      // Trim to max
      while (this._snapshots.length > this._snapshotSettings.maxSnapshots) this._snapshots.shift();
      localStorage.setItem(this._snapshotKey(), JSON.stringify(this._snapshots));
    } catch(e) { /* storage full - trim more */
      this._snapshots = this._snapshots.slice(-10);
      try { localStorage.setItem(this._snapshotKey(), JSON.stringify(this._snapshots)); } catch(e2) { console.debug('[ha-data-exporter] caught:', e); }
    }
  }

  _takeSnapshot() {
    if (!this._hass) return;
    const states = this._hass.states;
    const snap = { ts: new Date().toISOString(), entities: {} };
    // Only snapshot entities that have meaningful state changes
    Object.entries(states).forEach(([id, s]) => {
      snap.entities[id] = {
        state: s.state,
        // Preserve the decision made from this historical label, even if the
        // entity is later renamed or removed. Never export the label itself.
        export_state: this._credentialEntity(id, s.attributes?.friendly_name)
          ? null : this._safeExportState(s.state, id.split('.')[0]),
        attrs: Object.keys(s.attributes).filter(k => k !== 'friendly_name' && k !== 'icon').length
      };
    });
    const compared = this._comparison.map(index => index === null ? null : this._snapshotChoices()[index]);
    this._snapshots.push(snap);
    this._saveSnapshots();
    this._comparison = compared.map(snapshot => { const index = snapshot ? this._snapshotChoices().indexOf(snapshot) : -1; return index < 0 ? null : index; });
    this._updateSnapshotStatus();
    this._refreshComparisonControls();
  }

  _startAutoSnapshot() {
    this._stopAutoSnapshot();
    if (this.preview) return;
    if (!this._snapshotSettings.enabled) return;
    const intervalMs = (this._snapshotSettings.interval || 60) * 1000;
    this._takeSnapshot(); // Take one immediately
    this._snapshotTimer = setInterval(() => this._takeSnapshot(), intervalMs);
  }

  _stopAutoSnapshot() {
    if (this._snapshotTimer) { clearInterval(this._snapshotTimer); this._snapshotTimer = null; }
  }

  _clearSnapshots() {
    this._snapshots = [];
    this._saveSnapshots();
    this._comparison = [null, null];
    this._legacySnapshots = [];
    this._refreshComparisonControls();
  }

  _getEntityHistory(entityId) {
    const history = [];
    this._snapshots.forEach(snap => {
      const e = snap.entities[entityId];
      if (e) history.push({ ts: snap.ts, state: e.state, attrs: e.attrs });
    });
    return history;
  }

  _updateSnapshotStatus() {
    const el = this.shadowRoot ? this.shadowRoot.getElementById('snapshotStatus') : null;
    if (el) el.textContent = this._snapshots.length + ' ' + this._t.savedSnapshots;
  }

  connectedCallback() {
    this._bindExportBrowserLifecycle();
    this._bindExportConnection(this._hass?.connection);
    this._syncExportContext();
    this._refreshDashboardAction();
    createUiV3().applyTheme(this);
    if (this._hass && this._snapshotSettings.enabled) this._startAutoSnapshot();
  }

  disconnectedCallback() {
    this._dashboardPlacement?.sourceDisconnected();
    this._destroyExportDialog();
    this._unbindExportConnection();
    this._unbindExportBrowserLifecycle();
    this._syncExportContext();
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;
    this._renderScheduled = false;
    this._stopAutoSnapshot();
  }

  set hass(hass) {
    try {
      var _bg = (getComputedStyle(this).getPropertyValue('--card-background-color') || getComputedStyle(this).getPropertyValue('--primary-background-color') || '').trim();
      var _d = false;
      if (_bg) {
        var _h, _r, _g, _b, _m;
        if (_bg.charAt(0) === '#') { _h = _bg.slice(1); if (_h.length === 3) _h = _h.replace(/(.)/g, '$1$1'); _r = parseInt(_h.slice(0,2),16); _g = parseInt(_h.slice(2,4),16); _b = parseInt(_h.slice(4,6),16); }
        else { _m = _bg.match(/[\d.]+/g); if (_m) { _r = +_m[0]; _g = +_m[1]; _b = +_m[2]; } }
        if (_r != null) _d = (0.2126*_r + 0.7152*_g + 0.0722*_b) / 255 < 0.5;
      } else if (hass && hass.themes) { _d = !!hass.themes.darkMode; }
      this.classList.toggle('bento-dark', typeof hass?.themes?.darkMode === 'boolean' ? hass.themes.darkMode : _d);
      createUiV3().applyTheme(this);
      this._exportDialog?.updateTheme();
    } catch (e) {}

    const previousLanguage = this._lang;
    const previousLocale = this._presentationLocale;
    this._presentationLocale = hass?.locale?.language || hass?.language || navigator.language;
    const nextFormat = createFormatUi.forHass(hass);
    const formatChanged = this._formatUi?.key !== nextFormat.key;
    this._formatUi = nextFormat;
    const identity = h => JSON.stringify([h?.user?.id || null, !!h?.user?.is_admin, !!h?.user?.is_owner]);
    const identityChanged = identity(this._hass) !== identity(hass) || this._hass?.connection !== hass?.connection;
    if (identityChanged) {
      this._identityEpoch++;
      this._historyCache = {};
      this._selectedEntities.clear();
      this._expandedEntities.clear();
      this._registryMetadata = null;
      this._registryPromise = null;
      this._registryStatus = 'idle';
      this._filterArea = this._filterDevice = 'all';
      this._comparison = [null, null];
      this._legacySnapshots = [];
      this.shadowRoot.getElementById('exportPreview')?.replaceChildren();
      this.shadowRoot.getElementById('previewScope')?.replaceChildren();
      this._stopAutoSnapshot();
      const server = hass?.auth?.data?.hassUrl || hass?.connection?.options?.url || location.origin;
      this._snapshotScope = hass?.user?.id ? ':' + encodeURIComponent(server) + ':' + encodeURIComponent(hass.user.id) : '';
      this._snapshots = [];
      this._snapshotSettings = { enabled: false, interval: 60, maxSnapshots: 50 };
      if (hass) { this._loadSnapshotSettings(); this._loadSnapshots(); }
    }
    const language = hass?.locale?.language || hass?.language;
    if (language) this._lang = language.startsWith('pl') ? 'pl' : 'en';
    this._hass = hass;
    this._dashboardPlacement?.update();
    this._refreshDashboardAction();
    this._bindExportConnection(hass?.connection);
    this._syncExportContext();
    if (!this._exportConnected()) this._exportDialog?.cancel();
    if (!hass) {
      this._stopAutoSnapshot();
      this.shadowRoot.replaceChildren();
      this._firstHassRender = false;
      return;
    }
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this._render();
      this._updateEntities();
      this._lastRenderTime = now;
      return;
    }
    const support = this.shadowRoot.querySelector('.donate-section[data-source="own-card"]');
    const showSupport = hass.user?.is_admin && this._config.show_support !== false && !_localSupportDismissed();
    if (!showSupport) support?.remove();
    else if (!support) {
      this.shadowRoot.querySelector('.card')?.insertAdjacentHTML('afterend', _renderLocalSupport(this._lang));
      _bindLocalSupportDismiss(this.shadowRoot);
    }
    if (identityChanged) {
      this.shadowRoot.querySelector('.intro-banner')?.remove();
      if (this._config.show_help !== false) {
        this.shadowRoot.querySelector('.card')?.insertAdjacentHTML('beforebegin', _renderLocalIntro(this._lang, hass.user?.id));
        _bindLocalIntroDismiss(this.shadowRoot, hass.user?.id);
      }
      // Settings belong to the newly loaded namespace; update existing controls
      // without replacing the card or waiting for another hass setter.
      const enabled = this.shadowRoot.getElementById('snapshotEnabled');
      if (enabled) enabled.checked = this._snapshotSettings.enabled;
      for (const [id, value] of [['snapshotInterval', this._snapshotSettings.interval], ['snapshotMax', this._snapshotSettings.maxSnapshots]]) {
        const control = this.shadowRoot.getElementById(id);
        if (control) control.value = String(value);
      }
      this._updateSnapshotStatus();
      this._refreshComparisonControls();
      this._refreshSettingsInfo();
      if (this.isConnected && this._snapshotSettings.enabled) this._startAutoSnapshot();
    }
    if (previousLanguage !== this._lang || previousLocale !== this._presentationLocale) this._refreshLocaleControls();
    else if (identityChanged) this._updateEntities();
    else if (formatChanged) this._refreshPresentationTimes();
    if (now - (this._lastRenderTime || 0) < 10000) {
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        this._renderTimer = setTimeout(() => {
          this._renderTimer = null;
          if (!this.isConnected) return;
          this._renderScheduled = false;
          this._updateEntities();
          this._lastRenderTime = Date.now();
        }, 5000 - (now - (this._lastRenderTime || 0)));
      }
      return;
    }
    this._updateEntities();
    this._lastRenderTime = now;
  }


  _refreshLocaleControls() {
    _refreshLocalGuidance(this.shadowRoot, this._lang);
    this.shadowRoot.querySelectorAll('[data-column-move]').forEach(button => { const text = this._lang === 'pl' ? (button.dataset.columnMove === '-1' ? 'W górę' : 'W dół') : (button.dataset.columnMove === '-1' ? 'Move up' : 'Move down'); button.textContent = text; button.setAttribute('aria-label', `${text}: ${button.dataset.columnKey}`); });
    // Update translated controls in place: export choices and focused inputs keep their DOM.
    const t = this._t;
    const attributes = this.shadowRoot.getElementById('includeAttrs');
    if (attributes) attributes.setAttribute('aria-label', t.attributes);
    const attributesLabel = attributes?.parentElement;
    if (attributesLabel?.lastChild?.nodeType === Node.TEXT_NODE) attributesLabel.lastChild.textContent = ' ' + t.attributes;
    for (const [id, label] of [['snapshotNow', t.takeSnapshot], ['snapshotClear', t.clearSnapshots]]) {
      const button = this.shadowRoot.getElementById(id);
      if (button) { button.title = label; button.setAttribute('aria-label', label); }
    }
    const settings = this.shadowRoot.getElementById('deGoSettingsBtn');
    if (settings) settings.textContent = '\u2699\uFE0F ' + t.settings;
    this._refreshSettingsInfo();
    const interval = this.shadowRoot.getElementById('snapshotInterval');
    const labels = { 30: t.snapshotInterval30s, 60: t.snapshotInterval1min, 300: t.snapshotInterval5min, 900: t.snapshotInterval15min, 3600: t.snapshotInterval1h };
    for (const option of interval?.options || []) option.textContent = labels[option.value] || option.textContent;
    const search = this.shadowRoot.getElementById('searchFilter');
    if (search) { search.placeholder = t.searchEntities; search.setAttribute('aria-label', t.searchEntities); }
    const exportAll = this.shadowRoot.getElementById('exportAllBtn');
    if (exportAll) exportAll.textContent = t.exportAll;
    const selectAll = this.shadowRoot.getElementById('selectAll');
    if (selectAll) { selectAll.title = t.selectAll; selectAll.setAttribute('aria-label', t.selectAll); }
    const snapshots = this.shadowRoot.getElementById('snapshotEnabled');
    if (snapshots?.parentElement?.lastChild?.nodeType === Node.TEXT_NODE) snapshots.parentElement.lastChild.textContent = ' ' + t.snapshotsTitle;
    const headers = { entity_id: t.entityId, name: t.name, state: t.state, domain: t.domain, attrCount: t.attrs };
    for (const th of this.shadowRoot.querySelectorAll('th[data-sort]')) {
      const label = th.querySelector('[data-sort-label]');
      if (label) label.textContent = headers[th.dataset.sort];
    }
    this._updateSnapshotStatus();
    this._updateEntities();
  }

  _refreshSettingsInfo() {
    const info = this.shadowRoot.getElementById('settingsInfo');
    if (!info) return;
    const PL = this._lang === 'pl';
    info.textContent = this._hass?.user?.is_admin
      ? (PL ? 'Edytuj panel → edytuj kartę. Edytor wizualny pozwala zmienić tytuł, domeny, format, wielkość strony, atrybuty i klucz snapshotów; dodatkowe opcje ustaw w YAML karty. Format eksportu, atrybuty i snapshoty zmienisz poniżej.'
        : 'Edit dashboard → edit card. The visual editor changes the title, domains, format, page size, attributes and snapshot key; set additional options in the card YAML. Change the export format, attributes and snapshots below.')
      : (PL ? 'Poproś administratora o zmianę konfiguracji karty. Format eksportu, atrybuty i snapshoty zmienisz poniżej.'
        : 'Ask an administrator to change the card configuration. Change the export format, attributes and snapshots below.');
  }

  get _t() {
    const T = {
      pl: {
        allDomains: 'Wszystkie domeny', searchEntities: 'Szukaj encji...', exportSelected: 'Eksportuj wybrane', exportAll: 'Eksportuj wszystko',
        entityId: 'ID encji', name: 'Nazwa', state: 'Stan', domain: 'Domena', attrs: 'Atrybuty', entities: 'encji',
        selectAll: 'Zaznacz wszystkie', selectEntity: 'Zaznacz encję', showAttributes: 'Pokaż atrybuty', noAttributes: 'Brak atrybutów', noEntities: 'Nie znaleziono encji',
        previous: 'Poprzednia', next: 'Następna', page: 'Strona', of: 'z', show: 'Pokaż:',
        title: 'Eksporter Danych',
        loading: 'Wczytywanie...',
        noData: 'Brak danych',
        error: 'B\u0142\u0105d',
        refresh: 'Od\u015bwie\u017c',
        save: 'Zapisz',
        cancel: 'Anuluj',
        settings: 'Ustawienia',
        savedSnapshots: 'zapisanych',
        attributes: 'Atrybuty',
        takeSnapshot: 'Zr\u00f3b snapshot teraz',
        clearSnapshots: 'Wyczy\u015b\u0107 snapshoty',
        snapshotInterval30s: 'co 30s',
        snapshotInterval1min: 'co 1 min',
        snapshotInterval5min: 'co 5 min',
        snapshotInterval15min: 'co 15 min',
        snapshotInterval1h: 'co 1h',
        stateHistory: 'Historia stan\u00f3w (24h z HA)',
        snapshotsTitle: 'Snapshoty',
        snapshots: 'zapis\u00f3w',
        clickToLoad: 'Kliknij aby za\u0142adowa\u0107...',
        loadingHistory: '\u0141adowanie historii...',
        loadHistoryError: 'Nie uda\u0142o si\u0119 pobra\u0107 historii:',
        noStateChanges: 'Brak historii zmian w ostatnich 24h',
        now: 'teraz',
        locale: (this._lang === 'pl' ? 'pl-PL' : 'en-US'),
      },
      en: {
        allDomains: 'All domains', searchEntities: 'Search entities...', exportSelected: 'Export Selected', exportAll: 'Export All',
        entityId: 'Entity ID', name: 'Name', state: 'State', domain: 'Domain', attrs: 'Attrs', entities: 'entities',
        selectAll: 'Select all', selectEntity: 'Select entity', showAttributes: 'Show attributes', noAttributes: 'No attributes', noEntities: 'No entities found',
        previous: 'Prev', next: 'Next', page: 'Page', of: 'of', show: 'Show:',
        title: 'Data Exporter',
        loading: 'Loading...',
        noData: 'No data',
        error: 'Error',
        refresh: 'Refresh',
        save: 'Save',
        cancel: 'Cancel',
        settings: 'Settings',
        savedSnapshots: 'saved',
        attributes: 'Attributes',
        takeSnapshot: 'Take snapshot now',
        clearSnapshots: 'Clear snapshots',
        snapshotInterval30s: 'every 30s',
        snapshotInterval1min: 'every 1 min',
        snapshotInterval5min: 'every 5 min',
        snapshotInterval15min: 'every 15 min',
        snapshotInterval1h: 'every 1h',
        stateHistory: 'State history (24h from HA)',
        snapshotsTitle: 'Snapshots',
        snapshots: 'entries',
        clickToLoad: 'Click to load...',
        loadingHistory: 'Loading history...',
        loadHistoryError: 'Failed to load history:',
        noStateChanges: 'No state changes in the last 24h',
        now: 'now',
        locale: 'en-US',
      },
    };
    return T[this._lang] || T.en;
  }

  setConfig(config) {
    config = JSON.parse(JSON.stringify(config || {}));
    const tabs = config.tabs ?? ['export','records'];
    if (!Array.isArray(tabs) || !tabs.length || tabs.some(tab => !['export','records'].includes(tab)) || new Set(tabs).size !== tabs.length)
      throw new Error('tabs must contain export and/or records once');
    if (config.default_tab !== undefined && !tabs.includes(config.default_tab))
      throw new Error('default_tab must name an enabled tab');
    this._workspaceTab = config.default_tab ?? tabs[0];
    const previousSnapshotKey = this._snapshotKey();
    this._config = {
      title: config.title || 'Data Exporter',
      default_format: config.default_format || 'csv',
      show_attributes: config.show_attributes !== false,
      show_select_all: config.show_select_all !== false,
      page_size: config.page_size || 50,
      domains: config.domains || null,
      ...config
    };
    if (this._snapshotKey() !== previousSnapshotKey) {
      this._stopAutoSnapshot();
      this._snapshots = [];
      this._snapshotSettings = { enabled: false, interval: 60, maxSnapshots: 50 };
      this._loadSnapshotSettings();
      this._loadSnapshots();
      this._comparison = [null, null];
      this._legacySnapshots = [];
      this._identityEpoch++;
      this._registryPromise = null;
      this._registryMetadata = null;
    }
    this._includeAttrsInExport = this._config.show_attributes !== false;
    // page_size is documented in the README but was never applied — the card
    // kept its hardcoded default. Honour it (the in-card selector still wins
    // afterwards, since it writes _pageSize directly).
    const ps = parseInt(this._config.page_size, 10);
    if (!isNaN(ps) && ps > 0) this._pageSize = ps;
    if (this._hass) {
      this._render();
      this._updateEntities();
    }
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_rows: 3, min_columns: 6 };
  }

  static getConfigElement() {
    return document.createElement('ha-data-exporter-editor');
  }

  static getStubConfig() {
    return {
      title: 'Data Exporter',
      default_format: 'csv',
      show_attributes: true
    };
  }

  _getFilteredEntities(includeUIFilters = true) {
    if (!this._hass) return [];
    let entities = Object.keys(this._hass.states).map(id => {
      const state = this._hass.states[id];
      return {
        entity_id: id,
        domain: id.split('.')[0],
        name: state.attributes.friendly_name || id,
        state: state.state,
        last_changed: state.last_changed,
        attributes: state.attributes
      };
    });

    if (this._config.domains) {
      entities = entities.filter(e => this._config.domains.includes(e.domain));
    }

    if (includeUIFilters && this._filterDomain !== 'all') {
      entities = entities.filter(e => e.domain === this._filterDomain);
    }

    if (includeUIFilters && (this._filterArea !== 'all' || this._filterDevice !== 'all')) {
      entities = entities.filter(e => {
        if (!this._registryMetadata) return false;
        const entry = this._registryMetadata.entities.get(e.entity_id);
        const deviceId = entry?.device_id || '';
        const areaId = entry?.area_id || this._registryMetadata.devices.get(deviceId)?.area_id || '';
        return (this._filterArea === 'all' || (this._filterArea === '__none__' ? !areaId : areaId === this._filterArea))
          && (this._filterDevice === 'all' || (this._filterDevice === '__none__' ? !deviceId : deviceId === this._filterDevice));
      });
    }

    if (includeUIFilters && this._filterSearch) {
      const search = this._filterSearch.toLowerCase();
      entities = entities.filter(e =>
        e.entity_id.toLowerCase().includes(search) ||
        e.name.toLowerCase().includes(search) ||
        String(e.state ?? '').toLowerCase().includes(search)
      );
    }

    entities.sort((a, b) => {
      let valA, valB;
      if (this._sortBy === 'attrCount') {
        valA = a.attributes ? Object.keys(a.attributes).length : 0;
        valB = b.attributes ? Object.keys(b.attributes).length : 0;
        const cmp = valA - valB;
        return this._sortAsc ? cmp : -cmp;
      }
      valA = a[this._sortBy] || '';
      valB = b[this._sortBy] || '';
      const cmp = this._collator().compare(String(valA), String(valB));
      return this._sortAsc ? cmp : -cmp;
    });

    return entities;
  }

  _getSelectedEntities() {
    return this._getFilteredEntities(false).filter(e => this._selectedEntities.has(e.entity_id));
  }

  _getDomains() {
    if (!this._hass) return [];
    const domains = new Set();
    Object.keys(this._hass.states).forEach(id => domains.add(id.split('.')[0]));
    return [...domains].sort();
  }

  _render() {
    this._destroyExportDialog();
    this._syncExportContext();
    if (!this._hass) return;
    const L = this._lang === 'pl';
    const format = this._config.default_format;
    this.shadowRoot.innerHTML = `
      <style>${HA_DATA_EXPORTER_BENTO_CSS}
/* === HA Tools split — premium banners (donate / intro / prereq) === */

/* Donation footer — diamond top */
.donate-section {  margin: 24px 0 4px; padding: 20px 24px; position: relative; overflow: hidden;  background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.18); border-radius: var(--bento-radius-md, 18px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;  font-family: 'Inter', -apple-system, sans-serif;}
.donate-section:not([data-source="own-card"])::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.donate-section .donate-text { flex: 1; min-width: 240px; }
.donate-section h3 {  margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;}
.donate-section p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--bento-text-secondary, #57534e); letter-spacing: -0.005em; }
.donate-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.donate-btn {  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;  border-radius: 12px; font-weight: 700; font-size: 13px; letter-spacing: -0.005em;  text-decoration: none; transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, filter 0.2s;  border: 1px solid transparent;}
.donate-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.donate-btn.coffee {  background: linear-gradient(135deg, #FFDD00, #FFC700); color: #000;  box-shadow: 0 4px 14px -2px rgba(255, 221, 0, 0.4);}
.donate-btn.coffee:hover { box-shadow: 0 8px 24px -4px rgba(255, 221, 0, 0.55); }
.donate-btn.paypal {  background: linear-gradient(135deg, #0070ba, #005ea6); color: #fff;  box-shadow: 0 4px 14px -2px rgba(0, 112, 186, 0.45);}
.donate-btn.paypal:hover { box-shadow: 0 8px 24px -4px rgba(0, 112, 186, 0.6); }
:host(.bento-dark) .donate-section { background: linear-gradient(135deg, rgba(129,140,248,0.10), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.25); }
:host(.bento-dark) .donate-section h3 { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .donate-section p { color: #d6d3d1; }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 18px; }  .donate-buttons { justify-content: center; width: 100%; } }

/* Prereq banner — premium */
.prereq-banner {  display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;  border-radius: var(--bento-radius-sm, 12px); margin: 0 0 16px;  font-size: 13px; line-height: 1.55; border: 1px solid;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  position: relative; overflow: hidden;}
.prereq-banner::before {  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;}
.prereq-banner.prereq-error { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); color: #991b1b; }
.prereq-banner.prereq-error::before { background: linear-gradient(180deg, #ef4444, #f87171); }
.prereq-banner.prereq-info  { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.25); color: #4338ca; }
.prereq-banner.prereq-info::before  { background: linear-gradient(180deg, #6366f1, #8b5cf6); }
.prereq-banner .prereq-icon { font-size: 22px; line-height: 1; padding-top: 2px; flex-shrink: 0; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner .prereq-text strong { font-weight: 700; letter-spacing: -0.01em; }
.prereq-banner code {  background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 5px;  font-size: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace;  border: 1px solid rgba(0,0,0,0.08);}
.prereq-banner .prereq-cta {  display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 10px;  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important;  text-decoration: none; font-weight: 700; font-size: 12.5px; flex-shrink: 0;  letter-spacing: -0.005em;  box-shadow: 0 4px 14px -2px rgba(99,102,241,0.45);  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);}
.prereq-banner .prereq-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -4px rgba(99,102,241,0.6); }
:host(.bento-dark) .prereq-banner.prereq-error { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.30); color: #fca5a5; }
:host(.bento-dark) .prereq-banner.prereq-info { background: rgba(129,140,248,0.10); border-color: rgba(129,140,248,0.30); color: #c7d2fe; }
:host(.bento-dark) .prereq-banner code { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; padding-left: 20px; }  .prereq-banner .prereq-cta { align-self: flex-start; } }

/* First-run intro banner — premium */
.intro-banner {  position: relative; padding: 18px 52px 18px 22px; margin: 0 0 18px;  background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.20);  border-radius: var(--bento-radius-sm, 12px);  font-size: 13px; line-height: 1.55; overflow: hidden;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  animation: bentoSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);}
.intro-banner::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.intro-banner .intro-headline {  font-weight: 700; font-size: 14.5px; margin-bottom: 10px; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;  display: flex; align-items: center; gap: 8px;}
.intro-banner .intro-steps {  margin: 8px 0 0; padding: 0; list-style: none; counter-reset: introstep;}
.intro-banner .intro-steps li {  margin-bottom: 8px; line-height: 1.55; color: var(--bento-text, #0c0a09);  padding-left: 32px; position: relative; counter-increment: introstep;  font-size: 12.5px;}
.intro-banner .intro-steps li::before {  content: counter(introstep); position: absolute; left: 0; top: -1px;  width: 22px; height: 22px; border-radius: 50%;  background: var(--bento-card, #fff); border: 1px solid rgba(99,102,241,0.25);  display: flex; align-items: center; justify-content: center;  font-size: 11px; font-weight: 800; color: #6366f1;  font-family: 'JetBrains Mono', ui-monospace, monospace;  font-feature-settings: 'tnum' 1;}
.intro-banner .intro-dismiss {  position: absolute; top: 12px; right: 14px;  background: var(--bento-card, transparent); border: 1px solid var(--bento-border, transparent);  cursor: pointer; font-size: 14px; line-height: 1;  color: var(--bento-text-secondary, #64748B);  padding: 4px 8px; border-radius: 999px;  transition: all 0.15s ease;}
.intro-banner .intro-dismiss:hover {  background: var(--bento-bg-2, #e7e5e4); color: var(--bento-text, #0c0a09);  transform: rotate(90deg);}
:host(.bento-dark) .intro-banner { background: linear-gradient(135deg, rgba(129,140,248,0.14), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.30); }
:host(.bento-dark) .intro-banner .intro-headline { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .intro-banner .intro-steps li { color: #fafaf9; }
:host(.bento-dark) .intro-banner .intro-steps li::before { background: #16161f; border-color: rgba(129,140,248,0.35); color: #a5b4fc; }
:host(.bento-dark) .intro-banner .intro-dismiss { background: #16161f; border-color: #27272f; color: #d6d3d1; }
:host(.bento-dark) .intro-banner .intro-dismiss:hover { background: #27272f; color: #fafaf9; }


        * { box-sizing: border-box; }

/* ===== BENTO LIGHT MODE DESIGN SYSTEM ===== */

:host {
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Card */
.card, .ha-card, ha-card, .main-card, .card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
  background: var(--bento-card) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-md) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text) !important;
  overflow: visible;
  padding: 20px !important;
}

/* Headers */
.card-header, .header, .card-title, h1, h2, h3 {
  color: var(--bento-text) !important;
  font-family: 'Inter', sans-serif !important;
}
.card-header, .header {
  border-bottom: 1px solid var(--bento-border) !important;
  padding-bottom: 12px !important;
  margin-bottom: 16px !important;
}

/* Tabs */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--bento-border);
  padding: 0 4px;
  margin-bottom: 20px;
  overflow-x: auto;
}
.tab, .tab-btn, .tab-btn {
  padding: 10px 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: var(--bento-text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: var(--bento-transition);
  white-space: nowrap;
  border-radius: 0;
}
.tab:hover, .tab-btn:hover, .tab-btn:hover {
  color: var(--bento-primary);
  background: var(--bento-primary-light);
}
.tab.active, .tab-btn.active, .tab-btn.active {
  color: var(--bento-primary);
  border-bottom-color: var(--bento-primary);
  background: rgba(59, 130, 246, 0.04);
  font-weight: 600;
}

/* Tab content */
.tab-content { display: none; }
.tab-content.active { display: block; animation: bentoFadeIn 0.3s ease-out; }
@keyframes bentoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* Buttons */
button, .btn, .action-btn {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--bento-radius-xs);
  transition: var(--bento-transition);
  cursor: pointer;
}
button.active, .btn.active, .btn-primary, .action-btn.active {
  background: var(--bento-primary) !important;
  color: white !important;
  border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

/* Status badges */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-success, .status-ok, .status-good { background: var(--bento-success-light); color: var(--bento-success); }
.badge-error, .status-error, .status-critical { background: var(--bento-error-light); color: var(--bento-error); }
.badge-warning, .status-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info, .status-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* Tables */
table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Inter', sans-serif; }
th { background: var(--bento-bg); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid var(--bento-border); }
td { padding: 12px 14px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: none; }

/* Inputs & selects */
input, select, textarea {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Stat cards */
.stat-card, .stat, .metric-card, .stat-box, .overview-stat, .kpi-card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 16px;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat:hover, .metric-card:hover { box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-value, .metric-value, .stat-number { font-size: 28px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.stat-label, .metric-label, .stat-title { font-size: 12px; font-weight: 500; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

/* Canvas override (prevent Bento CSS from distorting charts) */
canvas {
  max-width: 100% !important;
  height: auto !important;
  width: auto !important;
  border: none !important;
}

/* Pagination */
.pagination, .pag {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 16px 0;
  border-top: 1px solid var(--bento-border);
}
.pagination-btn, .pag-btn {
  padding: 8px 14px;
  border: 1.5px solid var(--bento-border);
  background: var(--bento-card);
  color: var(--bento-text);
  border-radius: var(--bento-radius-xs);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
}
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-select { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); font-size: 12px; font-family: 'Inter', sans-serif; }

/* Empty state */
.empty-state, .no-data, .no-results {
  text-align: center;
  padding: 48px 24px;
  color: var(--bento-text-secondary);
  font-size: 14px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ===== END BENTO LIGHT MODE ===== */

        :host {
          --bg-color: var(--bento-card);
          --text-color: var(--bento-text);
          --secondary-text: var(--bento-text-secondary);
          --border-color: var(--bento-border);
          --hover-bg: var(--bento-primary-light);
          --accent: var(--bento-primary);
        }
        .card {
          background: var(--bg-color);
          border-radius: 12px;
          padding: 16px;
          font-family: var(--ha-card-header-font-family, inherit);
          color: var(--text-color);
          overflow: visible;
          min-width: 0;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .card-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }
        .stats {
          font-size: 12px;
          color: var(--secondary-text);
        }
        .toolbar {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .toolbar select, .toolbar input[type="text"] {
          padding: 6px 10px;
          border: 1px solid var(--bento-border);
          border-radius: 6px;
          background: var(--bento-card);
          color: var(--bento-text);
          font-size: 13px;
          outline: none;
        }
        .toolbar input[type="text"] {
          flex: 1;
          min-width: 150px;
        }
        .toolbar select:focus, .toolbar input[type="text"]:focus {
          border-color: var(--accent);
        }
        .toolbar-spacer {
          flex: 1;
          min-width: 12px;
        }
        .entity-count {
          padding: 6px 10px;
          color: var(--secondary-text);
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
        .export-option-sm {
          font-size: 12px;
          white-space: nowrap;
        }
        .entity-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .entity-table th {
          text-align: left;
          padding: 8px 6px;
          border-bottom: 2px solid var(--border-color);
          font-weight: 600;
          font-size: 12px;
          color: var(--secondary-text);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .entity-table th:hover {
          color: var(--primary-color);
        }
        .entity-table th .sort-arrow {
          font-size: 10px;
          margin-left: 2px;
        }
        .entity-table td {
          padding: 6px;
          border-bottom: 1px solid var(--border-color);
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .entity-table tr:hover {
          background: var(--hover-bg);
        }
        .entity-table td.entity-id {
          font-family: monospace;
          font-size: 12px;
        }
        .entity-table td.state-val {
          font-weight: 500;
        }
        .sort-button { appearance:none;border:0;background:transparent;color:inherit;font:inherit;text-transform:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0; }
        .sort-button:focus-visible { outline:2px solid var(--primary-color,#3b82f6);outline-offset:2px;border-radius:4px; }
        .checkbox-cell {
          width: 30px;
          text-align: center;
        }
        .checkbox-cell input {
          cursor: pointer;
          width: 16px;
          height: 16px;
          accent-color: var(--bento-primary);
        }
        .attrs-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 400;
          color: var(--bento-text, #1e293b);
          padding: 5px 0;
        }
        .attrs-toggle-input {
          margin: 0;
          accent-color: var(--bento-primary);
          cursor: pointer;
        }
        .expand-cell {
          width: 30px;
          text-align: center;
        }
        .expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--bento-text-secondary);
          transition: var(--bento-transition);
        }
        .expand-btn:hover {
          background: var(--bento-primary-light);
          color: var(--bento-primary);
        }
        .expand-btn.expanded {
          color: var(--bento-primary);
          transform: rotate(90deg);
        }
        .attr-row td {
          padding: 0 !important;
          border-bottom: 1px solid var(--bento-border) !important;
          background: var(--bento-bg) !important;
        }
        .attr-container {
          padding: 10px 14px 10px 46px;
          animation: bentoFadeIn 0.2s ease-out;
        }
        .attr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 6px 16px;
        }
        .attr-item {
          display: flex;
          gap: 8px;
          font-size: 12px;
          padding: 4px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .attr-key {
          color: var(--bento-text-secondary);
          font-weight: 600;
          min-width: 120px;
          white-space: nowrap;
          font-family: monospace;
          font-size: 11px;
        }
        .attr-val {
          color: var(--bento-text);
          word-break: break-all;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .attr-val.complex {
          font-family: monospace;
          font-size: 11px;
          background: rgba(0,0,0,0.03);
          padding: 2px 6px;
          border-radius: 4px;
          max-height: 60px;
          overflow-y: auto;
        }
        .attr-count {
          font-size: 11px;
          color: var(--bento-text-muted);
          background: var(--bento-bg);
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 500;
        }
        .history-section {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--bento-border);
        }
        .history-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--bento-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .history-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(0,0,0,0.02);
        }
        .history-item:first-child {
          background: var(--bento-primary-light);
          font-weight: 500;
        }
        .history-time {
          color: var(--bento-text-muted);
          font-family: monospace;
          font-size: 11px;
          min-width: 140px;
        }
        .history-state {
          color: var(--bento-text);
          font-weight: 500;
        }
        .history-arrow {
          color: var(--bento-text-muted);
          font-size: 10px;
        }
        .history-loading {
          font-size: 11px;
          color: var(--bento-text-muted);
          padding: 4px 0;
        }
        .page-size-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .page-size-wrap label {
          font-size: 12px;
          color: var(--bento-text-secondary);
        }
        .page-size-wrap select {
          padding: 3px 8px;
          font-size: 12px;
          border: 1px solid var(--bento-border);
          border-radius: 4px;
          background: var(--bento-card);
        }
        .export-option {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--bento-text-secondary);
        }
        .export-option input[type=checkbox] {
          accent-color: var(--bento-primary);
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary {
          background: var(--primary-color);
          color: #fff;
        }
        .btn-secondary {
          background: var(--bento-border);
          color: var(--bento-text);
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .format-select {
          padding: 8px 10px;
          border: 1px solid var(--bento-border);
          border-radius: 6px;
          background: var(--bento-card);
          color: var(--bento-text);
          font-size: 13px;
        }
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 13px;
          color: var(--secondary-text);
        }
        .pagination button {
          padding: 4px 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-color);
          color: var(--text-color);
          cursor: pointer;
          font-size: 12px;
        }
        .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .table-container {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }
        .empty-state {
          text-align: center;
          padding: 32px;
          color: var(--secondary-text);
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .card { padding: 12px; }
          .card-header { flex-direction: column; gap: 8px; }
          .card-header h2 { font-size: 16px; }
          .entity-grid { grid-template-columns: 1fr !important; }
          .filter-bar { flex-direction: column; }
          .filter-bar input, .filter-bar select { width: 100%; }
          table { font-size: 12px; }
          td, th { padding: 6px 8px; word-break: break-all; }
          .table-container { max-height: 300px; }
          .tab-bar { flex-wrap: wrap; }
          .tab { font-size: 12px; padding: 6px 10px; }
          .toolbar { flex-wrap: wrap; }
          .toolbar-spacer { display: none; }
          .btn-sm { padding: 5px 10px; font-size: 11px; }
          .export-option-sm { font-size: 11px; }
          .snapshot-bar { flex-wrap: wrap !important; }
          .export-option { white-space: nowrap; }
        }
        @media (max-width: 480px) {
          .tab { font-size: 11px; padding: 5px 8px; }
          .entity-grid { gap: 8px; }
          .toolbar input[type="text"] { min-width: 100px; }
          .toolbar select { padding: 4px 8px; font-size: 12px; }
          .btn-sm { padding: 4px 8px; font-size: 10px; }
        }
      

:host(.bento-dark) {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
/* === DARK MODE ADDED - old comment below === */

        /* === MOBILE FIX === */
        @media (max-width: 768px) {
          .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
          .tab, .tab-btn, .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
          .card, .card-container { padding: 14px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val, .kpi-val, .metric-val { font-size: 18px; }
          .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
          .panels, .board { flex-direction: column; }
          .column { min-width: unset; }
          h2 { font-size: 18px; }
          h3 { font-size: 15px; }
        }
        @media (max-width: 480px) {
          .tabs { gap: 1px; }
          .tab, .tab-btn, .tab-btn { padding: 5px 8px; font-size: 11px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: 1fr 1fr; }
          .stat-val, .kpi-val, .metric-val { font-size: 16px; }
        }

</style>
        ${this._config.show_help === false ? '' : _renderLocalIntro(this._lang, this._hass?.user?.id)}
        <div class="card">
          <div class="card-header">
            <h2>${_esc(this._config.title || 'Data Exporter')}</h2>
            <div style="display:flex;align-items:center;gap:8px"><span class="stats" id="stats"></span><button id="deGoSettingsBtn" aria-expanded="false" aria-controls="settingsInfo" style="background:none;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--bento-text-secondary,#64748b);cursor:pointer;display:inline-flex;align-items:center;gap:4px">${'\u2699\uFE0F ' + this._t.settings}</button></div>
          </div>
          
          <div id="settingsInfo" role="note" hidden style="padding:10px 0;font-size:12px;line-height:1.6;color:var(--bento-text-secondary,#64748b)"></div>
          <div class="toolbar">
            <select id="domainFilter">
              <option value="all">${this._t.allDomains}</option>
            </select>
            <input type="text" id="searchFilter" value="${_esc(this._filterSearch || '')}" placeholder="${this._t.searchEntities}" aria-label="${this._t.searchEntities}" />
            <span class="toolbar-spacer"></span>
            <span class="entity-count" id="entityCount"></span>
            <select class="format-select" id="formatSelect">
              <option value="csv" ${this._config.default_format === 'csv' ? 'selected' : ''}>CSV</option>
              <option value="json" ${this._config.default_format === 'json' ? 'selected' : ''}>JSON</option>
              <option value="yaml" ${this._config.default_format === 'yaml' ? 'selected' : ''}>YAML</option>
            </select>
            <button class="btn btn-primary btn-sm" id="exportBtn" disabled>${this._t.exportSelected} (0)</button>
<label class="attrs-toggle-label"><input type="checkbox" id="includeAttrs" aria-label="${this._t.attributes}" ${this._config && this._config.show_attributes === false ? '' : 'checked'} class="attrs-toggle-input" /> ${this._t.attributes}</label>
          </div>
          <div class="snapshot-bar" style="display:flex;align-items:center;gap:8px 12px;padding:8px 16px;background:var(--bento-bg,#f8fafc);border:1px solid var(--bento-border,#e2e8f0);border-radius:8px;margin:8px 0;font-size:12px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
              <input type="checkbox" id="snapshotEnabled" ${this._snapshotSettings.enabled ? 'checked' : ''} />
              ${this._t.snapshotsTitle}
            </label>
            <select id="snapshotInterval" style="padding:4px 8px;border:1px solid var(--bento-border,#e2e8f0);border-radius:4px;font-size:12px;">
              <option value="30" ${this._snapshotSettings.interval === 30 ? 'selected' : ''}>${this._t.snapshotInterval30s}</option>
              <option value="60" ${this._snapshotSettings.interval === 60 ? 'selected' : ''}>${this._t.snapshotInterval1min}</option>
              <option value="300" ${this._snapshotSettings.interval === 300 ? 'selected' : ''}>${this._t.snapshotInterval5min}</option>
              <option value="900" ${this._snapshotSettings.interval === 900 ? 'selected' : ''}>${this._t.snapshotInterval15min}</option>
              <option value="3600" ${this._snapshotSettings.interval === 3600 ? 'selected' : ''}>${this._t.snapshotInterval1h}</option>
            </select>
            <select id="snapshotMax" style="padding:4px 8px;border:1px solid var(--bento-border,#e2e8f0);border-radius:4px;font-size:12px;">
              <option value="20" ${this._snapshotSettings.maxSnapshots === 20 ? 'selected' : ''}>20 snap.</option>
              <option value="50" ${this._snapshotSettings.maxSnapshots === 50 ? 'selected' : ''}>50 snap.</option>
              <option value="100" ${this._snapshotSettings.maxSnapshots === 100 ? 'selected' : ''}>100 snap.</option>
              <option value="200" ${this._snapshotSettings.maxSnapshots === 200 ? 'selected' : ''}>200 snap.</option>
            </select>
            <span id="snapshotStatus" style="color:var(--bento-text-secondary,#64748b);">${this._snapshots.length} ${this._t.savedSnapshots}</span>
            <button id="snapshotNow" style="padding:4px 10px;border:1px solid var(--bento-border,#e2e8f0);border-radius:4px;background:var(--bento-card,#fff);cursor:pointer;font-size:11px;" title="${this._t.takeSnapshot}" aria-label="${this._t.takeSnapshot}">\u{1F4F8}</button>
            <button id="snapshotClear" style="padding:4px 10px;border:1px solid var(--bento-border,#e2e8f0);border-radius:4px;background:var(--bento-card,#fff);cursor:pointer;font-size:11px;color:#ef4444;" title="${this._t.clearSnapshots}" aria-label="${this._t.clearSnapshots}">\u{1F5D1}</button>
          </div>
          <div class="table-container">
            <table class="entity-table">
              <thead>
                <tr>
                  <th class="checkbox-cell"><label class="touch-checkbox" ${this._config.show_select_all === false ? 'hidden' : ''}><input type="checkbox" id="selectAll" ${this._config.show_select_all === false ? 'hidden' : ''} title="${this._t.selectAll}" aria-label="${this._t.selectAll}" /></label></th>
                  <th class="expand-cell"></th>
                  <th data-sort="entity_id" aria-sort="none"><button type="button" class="sort-button"><span data-sort-label>${this._t.entityId}</span> <span class="sort-arrow" aria-hidden="true"></span></button></th>
                  <th data-sort="name" aria-sort="none"><button type="button" class="sort-button"><span data-sort-label>${this._t.name}</span> <span class="sort-arrow" aria-hidden="true"></span></button></th>
                  <th data-sort="state" aria-sort="none"><button type="button" class="sort-button"><span data-sort-label>${this._t.state}</span> <span class="sort-arrow" aria-hidden="true"></span></button></th>
                  <th data-sort="domain" aria-sort="none"><button type="button" class="sort-button"><span data-sort-label>${this._t.domain}</span> <span class="sort-arrow" aria-hidden="true"></span></button></th>
                  <th data-sort="attrCount" aria-sort="none"><button type="button" class="sort-button"><span data-sort-label>${this._t.attrs}</span> <span class="sort-arrow" aria-hidden="true"></span></button></th>
                </tr>
              </thead>
              <tbody id="entityBody"></tbody>
            </table>
          </div>
          <div class="pagination" id="pagination"></div>
        
        </div>
        ${this._hass?.user?.is_admin && this._config?.show_support !== false && !_localSupportDismissed() ? _renderLocalSupport(this._lang) : ''}
    `
    this._installDataFeatures();
    _bindLocalIntroDismiss(this.shadowRoot, this._hass?.user?.id);
    _bindLocalSupportDismiss(this.shadowRoot);
    this._attachEvents();
    this._refreshDashboardAction();
  }

  _refreshDashboardAction() {
    const existing=this.shadowRoot.querySelector('[data-data-dashboard-add]');
    const allowed=!this.preview && this._hass?.user?.is_admin===true && this._hass?.user?.is_active!==false;
    if(!allowed){existing?.remove();return;}
    if(!this.shadowRoot.querySelector('.card'))return;
    let button=existing;
    if(!button){
      button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.setAttribute('data-data-dashboard-add','');
      button.addEventListener('click',()=>{
        this._dashboardPlacement ||= createDashboardPlacementV53({host:this,getHass:()=>this._hass,
          getCardConfig:()=>JSON.parse(JSON.stringify({...this._config,type:'custom:ha-data-exporter'})),
          getSourceKey:()=>this._identityEpoch,createGuard:createTariffGuardV3});
        this._dashboardPlacement.open();
      });
      this.shadowRoot.querySelector('.card').append(button);
    }
    button.textContent=this._lang==='pl'?'Dodaj do mojego dashboardu':'Add to my dashboard';
    button.disabled=!this._exportConnected() || typeof this._hass?.callWS!=='function';
  }

  _attachEvents() {
    const domainFilter = this.shadowRoot.getElementById('domainFilter');
    const searchFilter = this.shadowRoot.getElementById('searchFilter');
    const selectAll = this.shadowRoot.getElementById('selectAll');
    const exportBtn = this.shadowRoot.getElementById('exportBtn');

    // Settings info bar button
    this.shadowRoot.getElementById('deGoSettingsBtn')?.addEventListener('click', () => {
      let panel = null;
      try {
        const root = this.getRootNode();
        if (root && root.host && root.host.tagName === 'HA-TOOLS-PANEL') panel = root.host;
      } catch (e) { console.debug('[ha-data-exporter] caught:', e); }
      if (!panel) panel = document.querySelector('ha-tools-panel');
      if (panel && panel._navigateToSettings) {
        panel._navigateToSettings('data-exporter');
      } else {
        const unhandled = this.dispatchEvent(new CustomEvent('navigate-settings', { bubbles: true, composed: true, cancelable: true, detail: { section: 'data-exporter' } }));
        if (unhandled) {
          const info = this.shadowRoot.getElementById('settingsInfo');
          info.hidden = !info.hidden;
          this._refreshSettingsInfo();
          this.shadowRoot.getElementById('deGoSettingsBtn').setAttribute('aria-expanded', String(!info.hidden));
        }
      }
    });

    // Snapshot controls
    const snapEnabled = this.shadowRoot.getElementById('snapshotEnabled');
    const snapInterval = this.shadowRoot.getElementById('snapshotInterval');
    const snapMax = this.shadowRoot.getElementById('snapshotMax');
    const snapNow = this.shadowRoot.getElementById('snapshotNow');
    const snapClear = this.shadowRoot.getElementById('snapshotClear');

    if (snapEnabled) {
      snapEnabled.addEventListener('change', () => {
        this._snapshotSettings.enabled = snapEnabled.checked;
        this._saveSnapshotSettings();
        if (snapEnabled.checked) this._startAutoSnapshot();
        else this._stopAutoSnapshot();
        this._updateSnapshotStatus();
      });
    }
    if (snapInterval) {
      snapInterval.addEventListener('change', () => {
        this._snapshotSettings.interval = parseInt(snapInterval.value);
        this._saveSnapshotSettings();
        if (this._snapshotSettings.enabled) this._startAutoSnapshot();
      });
    }
    if (snapMax) {
      snapMax.addEventListener('change', () => {
        this._snapshotSettings.maxSnapshots = parseInt(snapMax.value);
        this._saveSnapshotSettings();
      });
    }
    if (snapNow) {
      snapNow.addEventListener('click', () => {
        this._takeSnapshot();
        this._updateSnapshotStatus();
      });
    }
    if (snapClear) {
      snapClear.addEventListener('click', () => {
        if (!confirm(this._lang === 'pl'
          ? 'Usunąć zapisy tej karty dla bieżącego użytkownika Home Assistant? Nie można tego cofnąć.'
          : 'Delete this card’s saved snapshots for the current Home Assistant user? This cannot be undone.')) return;
        this._clearSnapshots();
        this._updateSnapshotStatus();
      });
    }

    // Start auto snapshot if enabled
    if (this._snapshotSettings.enabled) this._startAutoSnapshot();

    domainFilter.addEventListener('change', (e) => {
      this._filterDomain = e.target.value;
      this._currentPage = 0;
      this._updateEntities();
    });

    searchFilter.addEventListener('input', (e) => {
      this._filterSearch = e.target.value;
      this._currentPage = 0;
      this._updateEntities();
    });

    selectAll.addEventListener('change', (e) => {
      const entities = this._getFilteredEntities();
      if (e.target.checked) {
        entities.forEach(ent => this._selectedEntities.add(ent.entity_id));
      } else {
        entities.forEach(ent => this._selectedEntities.delete(ent.entity_id));
      }
      this._updateEntities();
    });

    this.shadowRoot.querySelectorAll('th[data-sort]').forEach(th => {
      th.querySelector('button').addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this._sortBy === col) {
          this._sortAsc = !this._sortAsc;
        } else {
          this._sortBy = col;
          this._sortAsc = true;
        }
        this._updateEntities();
      });
    });

    const includeAttrs = this.shadowRoot.getElementById('includeAttrs');
    includeAttrs.addEventListener('change', (e) => {
      this._includeAttrsInExport = e.target.checked;
      this._syncExportContext();
    });

    exportBtn.addEventListener('click', () => this._export(this.shadowRoot.getElementById('previewMode').value));
    this.shadowRoot.getElementById('previewMode').addEventListener('change', () => this._updateStats());
    this.shadowRoot.getElementById('formatSelect').addEventListener('change', () => this._refreshColumnSummary());
  }

  _currentPage = 0;

  _updateEntities() {
    this._syncExportContext();
    const domainFilter = this.shadowRoot.getElementById('domainFilter');
    if (!domainFilter) return;
    const entities = this._getFilteredEntities();
    const focused = this.shadowRoot.activeElement;
    const focusKey = focused ? { id: focused.id, entity: focused.dataset?.entity, expand: focused.dataset?.expand } : null;
    const tbody = this.shadowRoot.getElementById('entityBody');
    const stats = this.shadowRoot.getElementById('stats');
    const exportBtn = this.shadowRoot.getElementById('exportBtn');
    const pagination = this.shadowRoot.getElementById('pagination');

    // Update domain filter. Issue #6: periodic hass updates rebuild the options
    // only when domains or counts change, so an open picker and the page stay put.
    const domains = this._getDomains();
    const currentDomain = this._filterDomain;
    const stateIds = Object.keys(this._hass.states);
    const domainOptions = [['all', this._t.allDomains + ' (' + stateIds.length + ')'], ...domains.map(d => [d, d + ' (' + stateIds.filter(id => id.startsWith(d + '.')).length + ')'])];
    const domainSignature = JSON.stringify(domainOptions);
    if (domainFilter.dataset.signature !== domainSignature) {
      domainFilter.dataset.signature = domainSignature;
      domainFilter.replaceChildren(...domainOptions.map(([value, text]) => { const opt = document.createElement('option'); opt.value = value; opt.textContent = text; return opt; }));
    }
    const domainValue = domains.includes(currentDomain) ? currentDomain : 'all';
    if (domainFilter.value !== domainValue) domainFilter.value = domainValue;

    const mobileSort=this.shadowRoot.getElementById('mobileSort');
    if(mobileSort){
      const label=this.shadowRoot.getElementById('mobileSortLabel');label.textContent=this._lang==='pl'?'Sortuj:':'Sort by:';
      const labels={entity_id:this._t.entityId,name:this._t.name,state:this._t.state,domain:this._t.domain};
      const options=Object.entries(labels).flatMap(([key,name])=>['asc','desc'].map(direction=>`<option value="${key}:${direction}">${_esc(name)} ${direction==='asc'?'▲':'▼'}</option>`)).join('');
      if(mobileSort.dataset.signature!==options){mobileSort.dataset.signature=options;mobileSort.innerHTML=options;}
      const sortValue=this._sortBy+':'+(this._sortAsc?'asc':'desc');if(mobileSort.value!==sortValue)mobileSort.value=sortValue;
    }
    // Update sort arrows
    this.shadowRoot.querySelectorAll('th[data-sort]').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      th.setAttribute('aria-sort', th.dataset.sort === this._sortBy ? (this._sortAsc ? 'ascending' : 'descending') : 'none');
      if (th.dataset.sort === this._sortBy) {
        arrow.textContent = this._sortAsc ? ' \u25B2' : ' \u25BC';
      } else {
        arrow.textContent = '';
      }
    });

    // Pagination
    const pageSize = this._pageSize || 15;
    const totalPages = Math.ceil(entities.length / pageSize);
    if (this._currentPage >= totalPages) this._currentPage = Math.max(0, totalPages - 1);
    const start = this._currentPage * pageSize;
    const pageEntities = entities.slice(start, start + pageSize);

    // Render table. Issue #6: when a periodic hass update leaves the visible page
    // unchanged, rows are patched in place. The table never empties under the
    // reader, and focus, scroll position and loaded history stay where they are.
    const rowKey = JSON.stringify([this._lang, pageEntities.map(ent => ent.entity_id)]);
    if (!(pageEntities.length && tbody.dataset.rowKey === rowKey && this._patchEntityRows(tbody, pageEntities))) {
      tbody.dataset.rowKey = pageEntities.length ? rowKey : '';
      this._buildEntityRows(tbody, pageEntities);
    }

    // Pagination controls keep their DOM; only text, state and value change.
    this._refreshEntityPagination(pagination, entities.length, totalPages, pageSize);

    this._refreshFeatureLabels();
    this._updateStats();
    stats.textContent = this._entityCount(entities.length);
    if (focusKey && focused && !focused.isConnected) {
      const next = focusKey.id ? this.shadowRoot.getElementById(focusKey.id)
        : focusKey.entity ? Array.from(this.shadowRoot.querySelectorAll('input[data-entity]')).find(node => node.dataset.entity === focusKey.entity)
        : focusKey.expand ? Array.from(this.shadowRoot.querySelectorAll('button[data-expand]')).find(node => node.dataset.expand === focusKey.expand) : null;
      next?.focus({ preventScroll: true });
    }
  }

  _entityAttrKeys(ent) {
    return Object.keys(ent.attributes || {}).filter(k => k !== 'friendly_name');
  }

  _entityDetailParts(ent) {
    const attrs = ent.attributes || {};
    const attrKeys = this._entityAttrKeys(ent);
    const fields = '<dl class="record-fields">' + Object.entries({ ...this._buildExportData([ent], this._registryMetadata || {entities:new Map(),devices:new Map(),areas:new Map()})[0], attributes: undefined, attribute_count: attrKeys.length }).filter(([key]) => key !== 'attributes').map(([key,value]) => '<dt>' + _esc(key) + '</dt><dd>' + _esc(String(value ?? '')) + '</dd>').join('') + '</dl>';
    let grid = '<div class="attr-grid">';
    if (attrKeys.length === 0) {
      grid += '<div class="attr-item"><span class="attr-val" style="color:var(--bento-text-muted)">' + this._t.noAttributes + '</span></div>';
    } else {
      [...attrKeys].sort().forEach(k => {
        const v = attrs[k];
        const isComplex = typeof v === 'object' && v !== null;
        const displayVal = isComplex ? JSON.stringify(v) : String(v);
        const valClass = isComplex ? 'attr-val complex' : 'attr-val';
        grid += `<div class="attr-item"><span class="attr-key">${_esc(k)}</span><span class="${valClass}" title="${_esc(displayVal).replace(/"/g, '&quot;')}">${_esc(displayVal)}</span></div>`;
      });
    }
    grid += '</div>';
    // Snapshot history (persisted)
    let snapshots = '';
    const snapHistory = this._getEntityHistory(ent.entity_id);
    if (snapHistory.length > 0) {
      const last10 = snapHistory.slice(-10).reverse();
      snapshots = '<div class="history-section snapshot-history"><div class="history-title">\u{1F4BE} ' + this._t.snapshotsTitle + ' (' + snapHistory.length + ' ' + this._t.snapshots + ')</div><div class="history-list">';
      last10.forEach(h => {
        const t = this._displayTimestamp(h.ts);
        snapshots += '<div class="history-item"><time class="history-time" datetime="' + _esc(this._timestampAttribute(h.ts)) + '">' + _esc(t) + '</time><span class="history-state">' + _esc(h.state) + '</span><span style="font-size:11px;color:var(--bento-text-secondary,#64748b);">' + _esc(h.attrs) + ' ' + this._t.attrs + '</span></div>';
      });
      snapshots += '</div></div>';
    }
    return { fields, grid, snapshots };
  }

  _setEntityExpanded(button, row, expanded) {
    if (!this._expandedEntities) this._expandedEntities = new Set();
    const entityId = row.dataset.attrFor;
    row.style.display = expanded ? '' : 'none';
    button.classList.toggle('expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    if (expanded) {
      this._expandedEntities.add(entityId);
      this._fetchHistory(entityId);
    } else {
      this._expandedEntities.delete(entityId);
    }
  }

  _buildEntityRows(tbody, pageEntities) {
    tbody.innerHTML = '';
    if (pageEntities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">' + this._t.noEntities + '</td></tr>';
      return;
    }
    if (!this._expandedEntities) this._expandedEntities = new Set();
    pageEntities.forEach(ent => {
      const tr = document.createElement('tr');
      const checked = this._selectedEntities.has(ent.entity_id) ? 'checked' : '';
      const attrCount = this._entityAttrKeys(ent).length;
      tr.innerHTML = `
          <td class="checkbox-cell"><label class="touch-checkbox"><input type="checkbox" data-entity="${_esc(ent.entity_id)}" aria-label="${_esc(this._t.selectEntity + ' ' + ent.entity_id + ' (' + ent.name + ')')}" ${checked} /></label></td>
          <td class="expand-cell"><button class="expand-btn" data-expand="${_esc(ent.entity_id)}" title="${this._t.showAttributes}" aria-label="${this._t.showAttributes}" aria-expanded="false" aria-controls="${_esc('details-' + ent.entity_id)}">▶</button></td>
          <td class="entity-id" tabindex="0" title="${_esc(ent.entity_id)}">${_esc(ent.entity_id).replace(/[._]/g, '$&<wbr>')}</td>
          <td class="entity-name" title="${_esc(ent.name)}">${_esc(ent.name)}</td>
          <td class="state-val" title="${_esc(ent.state)}">${_esc(ent.state)}</td>
          <td>${_esc(ent.domain)}</td>
          <td><span class="attr-count">${attrCount}</span></td>
        `;
      tr.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
        if (e.target.checked) {
          this._selectedEntities.add(ent.entity_id);
        } else {
          this._selectedEntities.delete(ent.entity_id);
        }
        this._updateStats();
      });
      tbody.appendChild(tr);

      // Expandable attribute row (hidden by default)
      const attrRow = document.createElement('tr');
      attrRow.className = 'attr-row';
      attrRow.style.display = 'none';
      attrRow.dataset.attrFor = ent.entity_id;
      attrRow.id = 'details-' + ent.entity_id;
      const attrTd = document.createElement('td');
      attrTd.colSpan = 7;
      const parts = this._entityDetailParts(ent);
      // History from HA API is loaded on expand and kept while the row is patched.
      const history = `<div class="history-section"><div class="history-title">\u{1F4C8} ${this._t.stateHistory}</div><div class="history-list" id="history-${ent.entity_id.replace(/\./g, '_')}"><span class="history-loading">${this._t.clickToLoad}</span></div></div>`;
      attrTd.innerHTML = '<div class="attr-container">' + parts.fields + parts.grid + history + parts.snapshots + '</div>';
      attrRow._detailParts = parts;
      attrRow.appendChild(attrTd);
      tbody.appendChild(attrRow);

      const expand = tr.querySelector('.expand-btn');
      if (this._expandedEntities.has(ent.entity_id)) this._setEntityExpanded(expand, attrRow, true);
      expand.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const row = btn.closest('tr').nextElementSibling;
        this._setEntityExpanded(btn, row, row.style.display === 'none');
      });
    });
  }

  _patchEntityRows(tbody, pageEntities) {
    const inputs = new Map(Array.from(tbody.querySelectorAll('input[data-entity]')).map(input => [input.dataset.entity, input]));
    if (inputs.size !== pageEntities.length) return false;
    const rows = [];
    for (const ent of pageEntities) {
      const input = inputs.get(ent.entity_id), tr = input?.closest('tr'), attrRow = tr?.nextElementSibling;
      if (!tr || attrRow?.dataset.attrFor !== ent.entity_id || !attrRow._detailParts) return false;
      rows.push([ent, input, tr, attrRow]);
    }
    for (const [ent, input, tr, attrRow] of rows) {
      const checked = this._selectedEntities.has(ent.entity_id);
      if (input.checked !== checked) input.checked = checked;
      const label = this._t.selectEntity + ' ' + ent.entity_id + ' (' + ent.name + ')';
      if (input.getAttribute('aria-label') !== label) input.setAttribute('aria-label', label);
      for (const [selector, value] of [['.entity-name', String(ent.name ?? '')], ['.state-val', String(ent.state ?? '')]]) {
        const cell = tr.querySelector(selector);
        if (cell.textContent !== value) cell.textContent = value;
        if (cell.getAttribute('title') !== value) cell.setAttribute('title', value);
      }
      const count = tr.querySelector('.attr-count'), attrCount = String(this._entityAttrKeys(ent).length);
      if (count.textContent !== attrCount) count.textContent = attrCount;
      const parts = this._entityDetailParts(ent), previous = attrRow._detailParts, container = attrRow.querySelector('.attr-container');
      if (parts.fields !== previous.fields) container.querySelector('.record-fields').outerHTML = parts.fields;
      if (parts.grid !== previous.grid) container.querySelector('.attr-grid').outerHTML = parts.grid;
      if (parts.snapshots !== previous.snapshots) {
        container.querySelector('.snapshot-history')?.remove();
        if (parts.snapshots) container.insertAdjacentHTML('beforeend', parts.snapshots);
      }
      attrRow._detailParts = parts;
      const expanded = this._expandedEntities.has(ent.entity_id);
      if ((attrRow.style.display !== 'none') !== expanded) this._setEntityExpanded(tr.querySelector('.expand-btn'), attrRow, expanded);
    }
    return true;
  }

  _refreshEntityPagination(pagination, total, totalPages, pageSize) {
    const sizes = Array.from(new Set([15, 25, 50, 100, pageSize])).sort((a, b) => a - b);
    const signature = JSON.stringify([this._lang, sizes]);
    if (pagination.dataset.signature !== signature || !pagination.querySelector('#prevPage')) {
      pagination.dataset.signature = signature;
      pagination.innerHTML = `
      <button id="prevPage">◀ ${this._t.previous}</button>
      <span id="pageStatus"></span>
      <button id="nextPage">${this._t.next} ▶</button>
      <div class="page-size-wrap">
        <label>${this._t.show}</label>
        <select id="pageSizeSelect">
          ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
    `;
      pagination.querySelector('#prevPage').addEventListener('click', () => {
        this._currentPage--;
        this._updateEntities();
      });
      pagination.querySelector('#nextPage').addEventListener('click', () => {
        this._currentPage++;
        this._updateEntities();
      });
      pagination.querySelector('#pageSizeSelect').addEventListener('change', (e) => {
        this._pageSize = parseInt(e.target.value);
        this._currentPage = 0;
        this._updateEntities();
      });
    }
    pagination.querySelector('#prevPage').disabled = this._currentPage === 0;
    pagination.querySelector('#nextPage').disabled = this._currentPage >= totalPages - 1;
    const status = pagination.querySelector('#pageStatus');
    const text = `${this._t.page} ${this._currentPage + 1} ${this._t.of} ${Math.max(1, totalPages)} (${total})`;
    if (status.textContent !== text) status.textContent = text;
    const size = pagination.querySelector('#pageSizeSelect');
    if (size.value !== String(pageSize)) size.value = String(pageSize);
  }

  _updateStats() {
    this._syncExportContext();
    const exportBtn = this.shadowRoot.getElementById('exportBtn');
    if (!exportBtn) return;
    const count = this._getSelectedEntities().length;
    exportBtn.textContent = this._lang === 'pl' ? 'Podgląd i zapis' : 'Preview and save';
    exportBtn.disabled = (this.shadowRoot.getElementById('previewMode')?.value === 'all' ? this._getFilteredEntities().length : count) === 0;
    this._refreshActiveFilters();
    this._refreshColumnSummary();
    // An open column picker follows the export scope as the selection changes.
    const columnControls = this.shadowRoot.getElementById('columnControls');
    if (columnControls && this.shadowRoot.getElementById('exportColumns')?.open && columnControls.dataset.available !== JSON.stringify(this._availableColumns())) this._refreshColumnControls();
    const note = this.shadowRoot.getElementById('selectionScope');
    const selectFiltered = this.shadowRoot.getElementById('selectFiltered'), clearSelection = this.shadowRoot.getElementById('clearSelection');
    if (selectFiltered && clearSelection) {
      const filteredCount = this._getFilteredEntities().length;
      selectFiltered.textContent = this._lang === 'pl' ? `Zaznacz wszystkie w filtrach (${filteredCount})` : `Select all within filters (${filteredCount})`;
      selectFiltered.hidden = this._config.show_select_all === false;
      clearSelection.textContent = this._lang === 'pl' ? `Wyczyść zaznaczenie (${count})` : `Clear selection (${count})`;
    }
    if (note) { const visible = new Set(this._getFilteredEntities().map(e => e.entity_id)); const outside = this._getSelectedEntities().filter(e => !visible.has(e.entity_id)).length; note.textContent = this._lang === 'pl' ? `Zaznaczone: ${count}; poza filtrami: ${outside}; pasujące do filtrów: ${visible.size}.` : `Selected: ${count}; outside filters: ${outside}; matching filters: ${visible.size}.`; const explanation=this._lang==='pl'?'Eksport zaznaczonych obejmuje także encje poza filtrami.':'Selected export includes entities outside filters.'; note.title=explanation; note.setAttribute('aria-label',note.textContent+' '+explanation); }
  }

  async _loadRegistryMetadata() {
    const [entities, devices, areas] = await Promise.all([
      this._hass.callWS({ type: 'config/entity_registry/list' }),
      this._hass.callWS({ type: 'config/device_registry/list' }),
      this._hass.callWS({ type: 'config/area_registry/list' })
    ]);
    if (![entities, devices, areas].every(Array.isArray)) throw new Error('Invalid registry response');
    return {
      entities: new Map(entities.map(entry => [entry.entity_id, entry])),
      devices: new Map(devices.map(entry => [entry.id, entry])),
      areas: new Map(areas.map(entry => [entry.area_id, entry]))
    };
  }

  _buildExportData(data, metadata) {
    return data.map(e => {
      const entity = metadata.entities.get(e.entity_id);
      const deviceId = entity?.device_id || '';
      const device = metadata.devices.get(deviceId);
      const areaId = entity?.area_id || device?.area_id || '';
      const area = metadata.areas.get(areaId);
      const row = {
        entity_id: e.entity_id,
        friendly_name: e.name,
        state: e.state,
        domain: e.domain,
        last_changed: e.last_changed,
        device_id: deviceId,
        device_name: device?.name_by_user || device?.name || '',
        area_id: areaId,
        area_name: area?.name || ''
      };
      if (this._includeAttrsInExport) {
        const attrs = { ...e.attributes };
        delete attrs.friendly_name;
        row.attributes = attrs;
      }
      return row;
    });
  }

  // Context carries opaque handles only. The private fingerprint is never exported.
  _exportHandle(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return 'none';
    if (!this._exportHandles.has(value)) this._exportHandles.set(value, `source-${++this._exportHandleSequence}`);
    return this._exportHandles.get(value);
  }

  _exportConnected() {
    return !!this._hass && !!this._hass.connection && this._hass.connection.connected !== false
      && this._hass.connected !== false && this._hass.offline !== true && this.isConnected
      && !this._exportTransportOffline && !this._exportBrowserOffline && navigator.onLine !== false;
  }

  _syncExportContext() {
    const map = value => value ? Array.from(value.entries()) : null;
    // A live HA update is not necessarily a change to this export. Bind review
    // to its actual ordered rows (including selected rows hidden by filters),
    // not to every entity in the house. Keep raw membership separate from the
    // reviewed projection so redacted IDs cannot conceal a removed/replaced row.
    const mode = this._exportMode || 'all';
    const hasStates = !!this._hass?.states && typeof this._hass.states === 'object';
    const source = mode === 'diff'
      ? this._comparison.map(index => this._snapshotChoices()[index] ?? null)
      : hasStates ? [
        (mode === 'selected' ? this._getSelectedEntities() : this._getFilteredEntities()).map(entity => entity.entity_id),
        this._reviewedExportRows(mode, true)
      ] : null;
    const signature = JSON.stringify([
      this._identityEpoch, this._exportHandle(this._hass?.connection), this._exportConnected(),
      this._hass?.user?.id ?? null, this._hass?.user?.is_admin === true, this._hass?.user?.is_owner === true,
      this._lang, this._config, hasStates, source,
      this._registryStatus, map(this._registryMetadata?.entities), map(this._registryMetadata?.devices), map(this._registryMetadata?.areas),
      this._filterDomain, this._filterSearch, this._filterArea, this._filterDevice,
      [...this._selectedEntities].sort(), this._sortBy, this._sortAsc, this._exportColumns,
      this._includeAttrsInExport, this._comparison,
      this.shadowRoot.getElementById('formatSelect')?.value ?? this._config.default_format,
      this._exportMode
    ]);
    if (signature !== this._exportSignature) {
      this._exportSignature = signature;
      this._exportRevision++;
      this._exportDialog?.contextChanged();
    }
  }

  _getExportContext() {
    this._syncExportContext();
    // States already supplied to this card are an actual source, including for
    // household users. No claim about access to an unrequested registry is made.
    const known = !!this._hass?.states && typeof this._hass.states === 'object';
    return {
      role: `role-${this._identityEpoch}`, userId: `user-${this._identityEpoch}`,
      connectionId: this._exportHandle(this._hass?.connection), datasetId: `dataset-${this._identityEpoch}`,
      revision: this._exportRevision, connected: this._exportConnected(), canExport: known,
      sourceConfirmed: known
    };
  }

  _bindExportConnection(connection) {
    if (this._exportConnection === connection && this._exportConnectionListener) return;
    this._unbindExportConnection();
    this._exportTransportOffline = connection?.connected === false;
    if (!connection?.addEventListener || !connection?.removeEventListener) return;
    this._exportConnection = connection;
    const update = offline => {
      // Fence the event immediately, even before a cached flag changes.
      this._exportTransportOffline = offline;
      this._syncExportContext();
      if (!this._exportConnected()) this._exportDialog?.cancel();
    };
    this._exportConnectionListener = { ready: () => update(false), disconnected: () => update(true) };
    for (const [type, listener] of Object.entries(this._exportConnectionListener)) connection.addEventListener(type, listener);
  }

  _unbindExportConnection() {
    if (this._exportConnectionListener) for (const [type, listener] of Object.entries(this._exportConnectionListener))
      this._exportConnection?.removeEventListener(type, listener);
    this._exportConnection = null;
    this._exportConnectionListener = null;
  }

  _bindExportBrowserLifecycle() {
    if (this._exportBrowserListeners) return;
    this._exportBrowserOffline = navigator.onLine === false;
    const update = offline => {
      this._exportBrowserOffline = offline; this._syncExportContext();
      if (!this._exportConnected()) this._exportDialog?.cancel();
    };
    this._exportBrowserListeners = { offline: () => update(true), online: () => update(false) };
    for (const [type, listener] of Object.entries(this._exportBrowserListeners)) window.addEventListener(type, listener);
  }

  _unbindExportBrowserLifecycle() {
    if (this._exportBrowserListeners) for (const [type, listener] of Object.entries(this._exportBrowserListeners)) window.removeEventListener(type, listener);
    this._exportBrowserListeners = null;
  }

  _destroyExportDialog() {
    this._exportDialog?.destroy();
    this._exportDialog = null;
  }

  _export(mode) {
    if (!['all', 'selected', 'diff'].includes(mode)) return;
    if (mode === 'diff' && (!this._comparison.every(i => i !== null && this._snapshotChoices()[i]) || this._comparison[0] === this._comparison[1])) return;
    this._destroyExportDialog();
    this._exportMode = mode;
    this._syncExportContext();
    const chosen = this.shadowRoot.getElementById('formatSelect')?.value;
    const format = ['json', 'csv', 'yaml'].includes(chosen) ? chosen : 'csv';
    const opener = this.shadowRoot.activeElement || this.shadowRoot.getElementById(mode === 'diff' ? 'exportDiff' : 'exportBtn');
    this._exportDialog = createExportDialog({
      root: this.shadowRoot, createUiV3,
      getLanguage: () => this._lang,
      getContext: () => this._getExportContext(),
      formats: ['json', 'csv', 'yaml'], defaultFormat: format,
      defaultFilename: `ha-export-${new Date().toISOString().slice(0, 10)}.${format}`,
      policy: DATA_EXPORT_POLICY,
      buildPayload: request => this._buildReviewedExport(mode, request),
      performDownload: ({ blob, filename, signal }) => {
        if (signal.aborted || !this._exportConnected()) return { outcome: 'unknown' };
        // Issue #6: the Home Assistant iOS/macOS app hands the blob URL to a
        // WKDownload that asks for a destination asynchronously. Revoking the
        // URL right after click() cancels it (NSURLErrorDomain -999), so the URL
        // stays alive for a minute. The anchor is attached while clicked, and
        // has no target: target=_blank would leave the app for a browser.
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.style.display = 'none';
        document.body.appendChild(anchor);
        try { anchor.click(); }
        finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS); }
        return { outcome: 'initiated' };
      }
    });
    this._exportDialog.open({ opener });
  }

  _safeExportTimestamp(value) {
    return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
      && Number.isFinite(Date.parse(value)) ? value : null;
  }

  _safeExportText(value, identifier = false) {
    if (typeof value !== 'string' || !value || value.length > 96 || value !== value.trim()) return null;
    // Reviewed labels/IDs only, with exact danger categories rejected in both
    // modes: URLs, email/IP/MAC/postal addresses, credentials, controls/formulas.
    const words = value.replace(/[_.-]/g, ' ');
    if (/[\p{Cc}\p{Cf}]/u.test(value) || /^[\s]*[=+\-@]/.test(value)
      || /(?:https?:|wss?:|ftp:|www\.|@|\b(?:\d{1,3}\.){3}\d{1,3}\b|(?:[\da-f]{2}:){5}[\da-f]{2}|[\da-f]{1,4}:[\da-f:]{2,}|\b[\da-f]{4}(?:\.[\da-f]{4}){2}\b|\b\d{2}-\d{3}\b)/i.test(value)
      || /\b(?:token|password|passwd|secret|authorization|bearer|api[_ -]?key|access[_ -]?key|raw[_ -]?config)\b/i.test(words)
      || /\b\d+\s+.*\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|ulica|ul\.?|aleja|al\.?)\b/i.test(words)
      || (!identifier && (/^\d+\s/.test(value) || /\b(?:ulica|ul\.|aleja|al\.)\s/i.test(value)))
      || /(?:eyJ[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{40,})/.test(value)) return null;
    return (identifier ? /^[a-z0-9][a-z0-9_.-]*$/i : /^[\p{L}\p{N}][\p{L}\p{N} _().-]*$/u).test(value) ? value : null;
  }

  _safeExportState(value, domain) {
    if (value === 'unknown' || value === 'unavailable' || typeof value === 'boolean') return value;
    if (DATA_NUMERIC_DOMAINS.has(domain)) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value))) return Number(value);
    }
    return Object.hasOwn(DATA_STATE_ENUMS, domain) && DATA_STATE_ENUMS[domain].includes(value) ? value : null;
  }

  _safeExportAttributes(attributes) {
    const result = {};
    if (!this._includeAttrsInExport || !attributes || typeof attributes !== 'object') return result;
    for (const key of DATA_NUMERIC_ATTRIBUTES) {
      // Numeric attribute strings are not converted: the schema requires actual
      // finite numbers, avoiding arbitrary freeform strings/embedded credentials.
      if (typeof attributes[key] === 'number' && Number.isFinite(attributes[key])) result[key] = attributes[key];
    }
    for (const key of DATA_BOOLEAN_ATTRIBUTES) if (typeof attributes[key] === 'boolean') result[key] = attributes[key];
    for (const [key, choices] of Object.entries(DATA_ATTRIBUTE_ENUMS)) if (choices.includes(attributes[key])) result[key] = attributes[key];
    // Retain international and Custom currency codes used by measured monetary
    // sensors and tariff rates; this is a bounded unit label, never a raw string.
    const unit = attributes.unit_of_measurement;
    if (typeof unit === 'string' && /^[A-Z]{3}(?:\/(?:Wh|kWh|MWh))?$/.test(unit)) result.unit_of_measurement = unit;
    return result;
  }

  _credentialEntity(id, label) {
    const words = `${id || ''} ${label || ''}`.replace(/[_.-]/g, ' ');
    return /\b(?:token|password|passwd|secret|authorization|bearer|api ?key|access ?key|raw ?config|user ?id|username|email|ip ?address|mac ?address)\b/i.test(words);
  }

  _reviewedExportRows(mode, includePrivate) {
    const identity = (id, i) => includePrivate ? this._safeExportText(id, true) || `row-${i + 1}` : `row-${i + 1}`;
    if (mode === 'diff') {
      const choices = this._snapshotChoices();
      const [before, after] = this._comparison.map(index => choices[index]);
      const reviewedState = (snapshot, id, value, domain) => {
        if (value === null || this._credentialEntity(id)) return null;
        const captured = snapshot?.entities?.[id];
        if (captured && Object.hasOwn(captured, 'export_state')) return this._safeExportState(captured.export_state, domain);
        // Older snapshots discarded the friendly-name classification. Numeric
        // values cannot be retrospectively trusted from a current label.
        const legacy = this._safeExportState(value, domain);
        return typeof legacy === 'number' ? null : legacy;
      };
      return this._comparisonFrame().map((row, i) => {
        const domain = row.entity_id.split('.')[0];
        return {
          entity_id: identity(row.entity_id, i), domain: /^[a-z_]{1,32}$/.test(domain) ? domain : null,
          change: row.change,
          before_state: reviewedState(before, row.entity_id, row.before_state, domain),
          after_state: reviewedState(after, row.entity_id, row.after_state, domain),
          before_timestamp: this._safeExportTimestamp(row.before_timestamp), after_timestamp: this._safeExportTimestamp(row.after_timestamp),
          source: 'browser-local snapshot'
        };
      });
    }
    const entities = mode === 'selected' ? this._getSelectedEntities() : this._getFilteredEntities();
    const metadata = this._registryMetadata;
    const rows = entities.map((e, i) => {
      const entry = metadata?.entities.get(e.entity_id);
      const device = metadata?.devices.get(entry?.device_id);
      const areaId = entry?.area_id || device?.area_id || null;
      const area = metadata?.areas.get(areaId);
      const row = {
        entity_id: identity(e.entity_id, i), friendly_name: includePrivate ? this._safeExportText(e.name) : null,
        state: this._credentialEntity(e.entity_id, e.name) ? null : this._safeExportState(e.state, e.domain), domain: /^[a-z_]{1,32}$/.test(e.domain) ? e.domain : null,
        last_changed: this._safeExportTimestamp(e.last_changed),
        device_id: includePrivate ? this._safeExportText(entry?.device_id, true) : null,
        device_name: includePrivate ? this._safeExportText(device?.name_by_user || device?.name) : null,
        area_id: includePrivate ? this._safeExportText(areaId, true) : null,
        area_name: includePrivate ? this._safeExportText(area?.name) : null
      };
      if (this._includeAttrsInExport) row.attributes = this._credentialEntity(e.entity_id, e.name) ? {} : this._safeExportAttributes(e.attributes);
      return row;
    });
    // Projection keeps every user's selected column and its order. Disallowed
    // attributes have null cells, never arbitrary raw data, including collisions.
    const allowed = new Set(DATA_EXPORT_POLICY.allowlistedFields);
    return this._exportColumns === null ? rows : rows.map(row => Object.fromEntries(this._exportColumns.map((key, i) => [allowed.has(key) ? key : `excluded-column-${i + 1}`,
      !allowed.has(key) ? null : key.startsWith('attributes.') ? row.attributes?.[key.slice(11)] ?? null : row[key] ?? null
    ])));
  }

  _buildReviewedExport(mode, { draft, signal }) {
    if (signal.aborted) throw new Error('cancelled');
    const PL = this._lang === 'pl';
    const rows = this._reviewedExportRows(mode, draft.includePrivate);
    const partial = mode !== 'diff' && !this._registryMetadata;
    const scope = mode === 'selected' ? (PL ? 'zaznaczone, także poza filtrami' : 'selected, including outside filters')
      : mode === 'diff' ? (PL ? 'zmiany stanów snapshotów lokalnych przeglądarki' : 'browser-local snapshot state changes')
      : (PL ? 'wszystkie w aktualnych filtrach' : 'all within current filters');
    const included = [PL ? 'Anonimowe identyfikatory wierszy, domeny, znane stany liczbowe i enum, znaczniki czasu ISO; wybrane kolumny i kolejność.' : 'Anonymous row IDs, domains, reviewed numeric/enum states and ISO timestamps; selected columns and order.',
      draft.includePrivate ? (PL ? 'Sprawdzone identyfikatory i etykiety encji, obszarów i urządzeń; tylko dostępne metadane.' : 'Reviewed entity, area and device IDs/labels; available metadata only.')
        : (PL ? 'Pola identyfikujące encje, etykiety, obszary i urządzenia pominięte; identyfikatory row-1, row-2…' : 'Entity IDs, labels, areas and devices omitted; row-1, row-2… identifiers.'),
      this._includeAttrsInExport && mode !== 'diff' ? (PL ? 'Tylko sprawdzone atrybuty liczbowe, boolean, jednostki i klasy urządzeń.' : 'Only reviewed numeric, boolean, unit and device class attributes.') : (PL ? 'Bez atrybutów.' : 'No attributes.')];
    const excluded = [PL ? 'Tokeny, użytkownicy, adresy (URL, e-mail, IP, MAC i pocztowe), surowa konfiguracja — zawsze pominięte.' : 'Tokens, users, addresses (URL, email, IP, MAC and postal), raw configuration — always excluded.',
      PL ? 'Dowolne teksty stanów i atrybutów, nieznane atrybuty, niebezpieczne etykiety/ID; brakujące lub odrzucone komórki = null; niesprawdzone nazwy kolumn = excluded-column-N.' : 'Arbitrary state/attribute strings, unknown attributes and unsafe labels/IDs; missing or excluded cells = null; unreviewed column names use excluded-column-N.'];
    const sourceLimit = `${PL ? 'Wiersze' : 'Rows'}: ${rows.length}; ${scope}. `
      + (mode === 'diff' ? (PL ? 'Wyłącznie snapshoty lokalne tej przeglądarki; bez historii serwera i interpolacji; brak encji = null. Starsze snapshoty bez zapisanej klasyfikacji eksportu pomijają wartości liczbowe. ' : 'Only browser-local snapshots; no server history or interpolation; absent entity = null. Older snapshots without saved export classification omit numeric states. ')
        : (PL ? 'Tylko stany dostarczone do karty przez Home Assistant. ' : 'Only Home Assistant states actually supplied to this card. '))
      + (partial ? (PL ? 'Metadane rejestrów niedostępne lub niewczytane; obszary i urządzenia nie są zgadywane. Eksport częściowy.' : 'Registry metadata unavailable or not loaded; no guessed areas or devices. Partial export.')
        : (PL ? 'Dostępne metadane sprawdzane według jawnego schematu.' : 'Available metadata is reviewed against the explicit schema.'));
    if (!rows.length) return { serialized: '', status: 'no_data' };
    const report = {
      schema: DATA_EXPORT_POLICY.id, report_status: partial ? 'partial' : 'success', data_count: rows.length,
      scope, included, excluded, source_limit: sourceLimit, rows
    };
    return { serialized: this._serializeReviewedExport(report, draft.format), confirmed: true, sourceConfirmed: true,
      status: report.report_status, included, excluded, sourceLimit };
  }

  _serializeReviewedExport(report, format) {
    if (format === 'json') return JSON.stringify(report, null, 2);
    if (format === 'yaml') {
      // JSON flow values are valid YAML 1.2; quoted keys and values prevent tags,
      // anchors, colons, or attribute names from changing the document schema.
      const { rows, ...metadata } = report;
      return Object.entries(metadata).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}\n`).join('')
        + 'rows:\n' + rows.map(row => `  - ${JSON.stringify(row)}\n`).join('');
    }
    const rows = report.rows.map(row => {
      const { attributes, ...fields } = row;
      if (attributes) for (const [key, value] of Object.entries(attributes)) fields[`attributes.${key}`] = value;
      return fields;
    });
    const dataHeaders = [...new Set(rows.flatMap(row => Object.keys(row)))];
    // File metadata is present even in Partial CSV, in separate reserved columns.
    const metadata = { 'report.schema': report.schema, 'report.status': report.report_status,
      'report.data_count': report.data_count, 'report.scope': report.scope,
      'report.included': JSON.stringify(report.included), 'report.excluded': JSON.stringify(report.excluded), 'report.source_limit': report.source_limit };
    const metaHeaders = Object.keys(metadata);
    const cell = value => {
      const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      const unsafe = typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text);
      const safe = unsafe ? "'" + text : text;
      return unsafe || /[,"\r\n\t]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    };
    return [[...dataHeaders, ...metaHeaders].map(cell).join(','), ...rows.map(row => [...dataHeaders.map(key => cell(row[key])), ...metaHeaders.map(key => cell(metadata[key]))].join(','))].join('\n');
  }

  _projectColumns(rows) {
    if (this._exportColumns === null) return rows;
    return rows.map(row => Object.fromEntries(this._exportColumns.map(key => [key, key.startsWith('attributes.') ? row.attributes?.[key.slice(11)] ?? null : row[key] ?? null])));
  }

  _exportFrame(mode, metadata, entities = null) {
    return mode === 'diff' ? this._comparisonFrame() : this._projectColumns(this._buildExportData(entities || (mode === 'selected' ? this._getSelectedEntities() : this._getFilteredEntities()), metadata));
  }

  _serializeFrame(rows, format) {
    if (format === 'json') return JSON.stringify(rows, null, 2);
    const generic = this._exportColumns !== null || rows.some(row => Object.hasOwn(row, 'before_state'));
    if (!generic) return format === 'yaml' ? this._toYAML(rows) : this._toCSV(rows);
    if (format === 'yaml') return rows.map(row => Object.entries(row).map(([key,value], index) => `${index ? '  ' : '- '}${JSON.stringify(key)}: ${JSON.stringify(value ?? null)}`).join('\n')).join('\n') + (rows.length ? '\n' : '');
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const cell = value => {
      const str = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      const unsafe = typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+\-@]/.test(str);
      const safe = unsafe ? "'" + str : str;
      return unsafe || /[,"\r\n\t]/.test(safe) ? '"' + safe.replace(/"/g,'""') + '"' : safe;
    };
    return headers.length ? [headers.map(cell).join(','), ...rows.map(row => headers.map(key => cell(row[key])).join(','))].join('\n') : '';
  }

  _compareSnapshots(before, after) {
    if (!before?.entities || !after?.entities) return [];
    return [...new Set([...Object.keys(before.entities), ...Object.keys(after.entities)])].sort().flatMap(entity_id => {
      const a = before.entities[entity_id], b = after.entities[entity_id];
      // Only exact state comparison; never compare attributes or interpolate gaps.
      if (a && b && a.state === b.state) return [];
      return [{ entity_id, change: !a ? 'added' : !b ? 'removed' : 'changed', before_state: a ? a.state ?? null : null,
        after_state: b ? b.state ?? null : null, before_timestamp: before.ts, after_timestamp: after.ts, source: 'browser-local snapshot' }];
    });
  }

  _snapshotChoices() { return [...this._snapshots, ...this._legacySnapshots]; }

  _loadLegacyForComparison() {
    if (!this._snapshotScope) return;
    const L = this._lang === 'pl';
    if (!confirm(L ? 'Otworzyć wcześniejsze snapshoty tej karty w tej przeglądarce? Starsze zapisy nie mają oznaczonego użytkownika. Zostaną użyte tylko do porównania stanów, bez kopiowania lub usuwania zapisów.' : 'Open earlier snapshots of this card in this browser? Older snapshots have no user label. They will only be used for state comparison, without copying or deleting stored snapshots.')) return;
    try {
      const stored = JSON.parse(localStorage.getItem('ha-data-exporter-snapshots-' + (this._config.storage_key || 'default')) || '[]');
      this._legacySnapshots = Array.isArray(stored) ? stored.filter(snapshot => snapshot && typeof snapshot.entities === 'object' && snapshot.entities !== null) : [];
      this._comparison = [null, null];
      this._refreshComparisonControls();
    } catch (_) { alert(L ? 'Nie można odczytać wcześniejszych snapshotów lokalnych.' : 'Could not read earlier local snapshots.'); }
  }

  _comparisonFrame() {
    if (this._comparison.some(index => index === null) || this._comparison[0] === this._comparison[1]) return [];
    return this._compareSnapshots(this._snapshotChoices()[this._comparison[0]], this._snapshotChoices()[this._comparison[1]]);
  }

  async _ensureRegistryMetadata() {
    if (this._registryMetadata) return this._registryMetadata;
    if (this._registryPromise) return this._registryPromise;
    if (!this._hass?.callWS) { this._registryStatus='unavailable'; this._refreshRegistryControls(); return null; }
    this._registryStatus='loading'; this._refreshRegistryControls();
    const epoch = this._identityEpoch;
    const promise = this._loadRegistryMetadata().then(metadata => {
      if (epoch !== this._identityEpoch || !this._hass) return null;
      this._registryMetadata = metadata;
      this._registryStatus = 'ready';
      this._refreshRegistryControls();
      this._updateEntities();
      return metadata;
    }).catch(() => {
      if (epoch === this._identityEpoch) { this._registryStatus = 'unavailable'; this._refreshRegistryControls(); }
      return null;
    }).finally(() => { if (epoch === this._identityEpoch) this._registryPromise = null; });
    this._registryPromise = promise;
    return promise;
  }

  _installDataFeatures() {
    const L = this._lang === 'pl';
    const style = document.createElement('style');
    style.textContent = `
      .card {container-type:inline-size;container-name:data-card;}
      .card [hidden] {display:none!important;}
      .workspace-tabs {display:flex;gap:8px;margin:12px 0;align-items:stretch;} .workspace-tabs .btn {width:auto;flex:1;white-space:normal;} .workspace-tabs [aria-selected=true],#exportBar .btn-primary {background:#1d4ed8!important;color:#fff!important;font-weight:600;}
      #chooseEntities,#columnsHeading {font-size:13px;line-height:1.5;margin:16px 0 8px;} #exportColumns {margin:0 0 12px;border:1px solid var(--divider-color,#ddd);border-radius:8px;padding:8px 10px;} #columnSummary {display:flex;align-items:center;gap:8px;font-size:12px;} #columnSummary::before {content:"▸";} #exportColumns[open]>#columnSummary::before {content:"▾";} #columnSummaryText {white-space:nowrap;} #columnSummaryChange {margin-left:auto;font-weight:600;text-decoration:underline;} #columnSummary,.snapshot-comparison summary {min-height:44px;cursor:pointer;} #exportBar {border:1px solid var(--bento-border,#ddd);border-radius:8px;background:var(--bento-bg-2,var(--bento-bg,#f8fafc));padding:12px;gap:8px;} #exportBar #selectionScope {flex:1 1 100px;font-size:12px;line-height:1.5;} #exportBar .btn-primary {width:auto;flex:0 0 auto;} #exportBar select {width:180px;max-width:100%;} #exportBar label>span {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;} #exportColumns #columnControls{display:flex;flex-wrap:wrap;gap:8px;} #columnControls label{display:inline-flex;align-items:center;gap:6px;}
      .toolbar {flex-wrap:wrap;} .card button,.card select,.card input[type=text],.feature-controls label,.feature-controls summary {min-height:44px;} .card button,.intro-banner .intro-dismiss {min-width:44px;min-height:44px;} .intro-banner{padding-right:72px;} .feature-controls summary {display:flex;align-items:center;}
      .feature-controls {display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;}
      .feature-controls label {display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0;max-width:100%;}
      .feature-controls select {min-width:0;}
      .card label:has(input[type=checkbox]) {min-height:44px;min-width:44px;}
      .touch-checkbox {display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:44px;height:44px;cursor:pointer;}
      .touch-checkbox[hidden] {display:none;}
      .checkbox-cell:has(.touch-checkbox) {padding:0;min-width:44px;}
      .touch-checkbox:focus-within {outline:2px solid var(--primary-color,#2563eb);outline-offset:2px;border-radius:6px;}
      .feature-controls select {max-width:100%;} .card :focus-visible {outline:2px solid var(--primary-color,#2563eb);outline-offset:2px;}
      .snapshot-comparison {margin:12px 0;padding:12px;border:1px solid var(--divider-color,#ddd);border-radius:10px;} .snapshot-comparison[hidden]{display:none;} .snapshot-comparison p{overflow-wrap:anywhere;} .snapshot-comparison table,.snapshot-comparison thead,.snapshot-comparison tbody{display:block;width:100%;} .snapshot-comparison thead tr,.snapshot-comparison tbody tr{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);} .snapshot-comparison th,.snapshot-comparison td{display:block;min-width:0;white-space:normal;overflow-wrap:anywhere;padding:8px;} .snapshot-pages{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      #exportPreview {white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;} .record-fields {display:grid;grid-template-columns:max-content 1fr;gap:6px;} .record-fields dd {margin:0;overflow-wrap:anywhere;}
      @container data-card (max-width:499px) {
        .toolbar {gap:8px;} .toolbar input {min-width:0;flex:1 1 100%;}
        .table-container {overflow:visible;max-height:none;} table,tbody {display:block;width:100%;} thead {display:block;} thead tr {display:flex;flex-wrap:wrap;} thead th {display:block;}
        #entityBody > tr:not(.attr-row) {display:grid;grid-template-columns:44px 1fr 44px;gap:4px;padding:10px 0;border-bottom:1px solid var(--divider-color,#ddd);}
        #entityBody > tr:not(.attr-row) td {display:block;border:0;padding:4px;min-width:0;white-space:normal;overflow-wrap:anywhere;}
        #entityBody .checkbox-cell,#entityBody .expand-cell {width:44px;min-width:44px;padding:0;overflow:visible;}
        #entityBody .checkbox-cell {grid-column:1;grid-row:1 / 4;align-self:center;} #entityBody .expand-cell {grid-column:3;grid-row:1 / 4;align-self:center;}
        #entityBody .entity-name {grid-column:2;grid-row:1;font-weight:600;} #entityBody .entity-id {grid-column:2;grid-row:2;font-size:12px;} #entityBody .state-val {grid-column:2;grid-row:3;}
        #entityBody > tr:not(.attr-row) td:nth-child(6),#entityBody > tr:not(.attr-row) td:nth-child(7) {display:none;}
        .attr-row,.attr-row td {display:block;} .pagination {flex-wrap:wrap;} .record-fields {grid-template-columns:1fr;}
      }`;
    style.textContent += createUiV3().css + `
      :host {--bento-text:var(--hat-text,var(--_hat-text));--bento-text-secondary:var(--hat-text-2,var(--_hat-text-2));font-size:14px;}
      .card {font-family:var(--hat-font,var(--_hat-font));max-width:1200px;margin-inline:auto;}
      .card-header {flex-direction:row;flex-wrap:wrap;gap:8px;text-align:left;align-items:center;}
      .card-header h2 {flex:1 1 140px;min-width:0;overflow-wrap:anywhere;font-size:18px;}
      .card-header>div {margin-left:auto;}
      .card input,.card select,.card button {font:inherit;font-size:14px!important;}
      .card input::placeholder {color:var(--bento-text-secondary,#64748b);opacity:1;}
      .card :focus-visible {outline-color:var(--primary-text-color,#202124);}
      .workspace-tabs {flex-wrap:nowrap;overflow-x:auto;} .workspace-tabs .btn {white-space:nowrap;flex:1 0 auto;}
      #exportPreview:empty {display:none;}
      .snapshot-comparison .entity-id {overflow-wrap:normal;word-break:normal;overflow:auto;}
      .card .btn-primary,#exportBar .btn-primary,.workspace-tabs [aria-selected=true] {background:var(--hat-primary-fill-computed)!important;color:var(--hat-on-primary-computed)!important;}
      .card button:disabled {opacity:.5;cursor:default;}
      .intro-banner,:host(.bento-dark) .intro-banner {animation:none;background:var(--hat-card,var(--_hat-card));color:var(--hat-text,var(--_hat-text));font:inherit;padding:8px 60px 8px 12px;margin:0 0 8px;}
      .intro-banner::before {display:none;}
      .intro-banner .intro-headline,:host(.bento-dark) .intro-banner .intro-headline {display:list-item;background:none;color:inherit;font-size:14px;line-height:44px;margin:0;cursor:pointer;}
      .intro-banner:not([open]) {padding-right:12px;}
      .intro-banner .intro-headline {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .intro-banner .intro-steps li {font-size:14px;color:inherit;}
      .intro-banner .intro-dismiss {top:8px;right:8px;min-height:44px;min-width:44px;}
      .card label,.card summary,.card .entity-name,.card .state-val,#chooseEntities,#columnsHeading {font-size:14px;}
      .donate-section a {font-size:14px!important;}
      .mobile-sort {display:none;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;}
      .entity-id {font-family:ui-monospace,monospace;font-size:12px;}
      @container data-card (max-width:499px) {
        .mobile-sort {display:flex;} .entity-table thead {display:none;}
        #entityBody .entity-id {overflow-wrap:normal;word-break:normal;overflow:auto;max-width:100%;}
        .workspace-tabs .btn {font-size:14px;padding:8px;}
      }
    `;
    this.shadowRoot.append(style);
    createUiV3().applyTheme(this);
    const mobileSort = document.createElement('label');mobileSort.className='mobile-sort';
    mobileSort.innerHTML='<span id="mobileSortLabel"></span><select id="mobileSort"></select>';
    this.shadowRoot.querySelector('.table-container').before(mobileSort);
    mobileSort.querySelector('select').addEventListener('change',event=>{const [field,direction]=event.target.value.split(':');this._sortBy=field;this._sortAsc=direction==='asc';this._currentPage=0;this._updateEntities();});
    // Issue #6: the header checkbox is hidden in the narrow layout, so selection
    // tools are visible controls in every layout.
    const selectionTools=document.createElement('div');selectionTools.id='selectionTools';selectionTools.className='feature-controls';
    selectionTools.innerHTML='<button type="button" id="selectFiltered" class="btn btn-secondary btn-sm"></button><button type="button" id="clearSelection" class="btn btn-secondary btn-sm"></button>';
    selectionTools.querySelector('#selectFiltered').addEventListener('click',()=>{this._getFilteredEntities().forEach(entity=>this._selectedEntities.add(entity.entity_id));this._updateEntities();});
    selectionTools.querySelector('#clearSelection').addEventListener('click',()=>{this._selectedEntities.clear();const header=this.shadowRoot.getElementById('selectAll');if(header)header.checked=false;this._updateEntities();});
    const controls = document.createElement('section');
    controls.className = 'feature-controls';
    controls.id = 'registryFilters';
    controls.hidden = true;
    controls.innerHTML = `<label><span data-feature-label="area"></span><select id="areaFilter"></select></label>
      <label><span data-feature-label="device"></span><select id="deviceFilter"></select></label><button type="button" id="clearFilters"></button><button type="button" id="retryRegistryFilters" hidden></button><span id="registryStatus" role="status"></span>`;
    const toolbar=this.shadowRoot.querySelector('.toolbar');
    const exportPanel=document.createElement('section');exportPanel.id='exportWorkspace';exportPanel.setAttribute('role','tabpanel');exportPanel.setAttribute('aria-labelledby','exportTab');
    const records=document.createElement('section');records.id='recordsWorkspace';records.setAttribute('role','tabpanel');records.setAttribute('aria-labelledby','recordsTab');
    const tabs=document.createElement('div');tabs.setAttribute('role','tablist');tabs.className='workspace-tabs';
    tabs.innerHTML='<button type="button" id="exportTab" class="btn btn-primary" role="tab" aria-controls="exportWorkspace"></button><button type="button" id="recordsTab" class="btn btn-secondary" role="tab" aria-controls="recordsWorkspace"></button>';
    toolbar.before(tabs,exportPanel,records);
    const heading=document.createElement('h3');heading.id='chooseEntities';
    const add=document.createElement('button');add.type='button';add.id='addFilter';add.className='btn btn-secondary btn-sm';add.setAttribute('aria-controls','registryFilters');add.setAttribute('aria-expanded','false');toolbar.append(add);
    const chips=document.createElement('div');chips.id='activeFilters';chips.className='feature-controls';
    const columnsHeading=document.createElement('h3');columnsHeading.id='columnsHeading';
    const columns=document.createElement('details');columns.id='exportColumns';columns.innerHTML='<summary id="columnSummary"><span id="columnSummaryText"></span> <span id="columnSummaryChange"></span></summary><div id="columnControls"></div>';
    columns.append(this.shadowRoot.getElementById('formatSelect'),this.shadowRoot.getElementById('includeAttrs').parentElement);
    const bar=document.createElement('section');bar.id='exportBar';bar.className='feature-controls';
    bar.innerHTML='<span id="selectionScope" role="status"></span><label><span data-feature-label="scope"></span><select id="previewMode"><option value="selected"></option><option value="all"></option></select></label>';
    bar.append(this.shadowRoot.getElementById('exportBtn'));
    exportPanel.append(heading,toolbar,chips,controls,mobileSort,selectionTools,this.shadowRoot.querySelector('.table-container'),this.shadowRoot.getElementById('pagination'),columnsHeading,columns,bar);
    records.append(this.shadowRoot.querySelector('.snapshot-bar'));
    const enabledTabs = this._config.tabs || ['export','records'];
    for (const name of ['export','records']) this.shadowRoot.getElementById(name+'Tab').hidden = !enabledTabs.includes(name);
    const switchTab = name => {
      if (!enabledTabs.includes(name)) name = enabledTabs[0];
      this._workspaceTab=name;exportPanel.hidden=name!=='export';records.hidden=name!=='records';
      for(const [id,key] of [['exportTab','export'],['recordsTab','records']]) {const button=this.shadowRoot.getElementById(id);button.setAttribute('aria-selected',String(name===key));button.tabIndex=name===key?0:-1;button.classList.toggle('btn-primary',name===key);button.classList.toggle('btn-secondary',name!==key);}
    };
    const revealTab=button=>{const strip=tabs.getBoundingClientRect(),item=button.getBoundingClientRect();if(item.left<strip.left)tabs.scrollLeft-=strip.left-item.left;else if(item.right>strip.right)tabs.scrollLeft+=item.right-strip.right;};
    for(const [id,name] of [['exportTab','export'],['recordsTab','records']]) {
      const button=this.shadowRoot.getElementById(id);button.addEventListener('click',()=>{switchTab(name);revealTab(button);});
      button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?enabledTabs[0]:event.key==='End'?enabledTabs.at(-1):enabledTabs[(enabledTabs.indexOf(this._workspaceTab)+1)%enabledTabs.length];switchTab(next);const selected=this.shadowRoot.getElementById(next+'Tab');selected.focus();revealTab(selected);});
    }
    switchTab(this._workspaceTab||'export');
    add.addEventListener('click',()=>{controls.hidden=!controls.hidden;add.setAttribute('aria-expanded',String(!controls.hidden));if(!controls.hidden&&this._registryStatus==='idle')this._ensureRegistryMetadata();});
    const compare = document.createElement('section');
    compare.className = 'feature-controls';
    compare.innerHTML = `<span data-feature-label="comparison"></span><label><span data-feature-label="before"></span><select id="compareBefore"></select></label><label><span data-feature-label="after"></span><select id="compareAfter"></select></label><button type="button" id="exportDiff"></button><button type="button" id="loadLegacySnapshots"></button><span id="diffCount" role="status"></span>`;
    this.shadowRoot.querySelector('.snapshot-bar').after(compare);
    const preview = document.createElement('section');
    preview.innerHTML = '<p id="previewScope" role="status"></p><pre id="exportPreview" tabindex="0"></pre>';
    const comparison=document.createElement('section');comparison.id='snapshotComparison';comparison.className='snapshot-comparison';comparison.hidden=true;compare.after(comparison);
    comparison.after(preview);
    for (const [id, field] of [['areaFilter','_filterArea'],['deviceFilter','_filterDevice']]) this.shadowRoot.getElementById(id).addEventListener('change', e => { this[field] = e.target.value; this._currentPage=0; this._updateEntities(); });
    this.shadowRoot.getElementById('retryRegistryFilters').addEventListener('click', () => { if (this._registryPromise) return; this._registryMetadata=null; this._registryStatus='loading'; this._refreshRegistryControls(); this._ensureRegistryMetadata(); });
    this.shadowRoot.getElementById('clearFilters').addEventListener('click', () => {
      this._filterDomain=this._filterArea=this._filterDevice='all'; this._filterSearch=''; this._currentPage=0;
      for (const id of ['domainFilter','areaFilter','deviceFilter']) this.shadowRoot.getElementById(id).value='all';
      this.shadowRoot.getElementById('searchFilter').value=''; this._updateEntities();
    });
    columns.addEventListener('toggle', event => { if (event.currentTarget.open) this._refreshColumnControls(); });
    this.shadowRoot.getElementById('exportDiff').addEventListener('click', () => this._export('diff'));
    this.shadowRoot.getElementById('loadLegacySnapshots').addEventListener('click', () => this._loadLegacyForComparison());
    for (const [id,index] of [['compareBefore',0],['compareAfter',1]]) this.shadowRoot.getElementById(id).addEventListener('change', e => { this._comparison[index] = e.target.value === '' ? null : Number(e.target.value); this._refreshComparisonControls(); });
    for(const id of ['clearFilters','retryRegistryFilters','loadLegacySnapshots','exportDiff'])this.shadowRoot.getElementById(id)?.classList.add('btn','btn-secondary','btn-sm');
    this._refreshRegistryControls(); this._refreshColumnControls(); this._refreshComparisonControls(); this._refreshFeatureLabels();
  }

  _countLabel(value, forms) {
    const rule=new Intl.PluralRules(this._lang).select(value);
    return `${(this._formatUi || createFormatUi.forHass(this._hass)).number(value)} ${forms[rule] || forms.other}`;
  }

  _entityCount(value) {
    return this._countLabel(value,this._lang==='pl'?{one:'encja',few:'encje',many:'encji',other:'encji'}:{one:'entity',other:'entities'});
  }

  _collator() {
    const language=this._hass?.locale?.language || this._hass?.language || navigator.language;
    if(this._collationLanguage!==language){this._collationLanguage=language;this._nameCollator=new Intl.Collator(language,{numeric:true,sensitivity:'base'});}
    return this._nameCollator;
  }

  _displayTimestamp(value) {
    return (this._formatUi || createFormatUi.forHass(this._hass)).pointLabel(value, true) || '—';
  }

  _timestampAttribute(value) {
    if (!(typeof value === 'number' && Number.isFinite(value)) && !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))) return '';
    try { return new Date(value).toISOString(); } catch (_) { return ''; }
  }

  _refreshPresentationTimes() {
    this._refreshComparisonControls();
    this.shadowRoot.querySelectorAll('.history-time[datetime]').forEach(node=>{node.textContent=this._displayTimestamp(node.getAttribute('datetime'));});
  }

  _refreshColumnSummary() {
    const summary=this.shadowRoot.getElementById('columnSummaryText');if(!summary)return;
    const L=this._lang==='pl',count=(this._exportColumns??this._availableColumns()).length,format=this.shadowRoot.getElementById('formatSelect')?.value?.toUpperCase()||'CSV';
    const columns=this._countLabel(count,L?{one:'kolumna',few:'kolumny',many:'kolumn',other:'kolumn'}:{one:'column',other:'columns'});
    summary.textContent=`${columns} · ${format} · ${L?'Prywatne: wył.':'Private fields: off'}`;
    this.shadowRoot.getElementById('columnSummaryChange').textContent=L?'Zmień':'Change';
  }

  _refreshActiveFilters() {
    const host=this.shadowRoot.getElementById('activeFilters');if(!host)return;
    const focusedKey=this.shadowRoot.activeElement?.dataset.clearFilter;
    const L=this._lang==='pl';
    const filters=[['domain','_filterDomain','domainFilter',L?'Domena':'Domain'],['search','_filterSearch','searchFilter',L?'Szukaj':'Search'],['area','_filterArea','areaFilter',L?'Obszar':'Area'],['device','_filterDevice','deviceFilter',L?'Urządzenie':'Device']];
    // Issue #6: periodic updates keep the chips (and a focused chip) unless a filter changed.
    const signature=JSON.stringify([L,filters.map(([key,field,id])=>[key,this[field],this.shadowRoot.getElementById(id)?.selectedOptions?.[0]?.textContent||''])]);
    if(host.dataset.signature===signature)return;
    host.dataset.signature=signature;host.replaceChildren();
    for(const [key,field,id,label] of filters) {
      const value=this[field];if(!value||value==='all')continue;
      const control=this.shadowRoot.getElementById(id),text=control.selectedOptions?.[0]?.textContent||value;
      const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.dataset.clearFilter=key;button.textContent=`${label}: ${text} ×`;button.setAttribute('aria-label',`${L?'Usuń filtr':'Remove filter'}: ${label}: ${text}`);
      button.addEventListener('click',()=>{this[field]=key==='search'?'':'all';control.value=this[field];this._currentPage=0;this._updateEntities();control.focus();});host.append(button);if(key===focusedKey)button.focus({preventScroll:true});
    }
  }

  _refreshFeatureLabels() {
    const L=this._lang==='pl';
    const labels = L ? {area:'Obszar',device:'Urządzenie',columns:'Kolumny i kolejność eksportu',scope:'Zakres eksportu',comparison:'Porównanie snapshotów tylko w tej przeglądarce (wyłącznie stan)',before:'Przed',after:'Po'}
      : {area:'Area',device:'Device',columns:'Export columns and order',scope:'Export scope',comparison:'Snapshots in this browser only (state comparison)',before:'Before',after:'After'};
    this.shadowRoot.querySelectorAll('[data-feature-label]').forEach(node=>{node.textContent=labels[node.dataset.featureLabel];});
    for (const [id,text] of [['retryRegistryFilters',L?'Spróbuj ponownie':'Try again'],['addFilter',L?'+ Filtr':'+ Filter'],['chooseEntities',L?'1 · Wybierz encje':'1 · Choose entities'],['columnsHeading',L?'2 · Kolumny i format':'2 · Columns and format'],['exportTab',L?'Eksport':'Export'],['recordsTab',L?'Zapisy i porównanie':'Records and comparison'],['loadLegacySnapshots',L?'Otwórz wcześniejsze zapisy lokalne':'Open earlier local snapshots'],['clearFilters',L?'Wyczyść filtry':'Clear filters'],['previewExport',L?'Podgląd eksportu':'Preview export'],['exportDiff',L?'Eksport zmian stanów':'Export state changes']]) {const node=this.shadowRoot.getElementById(id);if(node)node.textContent=text;}
    const options=this.shadowRoot.getElementById('previewMode')?.options;
    if(options) [L?'Tylko zaznaczone':'Selected',L?'Wszystkie w filtrach':'All within filters'].forEach((text,i)=>options[i].textContent=text);
    this._refreshRegistryControls(); this._refreshComparisonControls();
  }

  _refreshRegistryControls() {
    this._syncExportContext();
    const L=this._lang==='pl', metadata=this._registryMetadata;
    for (const [id,entries,field,name] of [['areaFilter',metadata?.areas,'_filterArea','area'],['deviceFilter',metadata?.devices,'_filterDevice','device']]) {
      const select=this.shadowRoot.getElementById(id);if(!select)continue;
      const choices=[['all',L?'Wszystkie':'All'],['__none__',L?(name==='area'?'Bez obszaru':'Bez urządzenia'):(name==='area'?'No area':'No device')]];
      if(entries) Array.from(entries.values()).sort((a,b)=>this._collator().compare(String(a.name_by_user||a.name||a.id||a.area_id),String(b.name_by_user||b.name||b.id||b.area_id))).forEach(entry=>choices.push([name === 'area' ? entry.area_id : entry.id,entry.name_by_user||entry.name||entry.id||entry.area_id]));
      // Issue #6: periodic updates keep the options (and an open picker) unless they change.
      const signature=JSON.stringify(choices);
      if(select.dataset.signature!==signature){select.dataset.signature=signature;select.replaceChildren(...choices.map(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;return option;}));}
      if(select.value!==this[field])select.value=this[field];select.disabled=!metadata;
    }
    for(const [id,label] of [['domainFilter',L?'Domena':'Domain'],['formatSelect',L?'Format pliku':'File format']])this.shadowRoot.getElementById(id)?.setAttribute('aria-label',label);
    const retry=this.shadowRoot.getElementById('retryRegistryFilters');if(retry)retry.hidden=this._registryStatus!=='unavailable';
    const status=this.shadowRoot.getElementById('registryStatus');if(status)status.textContent=metadata?'':this._registryStatus==='idle'?(L?'Wczytaj rejestry HA, aby filtrować obszary i urządzenia.':'Load HA registries to filter areas and devices.'):this._registryStatus==='unavailable'?(L?'Rejestry niedostępne; filtry obszarów i urządzeń wyłączone.':'Registries unavailable; area and device filters disabled.'):(L?'Pobieranie rejestrów…':'Loading registries…');
  }

  _availableColumns() {
    // Issue #6: columns describe the current export scope (selected entities, or
    // all within filters) and only reviewed attributes, never every HA entity.
    const allowed = new Set(DATA_EXPORT_POLICY.allowlistedFields), keys = new Set();
    this._exportScopeEntities().forEach(entity => Object.keys(entity.attributes || {}).forEach(key => { if (allowed.has('attributes.' + key)) keys.add('attributes.' + key); }));
    return ['entity_id','friendly_name','state','domain','last_changed','device_id','device_name','area_id','area_name', ...Array.from(keys).sort()];
  }

  _exportScopeEntities() {
    const selected = this.shadowRoot?.getElementById('previewMode')?.value !== 'all' ? this._getSelectedEntities() : [];
    return selected.length ? selected : this._getFilteredEntities();
  }

  _refreshColumnControls() {
    this._syncExportContext();
    const container=this.shadowRoot.getElementById('columnControls');if(!container)return;
    const L=this._lang==='pl';
    this._refreshColumnSummary();
    const available=this._availableColumns();
    const selected=this._exportColumns ?? available;
    container.dataset.available=JSON.stringify(available);
    container.replaceChildren();
    for(const key of [...selected,...available.filter(key=>!selected.includes(key))]) {
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=selected.includes(key);check.setAttribute('aria-label',key);
      check.addEventListener('change',()=>{const current=this._exportColumns ?? [...available];this._exportColumns=check.checked?[...current,key]:current.filter(k=>k!==key);this._refreshColumnControls();Array.from(container.querySelectorAll('input')).find(node => node.getAttribute('aria-label') === key)?.focus();});
      label.append(check,document.createTextNode(key));container.append(label);
      if(selected.includes(key)) for(const [offset,text] of [[-1,L?'W górę':'Move up'],[1,L?'W dół':'Move down']]) {
        const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent=text;button.dataset.columnMove=String(offset);button.dataset.columnKey=key;button.setAttribute('aria-label',`${text}: ${key}`);button.disabled=selected.indexOf(key)+offset<0||selected.indexOf(key)+offset>=selected.length;
        button.addEventListener('click',()=>{const list=[...selected],i=list.indexOf(key);[list[i],list[i+offset]]=[list[i+offset],list[i]];this._exportColumns=list;this._refreshColumnControls();Array.from(container.querySelectorAll('button')).find(node=>node.getAttribute('aria-label')===`${text}: ${key}`)?.focus();});container.append(button);
      }
    }
  }

  _refreshComparisonControls() {
    this._syncExportContext();
    const L=this._lang==='pl';
    for(const [id,index] of [['compareBefore',0],['compareAfter',1]]) {
      const select=this.shadowRoot.getElementById(id);if(!select)continue;
      select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=L?'Wybierz zapis':'Choose snapshot';select.append(empty);
      this._snapshotChoices().forEach((snapshot,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}: ${this._displayTimestamp(snapshot.ts)}`;select.append(option);});
      select.value=this._comparison[index]===null?'':String(this._comparison[index]);
    }
    const valid=this._comparison.every(i=>i!==null&&!!this._snapshotChoices()[i])&&this._comparison[0]!==this._comparison[1];
    const button=this.shadowRoot.getElementById('exportDiff');if(button)button.disabled=!valid;
    const legacy=this.shadowRoot.getElementById('loadLegacySnapshots');if(legacy)legacy.disabled=!this._snapshotScope;
    const rows=valid?this._comparisonFrame():[];
    const count=this.shadowRoot.getElementById('diffCount');if(count)count.textContent=valid?`${this._countLabel(rows.length,L?{one:'zmiana',few:'zmiany',many:'zmian',other:'zmiany'}:{one:'change',other:'changes'})}; ${L?'unavailable/unknown zachowane dosłownie, brak encji = null':'unavailable/unknown are literal, absent entity = null'}`:'';
    this._renderSnapshotComparison(rows,valid);
  }

  _renderSnapshotComparison(rows, valid) {
    const host=this.shadowRoot.getElementById('snapshotComparison');if(!host)return;
    const sourceState=host.querySelector('[data-comparison-source]');
    const sourceOpen=!!sourceState?.open,sourceFocused=this.shadowRoot.activeElement===sourceState?.querySelector('summary');
    const pair=this._comparison.map(i=>i===null?'':`${i}:${this._snapshotChoices()[i]?.ts||''}`).join('|');
    const samePair=pair===this._comparisonViewPair;
    if(!samePair){this._comparisonViewPair=pair;this._comparisonPage=0;}
    host.replaceChildren();host.hidden=!valid;if(!valid)return;
    const L=this._lang==='pl',epoch=this._identityEpoch,before=this._snapshotChoices()[this._comparison[0]],after=this._snapshotChoices()[this._comparison[1]];
    const sourceDetails=document.createElement('details'),sourceSummary=document.createElement('summary');sourceDetails.dataset.comparisonSource='';sourceSummary.textContent=L?'Źródło: zapisy w tej przeglądarce · tylko stany':'Source: snapshots in this browser · state only';sourceDetails.append(sourceSummary);
    const note=document.createElement('p');note.textContent=L?'Wyłącznie stany zapisane w tej przeglądarce. Atrybuty nie są porównywane; brak encji nie jest zerem.':'State only, saved in this browser. Attributes are not compared; an absent entity is not zero.';
    const times=document.createElement('p');times.className='snapshot-times';
    for (const [label,snapshot] of [[L?'Przed':'Before',before],[L?'Po':'After',after]]) {
      if(times.childNodes.length)times.append(document.createTextNode(' · '));
      times.append(document.createTextNode(label+': '));const time=document.createElement('time');time.dateTime=snapshot.ts;time.textContent=this._displayTimestamp(snapshot.ts);times.append(time);
    }
    sourceDetails.append(note);sourceDetails.open=samePair&&sourceOpen;host.append(times,sourceDetails);if(samePair&&sourceFocused)sourceSummary.focus({preventScroll:true});
    if(!rows.length){const empty=document.createElement('p');empty.setAttribute('role','status');empty.textContent=L?'Brak zmienionych stanów.':'No changed states.';host.append(empty);return;}
    const pageSize=20,pages=Math.ceil(rows.length/pageSize);this._comparisonPage=Math.max(0,Math.min(this._comparisonPage||0,pages-1));
    const table=document.createElement('table');table.setAttribute('aria-label',L?'Zmiany stanów snapshotów':'Snapshot state changes');
    const head=table.createTHead().insertRow();for(const label of [L?'Encja':'Entity',L?'Przed':'Before',L?'Po':'After']){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}
    const body=table.createTBody();for(const row of rows.slice(this._comparisonPage*pageSize,(this._comparisonPage+1)*pageSize)){
      const tr=body.insertRow();for(const [index,value] of [row.entity_id,row.before_state,row.after_state].entries()){
        const td=tr.insertCell();
        if(index===0){td.className='entity-id';td.tabIndex=0;td.title=String(value);td.innerHTML=_esc(String(value)).replace(/[._]/g,'$&<wbr>');}
        else td.textContent=value===null?(L?'Brak encji':'Not present'):String(value);
      }
    }
    host.append(table);
    if(pages>1){const nav=document.createElement('nav');nav.className='snapshot-pages';nav.setAttribute('aria-label',L?'Strony zmian snapshotów':'Snapshot changes pages');
      for(const [offset,label] of [[-1,L?'Poprzednie zmiany snapshotów':'Previous snapshot changes'],[1,L?'Następne zmiany snapshotów':'Next snapshot changes']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label);button.disabled=this._comparisonPage+offset<0||this._comparisonPage+offset>=pages;button.addEventListener('click',()=>{if(this._identityEpoch!==epoch||this._snapshotChoices()[this._comparison[0]]!==before||this._snapshotChoices()[this._comparison[1]]!==after)return;this._comparisonPage+=offset;this._renderSnapshotComparison(rows,true);host.querySelector(`button[aria-label="${label}"]`)?.focus();});nav.append(button);}
      const status=document.createElement('span');status.textContent=`${this._comparisonPage+1} / ${pages} (${rows.length})`;nav.append(status);host.append(nav);
    }
  }

  _toCSV(data) {
    if (data.length === 0) return '';
    const baseHeaders = ['entity_id', 'friendly_name', 'state', 'domain', 'last_changed', 'device_id', 'device_name', 'area_id', 'area_name'];
    const attrKeys = new Set();
    if (this._includeAttrsInExport) {
      data.forEach(row => {
        if (row.attributes) {
          Object.keys(row.attributes).forEach(k => attrKeys.add(k));
        }
      });
    }
    const usedHeaders = new Set(baseHeaders);
    const attributeColumns = [...attrKeys].sort().map(key => {
      let header = key;
      while (usedHeaders.has(header)) header = 'attributes.' + header;
      usedHeaders.add(header);
      return { key, header };
    });
    const headers = [...baseHeaders, ...attributeColumns.map(column => column.header)];
    const escape = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      // Entity states and attributes can contain spreadsheet formulas. Keep
      // actual numbers numeric while forcing untrusted formula-like text inert.
      const unsafe = typeof val === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(str);
      const safe = unsafe ? "'" + str : str;
      return unsafe || /[,"\r\n\t]/.test(safe)
        ? '"' + safe.replace(/"/g, '""') + '"'
        : safe;
    };
    const rows = [headers.map(escape).join(',')];
    data.forEach(row => {
      const values = [
        ...baseHeaders.map(header => escape(row[header])),
        ...attributeColumns.map(column => escape(row.attributes ? row.attributes[column.key] : ''))
      ];
      rows.push(values.join(','));
    });
    return rows.join('\n');
  }

  _toYAML(data) {
    let yaml = '';
    data.forEach(item => {
      yaml += `- entity_id: ${JSON.stringify(item.entity_id)}\n`;
      yaml += `  friendly_name: ${JSON.stringify(item.friendly_name)}\n`;
      yaml += `  state: ${JSON.stringify(item.state)}\n`;
      yaml += `  domain: ${JSON.stringify(item.domain)}\n`;
      yaml += `  last_changed: ${JSON.stringify(item.last_changed)}\n`;
      yaml += `  device_id: ${JSON.stringify(item.device_id)}\n`;
      yaml += `  device_name: ${JSON.stringify(item.device_name)}\n`;
      yaml += `  area_id: ${JSON.stringify(item.area_id)}\n`;
      yaml += `  area_name: ${JSON.stringify(item.area_name)}\n`;
      if (item.attributes && Object.keys(item.attributes).length > 0) {
        yaml += `  attributes:\n`;
        Object.entries(item.attributes).forEach(([k, v]) => {
          yaml += `    ${JSON.stringify(k)}: ${JSON.stringify(v ?? null)}\n`;
        });
      }
    });
    return yaml;
  }

  // --- Pagination helper ---
  _renderPagination(tabName, totalItems) {
    if (!this._tabPages[tabName]) this._tabPages[tabName] = 1;
    const pageSize = this._pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(this._tabPages[tabName], totalPages);
    this._tabPages[tabName] = page;
    return `
      <div class="pagination">
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>&#8249; Prev</button>
        <span class="pagination-info">${page} / ${totalPages} (${totalItems})</span>
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next &#8250;</button>
        <select class="page-size-select" data-page-tab="${tabName}" data-action="page-size">
          ${[10,15,25,50].map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}/page</option>`).join('')}
        </select>
      </div>`;
  }

  _paginateItems(items, tabName) {
    if (!this._tabPages[tabName]) this._tabPages[tabName] = 1;
    const start = (this._tabPages[tabName] - 1) * this._pageSize;
    return items.slice(start, start + this._pageSize);
  }

  async _fetchHistory(entityId) {
    const identityEpoch = this._identityEpoch;
    if (!this._historyCache) this._historyCache = {};
    const containerId = 'history-' + entityId.replace(/\./g, '_');
    const container = this.shadowRoot.getElementById(containerId);
    if (!container) return;

    // Check cache (valid for 30s)
    const cached = this._historyCache[entityId];
    if (cached && Date.now() - cached.ts < 30000) {
      this._renderHistory(container, cached.data, entityId);
      return;
    }

    container.innerHTML = '<span class="history-loading">' + this._t.loadingHistory + '</span>';

    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const url = '/api/history/period/' + start + '?filter_entity_id=' + entityId + '&end_time=' + end + '&minimal_response&no_attributes';
      // Get auth token - try multiple paths
      let token = '';
      try { token = this._hass.auth.data.access_token; } catch(e) { console.debug('[ha-data-exporter] caught:', e); }
      if (!token) try { token = this._hass.auth._data.access_token; } catch(e) { console.debug('[ha-data-exporter] caught:', e); }
      if (!token) try { token = this._hass.auth.accessToken; } catch(e) { console.debug('[ha-data-exporter] caught:', e); }
      const headers = token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const resp = await fetch(url, { headers });
      if (identityEpoch !== this._identityEpoch || !this._hass) return;
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (identityEpoch !== this._identityEpoch || !this._hass) return;
      const states = data && data[0] ? data[0] : [];
      // Take last 5 unique state changes
      const changes = [];
      for (let i = states.length - 1; i >= 0 && changes.length < 5; i--) {
        const s = states[i];
        const st = s.s || s.state || '?';
        const tm = s.lu || s.lc || s.last_updated || s.last_changed || '';
        if (changes.length === 0 || changes[changes.length - 1].state !== st) {
          changes.push({ state: st, time: tm });
        }
      }
      changes.reverse();
      this._historyCache[entityId] = { data: changes, ts: Date.now() };
      this._renderHistory(container, changes, entityId);
    } catch (err) {
      if (identityEpoch !== this._identityEpoch || !this._hass) return;
      container.innerHTML = '<span class="history-loading">' + this._t.loadHistoryError + ' ' + _esc(err.message) + '</span>';
    }
  }

  _renderHistory(container, changes, entityId) {
    if (!changes || changes.length === 0) {
      container.innerHTML = '<span class="history-loading">' + this._t.noStateChanges + '</span>';
      return;
    }
    let html = '';
    changes.forEach((ch, i) => {
      const timeStr = this._displayTimestamp(ch.time);
      const isCurrent = i === changes.length - 1;
      html += '<div class="history-item' + (isCurrent ? '' : '') + '">';
      html += '<time class="history-time" datetime="' + _esc(this._timestampAttribute(ch.time)) + '">' + _esc(timeStr) + '</time>';
      if (i > 0) html += '<span class="history-arrow">\u2192</span>';
      html += '<span class="history-state">' + _esc(ch.state || '?') + '</span>';
      if (isCurrent) html += ' <span style="font-size:10px;color:var(--bento-primary)">(' + this._t.now + ')</span>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  _setupPaginationListeners() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.pageTab;
        const page = parseInt(e.target.dataset.page);
        if (tab && page > 0) {
          this._tabPages[tab] = page;
          this._render ? this._render() : (this.render ? this.render() : this.renderCard());
        }
      });
    });
    this.shadowRoot.querySelectorAll('.page-size-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this._pageSize = parseInt(e.target.value);
        Object.keys(this._tabPages).forEach(k => this._tabPages[k] = 1);
        this._render ? this._render() : (this.render ? this.render() : this.renderCard());
      });
    });
  }

}

if (!customElements.get('ha-data-exporter')) { customElements.define('ha-data-exporter', HADataExporter); }

console.info(
  '%c  HA-DATA-EXPORTER  %c v4.3.1 ',
  'background: #1976d2; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #e3f2fd; color: #1976d2; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

class HaDataExporterEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._lang='en'; }
  set hass(hass) { const lang=(hass?.language||navigator.language||'').startsWith('pl')?'pl':'en';if(lang!==this._lang){this._lang=lang;this._render();} }
  setConfig(config) { this._config=JSON.parse(JSON.stringify(config || {}));this._render(); }
  _dispatch() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:JSON.parse(JSON.stringify(this._config))},bubbles:true,composed:true})); }
  _render() {
    const L=this._lang==='pl',root=this.shadowRoot;
    const active=root.activeElement,focus=active?.id,start=active?.selectionStart,end=active?.selectionEnd;
    root.innerHTML=`<style>:host{display:block;padding:16px;color:var(--primary-text-color)}.sentence{line-height:2.4;display:flex;align-items:center;flex-wrap:wrap;gap:8px}input,select{box-sizing:border-box;min-height:44px;padding:8px;border:1px solid var(--divider-color,#ccc);border-radius:8px;background:var(--card-background-color);color:inherit;max-width:100%}label{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}:focus-visible{outline:2px solid var(--primary-color,#2563eb);outline-offset:2px}#editorError{color:var(--error-color,#b91c1c)}</style>
      <h3>Data Exporter</h3>
      <p>${L?'Eksportuj encje w wybranym formacie. Snapshoty pozostają w tej przeglądarce.':'Export entities in your chosen format. Snapshots stay in this browser.'}</p>
      <p class="sentence"><label>${L?'Tytuł karty':'Card title'} <input id="cf_title" type="text"></label></p>
      <p class="sentence"><label>${L?'Eksportuj domeny (oddziel przecinkami; puste = wszystkie)':'Export domains (comma separated; empty = all)'} <input id="cf_domains" type="text"></label></p>
      <p class="sentence"><label>${L?'Początkowa zakładka':'Initial tab'} <select id="cf_default_tab"><option value="export">${L?'Eksport':'Export'}</option><option value="records">${L?'Zapisy i porównanie':'Records and comparison'}</option></select></label></p>
      <p class="sentence"><span>${L?'Dostępne zakładki':'Available tabs'}</span> <label><input id="cf_tab_export" type="checkbox">${L?'Eksport':'Export'}</label> <label><input id="cf_tab_records" type="checkbox">${L?'Zapisy i porównanie':'Records and comparison'}</label></p>
      <p class="sentence"><label><input id="cf_show_help" type="checkbox">${L?'Pokaż pomoc':'Show help'}</label><label><input id="cf_show_support" type="checkbox">${L?'Pokaż administratorowi link wsparcia':'Show support link to administrators'}</label></p>
      <p class="sentence"><label>${L?'Domyślny format':'Default format'} <select id="cf_default_format"><option value="csv">CSV</option><option value="json">JSON</option><option value="yaml">YAML</option></select></label><label>${L?'Encji na stronę':'Entities per page'} <input id="cf_page_size" type="number" min="1" max="1000" step="1"></label></p>
      <p class="sentence"><label><input id="cf_show_attributes" type="checkbox"> ${L?'Dołączaj atrybuty do eksportu':'Include attributes in exports'}</label></p>
      <p class="sentence"><label>${L?'Klucz lokalnych snapshotów':'Local snapshot storage key'} <input id="cf_storage_key" type="text"></label></p>
      <p id="editorError" role="alert"></p>`;
    const values={default_tab:this._config.default_tab??this._config.tabs?.[0]??'export',title:this._config.title??'Data Exporter',domains:Array.isArray(this._config.domains)?this._config.domains.join(', '):'',default_format:this._config.default_format??'csv',page_size:this._config.page_size??50,storage_key:this._config.storage_key??''};
    for(const [key,value] of Object.entries(values))root.getElementById('cf_'+key).value=String(value);
    root.getElementById('cf_show_attributes').checked=this._config.show_attributes!==false;
    const enabledTabs = this._config.tabs || ['export','records'];
    for(const option of root.getElementById('cf_default_tab').options)option.disabled=!enabledTabs.includes(option.value);
    for(const name of ['export','records']){
      const control=root.getElementById('cf_tab_'+name);control.checked=enabledTabs.includes(name);
      control.addEventListener('change',()=>{
        const tabs=['export','records'].filter(tab=>root.getElementById('cf_tab_'+tab).checked);
        if(!tabs.length){control.checked=true;root.getElementById('editorError').textContent=L?'Wybierz co najmniej jedną zakładkę.':'Choose at least one tab.';return;}
        this._config={...this._config,tabs,default_tab:tabs.includes(this._config.default_tab)?this._config.default_tab:tabs[0]};
        this._dispatch();this._render();
      });
    }
    for(const key of ['show_help','show_support']){
      const control=root.getElementById('cf_'+key);control.checked=this._config[key]!==false;
      control.addEventListener('change',()=>{this._config={...this._config,[key]:control.checked};root.getElementById('editorError').textContent='';this._dispatch();});
    }
    for(const key of [...Object.keys(values),'show_attributes'])root.getElementById('cf_'+key).addEventListener(key==='show_attributes'||key==='default_format'||key==='default_tab'?'change':'input',event=>{
      let value=key==='show_attributes'?event.target.checked:event.target.value,error='';
      if(key==='page_size') {value=Number(value);if(!Number.isInteger(value)||value<1||value>1000)error=L?'Liczba encji na stronę musi być całkowita od 1 do 1000.':'Entities per page must be an integer from 1 to 1000.';}
      if(key==='domains') {value=value.split(',').map(v=>v.trim()).filter(Boolean);if(value.some(v=>! /^[a-z_][a-z0-9_]*$/.test(v)))error=L?'Domeny: użyj małych liter, cyfr i podkreślenia, oddzielonych przecinkami.':'Domains: use lowercase letters, digits and underscores separated by commas.';value=value.length?value:null;}
      if(key==='storage_key'&&value.length>128)error=L?'Klucz snapshotów może mieć maksymalnie 128 znaków.':'Snapshot storage key may have at most 128 characters.';
      if(key==='default_tab'&&!enabledTabs.includes(value))error=L?'Wybierz dostępną zakładkę.':'Choose an available tab.';
      if(key==='default_format'&&!['csv','json','yaml'].includes(value))error=L?'Wybierz CSV, JSON lub YAML.':'Choose CSV, JSON or YAML.';
      root.getElementById('editorError').textContent=error;event.target.setAttribute('aria-invalid',String(!!error));event.target.setAttribute('aria-describedby','editorError');if(error)return;
      this._config={...this._config,[key]:value};this._dispatch();
    });
    if(focus){const node=root.getElementById(focus);node?.focus();if(node?.type==='text'&&start!==null)node.setSelectionRange(start,end);}
  }
  connectedCallback() {this._render();}
}
if (!customElements.get('ha-data-exporter-editor')) { customElements.define('ha-data-exporter-editor', HaDataExporterEditor); }

})();

window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'ha-data-exporter')) window.customCards.push({
  type: 'ha-data-exporter',
  name: 'Data Exporter',
  description: 'Export HA entities, states, and attributes to CSV/JSON/YAML',
  preview: true
});
