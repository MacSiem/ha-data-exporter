/* HA Tools split — ha-data-exporter v4.0.0 (2026-05-10) — single-tool standalone repo */
(function() {
'use strict';

// XSS protection helper (reuse global from panel, fallback for standalone)
const _esc = window._haToolsEsc || ((s) => typeof s === 'string' ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]) : (s ?? ''));

// -- HA Tools Persistence (stub -- full impl in ha-tools-panel.js) --
window._haToolsPersistence = window._haToolsPersistence || { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-data-exporter-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-data-exporter] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-data-exporter-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-data-exporter-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };


/**
 * Home Assistant Data Exporter Card
 * Export devices, entities, states, and attributes to CSV/JSON
 */

/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
if (typeof window !== 'undefined' && !window.HAToolsBentoCSS) {
  window.HAToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v1.0
   ═══════════════════════════════════════════════ */

/* ── CSS Custom Properties ───────────────────── */
:host {
  /* Primary palette */
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);

  /* Theme — maps to HA theme vars with light fallbacks */
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);

  /* Radii */
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;

  /* Shadows */
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);

  /* Transition */
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: block;
  color: var(--bento-text);
}

/* ── Dark mode ───────────────────────────────── */
@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-border: var(--divider-color, #2a2a4a);
    --bento-text: var(--primary-text-color, #e0e0e0);
    --bento-text-secondary: var(--secondary-text-color, #a0a0b0);
    --bento-text-muted: var(--disabled-text-color, #6a6a7a);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --bento-primary-light: rgba(59,130,246,0.15);
    --bento-success-light: rgba(16,185,129,0.15);
    --bento-error-light: rgba(239,68,68,0.15);
    --bento-warning-light: rgba(245,158,11,0.15);
    color-scheme: dark !important;
  }
  .card, .card-container, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg); color: var(--bento-text); border-color: var(--bento-border); }
  .stat, .stat-card, .summary-card, .metric-card, .kpi-card, .health-card { background: var(--bento-bg); border-color: var(--bento-border); }
  .tab-content, .section { color: var(--bento-text); }
  table th { background: var(--bento-bg); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  tr:hover td { background: rgba(59,130,246,0.08); }
  .empty-state, .no-data { color: var(--bento-text-secondary); }
  .schedule-section, .settings-section, .detail-panel, .details, .device-detail { background: var(--bento-bg); border-color: var(--bento-border); }
  .addon-list, .content-item { background: rgba(255,255,255,0.05); }
  .chart-container { background: var(--bento-bg); border-color: var(--bento-border); }
  pre, code { background: #1e293b !important; color: #e2e8f0 !important; }
}

/* ── Reset ───────────────────────────────────── */
* { box-sizing: border-box; }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-sm);
  color: var(--bento-text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 16px 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-icon { font-size: 22px; }
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-border);
  color: var(--bento-text-secondary);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 500;
}
.content { padding: 16px 20px 20px; }

/* ── Tabs (Bento unified) ────────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important;
  gap: 4px !important;
  border-bottom: 2px solid var(--bento-border, var(--divider-color, #334155)) !important;
  padding: 0 4px !important;
  margin-bottom: 20px !important;
  overflow-x: auto !important; overflow-y: hidden !important; -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 10px 18px !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text-secondary, var(--secondary-text-color, #94A3B8)) !important;
  border-bottom: 2px solid transparent !important;
  margin-bottom: -2px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  white-space: nowrap !important;
  border-radius: 0 !important;
  flex: none !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.08) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  color: var(--bento-primary, #3B82F6) !important;
  border-bottom-color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.04) !important;
  font-weight: 600 !important;
}

/* ── Tab content animation ───────────────────── */
.tab-content {
  display: block;
}
.tab-content.active {
  animation: bentoFadeIn 0.3s ease-out;
}
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards ────────────────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-card, var(--card-background-color, #1E293B)) !important;
  border: 1px solid var(--bento-border, var(--divider-color, #334155)) !important;
  border-radius: var(--bento-radius-sm, 10px) !important;
  padding: 16px !important;
  text-align: center !important;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  box-shadow: var(--bento-shadow-md);
}
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--bento-text);
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px;
  color: var(--bento-text-secondary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ── Overview grid (2×2 stat layout) ─────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

/* ── Section headers ─────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--bento-text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 12px 0 8px;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--bento-primary), transparent);
  border-radius: 2px;
  animation: bentoLoad 1s infinite;
  margin-bottom: 8px;
}
@keyframes bentoLoad { 0% { background-position: 0; } 100% { background-position: 200px; } }

.empty-state, .no-data, .no-results {
  text-align: center;
  color: var(--bento-text-secondary);
  padding: 32px 16px;
  font-size: 13px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
}
.info-note, .tip-box {
  font-size: 12px;
  color: var(--bento-text-secondary);
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
  padding: 8px 10px;
  border-left: 3px solid var(--bento-primary);
  margin-top: 8px;
}
.last-updated {
  font-size: 11px;
  color: var(--bento-text-muted);
  text-align: right;
  margin-top: 8px;
}

/* ── Buttons ─────────────────────────────────── */
.refresh-btn {
  background: var(--bento-border);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--bento-text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.refresh-btn:hover { background: var(--bento-primary); color: white; }

.toggle-btn, .action-btn {
  background: var(--bento-primary);
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.toggle-btn:hover, .action-btn:hover { opacity: .85; }

.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--bento-transition);
}
.send-btn:hover, .btn-primary:hover {
  background: var(--bento-primary-hover);
  transform: translateY(-1px);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Badges / Status ─────────────────────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* ── Count badges (inline) ───────────────────── */
.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.error-badge { background: rgba(239,68,68,0.13); color: var(--bento-error); }
.warn-badge  { background: rgba(245,158,11,0.13); color: var(--bento-warning); }
.info-badge  { background: rgba(59,130,246,0.13); color: var(--bento-primary); }
.ok-badge    { background: rgba(16,185,129,0.13); color: var(--bento-success); }

/* ── Tables ───────────────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg);
  color: var(--bento-text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid var(--bento-border);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text);
  font-size: 13px;
}
tr:hover td { background: var(--bento-primary-light); }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  font-size: 13px;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-border);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 14px;
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px 6px;
  padding: 8px;
  border-radius: var(--bento-radius-sm);
  margin-bottom: 4px;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
}
.error-entry { background: var(--bento-error-light); border: 1px solid rgba(239,68,68,0.13); }
.warn-entry  { background: var(--bento-warning-light); border: 1px solid rgba(245,158,11,0.13); }
.log-time { color: var(--bento-text-muted); flex-shrink: 0; }
.log-domain {
  font-weight: 600;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary);
  flex-basis: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  min-width: 0;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 10px 14px;
  border-radius: var(--bento-radius-sm);
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 12px; }
  .tabs { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; gap: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 10px !important; font-size: 12px !important; white-space: nowrap !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 18px !important; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px !important; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; }
  .log-domain { max-width: 60%; font-size: 11px; }
  .log-msg { flex-basis: 100%; max-width: 100%; overflow-wrap: anywhere; font-size: 11px; }
  pre { white-space: pre-wrap; word-break: break-all; max-width: calc(100vw - 80px); overflow-x: auto; }
  .panels, .board { flex-direction: column; }
  .column { min-width: unset; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
}

/* ── Mobile — 480 px ─────────────────────────── */
@media (max-width: 480px) {
  .tabs { gap: 1px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 8px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 16px !important; }
}
`;
}
// XSS escape singleton (idempotent)
if (typeof window !== 'undefined') {
  window._haToolsEsc = window._haToolsEsc || (function(){
    var MAP = {};
    MAP[String.fromCharCode(38)] = '&amp;';
    MAP[String.fromCharCode(60)] = '&lt;';
    MAP[String.fromCharCode(62)] = '&gt;';
    MAP[String.fromCharCode(34)] = '&quot;';
    MAP[String.fromCharCode(39)] = '&#39;';
    return function(s){ return typeof s === 'string' ? s.replace(/[&<>"']/g, function(c){ return MAP[c]; }) : (s == null ? '' : s); };
  })();
}
// Universal donate footer injector — guarantees the support box appears
// on every split-tool card regardless of internal render state.
if (typeof window !== 'undefined' && !window.__haToolsSplitDonateInjector) {
  window.__haToolsSplitDonateInjector = true;
  var SPLIT_TAGS = ['ha-purge-cache','ha-yaml-checker','ha-data-exporter','ha-baby-tracker','ha-chore-tracker','ha-energy-optimizer','ha-energy-insights','ha-energy-email','ha-log-email','ha-smart-reports','ha-network-map','ha-trace-viewer','ha-automation-analyzer','ha-storage-monitor','ha-backup-manager','ha-security-check','ha-device-health','ha-sentence-manager','ha-encoding-fixer','ha-entity-renamer','ha-frigate-privacy','ha-vacuum-water-monitor'];
  var DONATE_HTML = ''
    + '<div class="donate-section" data-source="ha-tools-split-injector">'
    + '  <div class="donate-text">'
    + '    <h3>❤️ Support HA Tools Development</h3>'
    + '    <p>If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!</p>'
    + '  </div>'
    + '  <div class="donate-buttons">'
    + '    <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>'
    + '    <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>'
    + '  </div>'
    + '</div>';
  function deepFindAll(tag, root) {
    var out = [];
    (function walk(node){
      if (!node || !node.querySelectorAll) return;
      var children = node.querySelectorAll('*');
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.tagName && c.tagName.toLowerCase() === tag) out.push(c);
        if (c.shadowRoot) walk(c.shadowRoot);
      }
    })(root || document);
    return out;
  }
  // Per-tool prerequisite check + inline install banner
  var PREREQS = {
    'ha-energy-email': { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-log-email':    { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-encoding-fixer': { shellCommand: 'fix_encoding', label: 'shell_command.fix_encoding (optional advanced feature)', kind: 'shell_command_optional' }
  };
  var PREREQ_HTML_CACHE = {};
  function buildPrereqBanner(tag, prereq, hass) {
    if (PREREQ_HTML_CACHE[tag]) return PREREQ_HTML_CACHE[tag];
    var html = '';
    if (prereq.kind === 'integration') {
      html = '<div class="prereq-banner prereq-error" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">⚠️</div>' +
        '<div class="prereq-text">' +
          '<strong>This tool requires the ' + prereq.label + '</strong><br>' +
          'Install it from HACS: <code>https://github.com/MacSiem/' + prereq.repo + '</code> ' +
          '(Category: <strong>Integration</strong>) — then add <code>' + prereq.service + ':</code> to your <code>configuration.yaml</code> and restart HA.' +
        '</div>' +
        '<a class="prereq-cta" href="https://github.com/MacSiem/' + prereq.repo + '" target="_blank" rel="noopener noreferrer">Open install guide ↗</a>' +
      '</div>';
    } else if (prereq.kind === 'shell_command_optional') {
      html = '<div class="prereq-banner prereq-info" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">💡</div>' +
        '<div class="prereq-text">' +
          '<strong>Optional advanced feature: deep file scan</strong><br>' +
          'To enable scanning of <code>configuration.yaml</code> files, install the bundled <code>encoding_scanner.py</code> + add <code>shell_command:</code> entries. See README.' +
        '</div>' +
      '</div>';
    }
    PREREQ_HTML_CACHE[tag] = html;
    return html;
  }
  function injectAll() {
    SPLIT_TAGS.forEach(function(tag){
      deepFindAll(tag).forEach(function(el){
        // panel_custom auto-init: HA assigns hass/panel/narrow but does not always call setConfig.
        if (typeof el.setConfig === 'function' && !el.config && !el._config) {
          try { el.setConfig({ type: 'custom:' + tag, title: tag }); } catch(e) {}
        }
        if (!el.shadowRoot) return;
        // 1) Prereq banner — checked every poll so it disappears when prereq becomes available
        var prereq = PREREQS[tag];
        if (prereq && el._hass) {
          var hassReady = !!el._hass;
          var present = true;
          if (prereq.service) present = !!(el._hass.services && el._hass.services[prereq.service]);
          if (prereq.shellCommand) present = !!(el._hass.services && el._hass.services.shell_command && el._hass.services.shell_command[prereq.shellCommand]);
          var existing = el.shadowRoot.querySelector('.prereq-banner[data-prereq="' + tag + '"]');
          if (!present && hassReady) {
            if (!existing) {
              var top = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
              try { top.insertAdjacentHTML('afterbegin', buildPrereqBanner(tag, prereq, el._hass)); } catch(e) {}
            }
          } else if (present && existing) {
            existing.remove();
          }
        }
        // 2) Donate footer
        if (el.shadowRoot.querySelector('.donate-section')) return;
        var target = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
        try { target.insertAdjacentHTML('beforeend', DONATE_HTML); } catch(e) {}
      });
    });
  }
  // Run immediately, then aggressive MutationObserver for late mounts + view switches.
  injectAll();
  setTimeout(injectAll, 250);
  setTimeout(injectAll, 1000);
  setTimeout(injectAll, 3000);
  // MutationObserver catches every new node anywhere in the DOM, including shadow root attachments
  // that are deferred until the user navigates to a view.
  try {
    var obs = new MutationObserver(function(muts){
      // Debounce: schedule a microtask injection
      if (window.__haToolsDonateScheduled) return;
      window.__haToolsDonateScheduled = true;
      setTimeout(function(){ window.__haToolsDonateScheduled = false; injectAll(); }, 100);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}
  // Also re-inject on hash/path change (Lovelace view switches)
  window.addEventListener('hashchange', function(){ setTimeout(injectAll, 200); });
  window.addEventListener('popstate', function(){ setTimeout(injectAll, 200); });
  // Backup interval (every 3s for first 5min — handles cases where MutationObserver missed events)
  var pollCount = 0;
  var pollInterval = setInterval(function(){
    injectAll();
    if (++pollCount >= 100) clearInterval(pollInterval);
  }, 3000);
}
/* ============================================================ */

class HADataExporter extends HTMLElement {
  constructor() {
    super();
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this.attachShadow({ mode: 'open' });
    // --- Throttle fields ---
    this._lastRenderTime = 0;
    this._renderScheduled = false;
    this._firstHassRender = false;
    // --- Pagination ---
    this._currentPage = 0;
    this._tabPages = {};
    this._pageSize = 15;
    this._hass = null;
    this._config = {};
    this._selectedEntities = new Set();
    this._filterDomain = 'all';
    this._filterSearch = '';
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
  }

  // --- Snapshot persistence ---
  _snapshotKey() { return 'ha-data-exporter-snapshots-' + (this._config.storage_key || 'default'); }

  _sanitize(str) {
    if (!str) return str;
    try { return decodeURIComponent(escape(str)); } catch(e) { return str; }
  }

  _settingsKey() { return 'ha-data-exporter-settings-' + (this._config.storage_key || 'default'); }

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
        attrs: Object.keys(s.attributes).filter(k => k !== 'friendly_name' && k !== 'icon').length
      };
    });
    this._snapshots.push(snap);
    this._saveSnapshots();
  }

  _startAutoSnapshot() {
    this._stopAutoSnapshot();
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

  disconnectedCallback() {
    this._stopAutoSnapshot();
  }

  set hass(hass) {

    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';    this._hass = hass;
    if (!hass) return;
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this._render();
      this._updateEntities();
      this._lastRenderTime = now;
      return;
    }
    if (now - (this._lastRenderTime || 0) < 10000) {
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        setTimeout(() => {
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


  get _t() {
    const T = {
      pl: {
        title: 'Eksporter Danych',
        loading: 'Wczytywanie...',
        noData: 'Brak danych',
        error: 'B\u0142\u0105d',
        refresh: 'Od\u015bwie\u017c',
        save: 'Zapisz',
        cancel: 'Anuluj',
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
        snapshots: 'zapisy\u00f3w',
        clickToLoad: 'Kliknij aby za\u0142adowa\u0107...',
        loadingHistory: '\u0141adowanie historii...',
        loadHistoryError: 'Nie uda\u0142o si\u0119 pobra\u0107 historii:',
        noStateChanges: 'Brak historii zmian w ostatnich 24h',
        now: 'teraz',
        locale: (this._lang === 'pl' ? 'pl-PL' : 'en-US'),
      },
      en: {
        title: 'Data Exporter',
        loading: 'Loading...',
        noData: 'No data',
        error: 'Error',
        refresh: 'Refresh',
        save: 'Save',
        cancel: 'Cancel',
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
    this._config = {
      title: config.title || 'Data Exporter',
      default_format: config.default_format || 'csv',
      show_attributes: config.show_attributes !== false,
      show_select_all: config.show_select_all !== false,
      page_size: config.page_size || 50,
      domains: config.domains || null,
      ...config
    };
  }

  getCardSize() {
    return 6;
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

  _getFilteredEntities() {
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

    if (this._filterDomain !== 'all') {
      entities = entities.filter(e => e.domain === this._filterDomain);
    }

    if (this._filterSearch) {
      const search = this._filterSearch.toLowerCase();
      entities = entities.filter(e =>
        e.entity_id.toLowerCase().includes(search) ||
        e.name.toLowerCase().includes(search) ||
        e.state.toLowerCase().includes(search)
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
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return this._sortAsc ? cmp : -cmp;
    });

    return entities;
  }

  _getDomains() {
    if (!this._hass) return [];
    const domains = new Set();
    Object.keys(this._hass.states).forEach(id => domains.add(id.split('.')[0]));
    return [...domains].sort();
  }

  _render() {
    if (!this._hass) return;
    const L = this._lang === 'pl';
    const format = this._config.default_format;
    this.shadowRoot.innerHTML = `
      <style>${window.HAToolsBentoCSS || ""}
/* === Support / Donation Section (HA Tools split) === */
.donate-section { margin: 20px 0 4px; padding: 18px 20px;  background: var(--donate-bg, linear-gradient(135deg, #fff5f5 0%, #fff0f6 50%, #f8f0ff 100%));  border: 1px solid var(--donate-border, #f3d3e0); border-radius: var(--bento-radius-md, 16px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.donate-section h3 { margin: 0 0 6px; font-size: 15px; color: var(--donate-heading, #be185d); }
.donate-section p  { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--donate-text, #6b21a8); }
.donate-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.donate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;  font-weight: 600; font-size: 12.5px; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
.donate-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.donate-btn.coffee { background: #FFDD00; color: #000; border: 1px solid #e6c700; }
.donate-btn.paypal { background: #0070ba; color: #fff; border: 1px solid #005ea6; }
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, #2a1525 0%, #1e1530 50%, #251530 100%); border-color: #4a3555; }  .donate-section h3 { color: #f0c0d8; }  .donate-section p  { color: #d4a0b8; }  .donate-btn.coffee { background: #b8a100; color: #fff; border-color: #8a7a00; }  .donate-btn.paypal { background: #005a96; color: #e0f0ff; border-color: #004a7a; } }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 16px; }  .donate-buttons { justify-content: center; } }
/* === Prereq banner (HA Tools split injector) === */
.prereq-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px;  border-radius: var(--bento-radius-sm, 10px); margin: 10px 0 14px; font-size: 13px; line-height: 1.5;  border: 1px solid; }
.prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: #991b1b; }
.prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.06); border-color: rgba(59, 130, 246, 0.3); color: #1e40af; }
.prereq-banner .prereq-icon { font-size: 22px; flex-shrink: 0; line-height: 1; padding-top: 2px; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
.prereq-banner .prereq-cta { display: inline-block; padding: 6px 12px; border-radius: 6px;  background: var(--bento-primary, #3B82F6); color: #fff !important; text-decoration: none;  font-weight: 600; font-size: 12px; flex-shrink: 0; }
.prereq-banner .prereq-cta:hover { background: var(--bento-primary-hover, #2563EB); }
@media (prefers-color-scheme: dark) {  .prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.4); }  .prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.12); color: #93c5fd; border-color: rgba(59, 130, 246, 0.4); }  .prereq-banner code { background: rgba(255,255,255,0.08); } }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; }  .prereq-banner .prereq-cta { align-self: flex-start; } }


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
          --primary-color: var(--bento-primary);
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
      

@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
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
      
        <div class="card">
          <div class="card-header">
            <h2>${_esc(this._config.title)}</h2>
            <div style="display:flex;align-items:center;gap:8px"><span class="stats" id="stats"></span><button id="deGoSettingsBtn" style="background:none;border:1px solid var(--bento-border,#e2e8f0);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--bento-text-secondary,#64748b);cursor:pointer;display:inline-flex;align-items:center;gap:4px">${this._lang === 'pl' ? '\u2699\uFE0F Ustawienia' : '\u2699\uFE0F Settings'}</button></div>
          </div>
          
          <div class="toolbar">
            <select id="domainFilter">
              <option value="all">All domains</option>
            </select>
            <input type="text" id="searchFilter" placeholder="Search entities..." />
            <span class="toolbar-spacer"></span>
            <span class="entity-count" id="entityCount"></span>
            <select class="format-select" id="formatSelect">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
            <button class="btn btn-primary btn-sm" id="exportBtn" disabled>Export Selected (0)</button>
            <button class="btn btn-secondary btn-sm" id="exportAllBtn">Export All</button><label class="attrs-toggle-label"><input type="checkbox" id="includeAttrs" checked class="attrs-toggle-input" /> ${this._t.attributes}</label>
          </div>
          <div class="snapshot-bar" style="display:flex;align-items:center;gap:8px 12px;padding:8px 16px;background:var(--bento-bg,#f8fafc);border:1px solid var(--bento-border,#e2e8f0);border-radius:8px;margin:8px 0;font-size:12px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
              <input type="checkbox" id="snapshotEnabled" ${this._snapshotSettings.enabled ? 'checked' : ''} />
              Snapshots
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
                  <th class="checkbox-cell"><input type="checkbox" id="selectAll" title="Select all" /></th>
                  <th class="expand-cell"></th>
                  <th data-sort="entity_id">Entity ID <span class="sort-arrow"></span></th>
                  <th data-sort="name">Name <span class="sort-arrow"></span></th>
                  <th data-sort="state">State <span class="sort-arrow"></span></th>
                  <th data-sort="domain">Domain <span class="sort-arrow"></span></th>
                  <th data-sort="attrCount">Attrs <span class="sort-arrow"></span></th>
                </tr>
              </thead>
              <tbody id="entityBody"></tbody>
            </table>
          </div>
          <div class="pagination" id="pagination"></div>
        
        <!-- Support / Donation -->
        <div class="donate-section" data-source="ha-tools-split">
          <div class="donate-text">
            <h3>❤️ ${this._lang === 'pl' ? 'Wesprzyj rozwój HA Tools' : 'Support HA Tools Development'}</h3>
            <p>${this._lang === 'pl' ? 'Jeśli to narzędzie ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!' : 'If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!'}</p>
          </div>
          <div class="donate-buttons">
            <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
            <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>
          </div>
        </div>
        </div>
      
    `
    this._attachEvents();
  }

  _attachEvents() {
    const domainFilter = this.shadowRoot.getElementById('domainFilter');
    const searchFilter = this.shadowRoot.getElementById('searchFilter');
    const selectAll = this.shadowRoot.getElementById('selectAll');
    const exportBtn = this.shadowRoot.getElementById('exportBtn');
    const exportAllBtn = this.shadowRoot.getElementById('exportAllBtn');

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
        this.dispatchEvent(new CustomEvent('navigate-settings', { bubbles: true, composed: true, detail: { section: 'data-exporter' } }));
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
      th.addEventListener('click', () => {
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
    });

    exportBtn.addEventListener('click', () => this._export('selected'));
    exportAllBtn.addEventListener('click', () => this._export('all'));
  }

  _currentPage = 0;

  _updateEntities() {
    const domainFilter = this.shadowRoot.getElementById('domainFilter');
    if (!domainFilter) return;
    const entities = this._getFilteredEntities();
    const tbody = this.shadowRoot.getElementById('entityBody');
    const stats = this.shadowRoot.getElementById('stats');
    const exportBtn = this.shadowRoot.getElementById('exportBtn');
    const pagination = this.shadowRoot.getElementById('pagination');

    // Update domain filter
    const domains = this._getDomains();
    const currentDomain = domainFilter.value;
    domainFilter.innerHTML = '<option value="all">All domains (' + Object.keys(this._hass.states).length + ')</option>';
    domains.forEach(d => {
      const count = Object.keys(this._hass.states).filter(id => id.startsWith(d + '.')).length;
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = _esc(d) + ' (' + count + ')';
      if (d === currentDomain) opt.selected = true;
      domainFilter.appendChild(opt);
    });

    // Update sort arrows
    this.shadowRoot.querySelectorAll('th[data-sort]').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
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

    // Render table
    tbody.innerHTML = '';
    if (pageEntities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No entities found</td></tr>';
    } else {
      pageEntities.forEach(ent => {
        const tr = document.createElement('tr');
        const checked = this._selectedEntities.has(ent.entity_id) ? 'checked' : '';
        const attrs = ent.attributes || {};
        const attrKeys = Object.keys(attrs).filter(k => k !== 'friendly_name');
        const attrCount = attrKeys.length;
        tr.innerHTML = `
          <td class="checkbox-cell"><input type="checkbox" data-entity="${_esc(ent.entity_id)}" ${checked} /></td>
          <td class="expand-cell"><button class="expand-btn" data-expand="${_esc(ent.entity_id)}" title="Show attributes" aria-label="Show attributes">▶</button></td>
          <td class="entity-id" title="${_esc(ent.entity_id)}">${_esc(ent.entity_id)}</td>
          <td title="${_esc(ent.name)}">${_esc(ent.name)}</td>
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

        // Create expandable attribute row (hidden by default)
        const attrRow = document.createElement('tr');
        attrRow.className = 'attr-row';
        attrRow.style.display = 'none';
        attrRow.dataset.attrFor = ent.entity_id;
        const attrTd = document.createElement('td');
        attrTd.colSpan = 7;
        let attrHtml = '<div class="attr-container">';
        // Attributes section
        attrHtml += '<div class="attr-grid">';
        if (attrKeys.length === 0) {
          attrHtml += '<div class="attr-item"><span class="attr-val" style="color:var(--bento-text-muted)">No attributes</span></div>';
        } else {
          attrKeys.sort().forEach(k => {
            const v = attrs[k];
            const isComplex = typeof v === 'object' && v !== null;
            const displayVal = isComplex ? JSON.stringify(v) : String(v);
            const valClass = isComplex ? 'attr-val complex' : 'attr-val';
            attrHtml += `<div class="attr-item"><span class="attr-key">${_esc(k)}</span><span class="${valClass}" title="${_esc(displayVal).replace(/"/g, '&quot;')}">${_esc(displayVal)}</span></div>`;
          });
        }
        attrHtml += '</div>';
        // History from HA API
        attrHtml += `<div class="history-section"><div class="history-title">\u{1F4C8} ${this._t.stateHistory}</div><div class="history-list" id="history-${ent.entity_id.replace(/\./g, '_')}"><span class="history-loading">${this._t.clickToLoad}</span></div></div>`;
        // Snapshot history (persisted)
        const snapHistory = this._getEntityHistory(ent.entity_id);
        if (snapHistory.length > 0) {
          const last10 = snapHistory.slice(-10).reverse();
          attrHtml += '<div class="history-section"><div class="history-title">\u{1F4BE} ' + this._t.snapshotsTitle + ' (' + snapHistory.length + ' ' + this._t.snapshots + ')</div><div class="history-list">';
          last10.forEach(h => {
            const t = new Date(h.ts).toLocaleString();
            attrHtml += '<div class="history-item"><span class="history-time">' + t + '</span><span class="history-state">' + _esc(h.state) + '</span><span style="font-size:11px;color:var(--bento-text-secondary,#64748b);">' + h.attrs + ' attrs</span></div>';
          });
          attrHtml += '</div></div>';
        }
        attrHtml += '</div>';
        attrTd.innerHTML = attrHtml;
        attrRow.appendChild(attrTd);
        tbody.appendChild(attrRow);

        // Restore expanded state
        if (!this._expandedEntities) this._expandedEntities = new Set();
        if (this._expandedEntities.has(ent.entity_id)) {
          attrRow.style.display = '';
          tr.querySelector('.expand-btn').classList.add('expanded');
          this._fetchHistory(ent.entity_id);
        }

        // Expand/collapse handler
        tr.querySelector('.expand-btn').addEventListener('click', (e) => {
          const btn = e.target;
          const entityId = btn.dataset.expand;
          const row = tbody.querySelector(`tr[data-attr-for="${entityId}"]`);
          if (row.style.display === 'none') {
            row.style.display = '';
            btn.classList.add('expanded');
            this._expandedEntities.add(entityId);
            this._fetchHistory(entityId);
          } else {
            row.style.display = 'none';
            btn.classList.remove('expanded');
            this._expandedEntities.delete(entityId);
          }
        });
      });
    }

    // Pagination controls
    pagination.innerHTML = `
      <button id="prevPage" ${this._currentPage === 0 ? 'disabled' : ''}>\u25C0 Prev</button>
      <span>Page ${this._currentPage + 1} of ${totalPages} (${entities.length})</span>
      <button id="nextPage" ${this._currentPage >= totalPages - 1 ? 'disabled' : ''}>Next \u25B6</button>
      <div class="page-size-wrap">
        <label>Show:</label>
        <select id="pageSizeSelect">
          ${[15, 25, 50, 100].map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}</option>`).join('')}
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

    this._updateStats();
    stats.textContent = `${entities.length} entities`;
  }

  _updateStats() {
    const exportBtn = this.shadowRoot.getElementById('exportBtn');
    if (!exportBtn) return;
    const count = this._selectedEntities.size;
    exportBtn.textContent = `Export Selected (${count})`;
    exportBtn.disabled = count === 0;
  }

  _export(mode) {
    const format = this.shadowRoot.getElementById('formatSelect').value;
    const entities = this._getFilteredEntities();
    let data;

    if (mode === 'selected') {
      data = entities.filter(e => this._selectedEntities.has(e.entity_id));
    } else {
      data = entities;
    }

    // Privacy: warn before exporting full state/attributes (entity names, locations,
    // sensor values, optional attributes can contain sensitive data).
    const PL = (this._lang === 'pl') || (this._hass?.language || '').startsWith('pl');
    const includeAttrs = !!this._includeAttrsInExport;
    const warn = PL
      ? `Eksportowany plik (${format.toUpperCase()}) będzie zawierał ${data.length} encji wraz ze stanami${includeAttrs ? ' i atrybutami (mogą zawierać wrażliwe dane)' : ''}.\n\nNie wysyłaj go publicznie ani do zewnętrznych usług bez świadomej zgody.\n\nKontynuować?`
      : `The export (${format.toUpperCase()}) will contain ${data.length} entities with states${includeAttrs ? ' and attributes (may contain sensitive data)' : ''}.\n\nDo not share publicly or with third-party services without informed consent.\n\nContinue?`;
    if (!confirm(warn)) return;

    const exportData = data.map(e => {
      const row = {
        entity_id: e.entity_id,
        friendly_name: e.name,
        state: e.state,
        domain: e.domain,
        last_changed: e.last_changed
      };
      if (this._includeAttrsInExport) {
        const attrs = { ...e.attributes };
        delete attrs.friendly_name;
        row.attributes = attrs;
      }
      return row;
    });

    let content, mime, ext;

    if (format === 'csv') {
      content = this._toCSV(exportData);
      mime = 'text/csv';
      ext = 'csv';
    } else if (format === 'json') {
      content = JSON.stringify(exportData, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else if (format === 'yaml') {
      content = this._toYAML(exportData);
      mime = 'text/yaml';
      ext = 'yaml';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ha-export-${new Date().toISOString().slice(0,10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _toCSV(data) {
    if (data.length === 0) return '';
    const baseHeaders = ['entity_id', 'friendly_name', 'state', 'domain', 'last_changed'];
    const attrKeys = new Set();
    if (this._includeAttrsInExport) {
      data.forEach(row => {
        if (row.attributes) {
          Object.keys(row.attributes).forEach(k => attrKeys.add(k));
        }
      });
    }
    const headers = [...baseHeaders, ...[...attrKeys].sort()];
    const escape = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? '"' + str.replace(/"/g, '""') + '"'
        : str;
    };
    const rows = [headers.map(escape).join(',')];
    data.forEach(row => {
      const values = headers.map(h => {
        if (baseHeaders.includes(h)) return escape(row[h]);
        return escape(row.attributes ? row.attributes[h] : '');
      });
      rows.push(values.join(','));
    });
    return rows.join('\n');
  }

  _toYAML(data) {
    let yaml = '';
    data.forEach(item => {
      yaml += `- entity_id: "${item.entity_id}"\n`;
      yaml += `  friendly_name: "${item.friendly_name}"\n`;
      yaml += `  state: "${item.state}"\n`;
      yaml += `  domain: "${item.domain}"\n`;
      yaml += `  last_changed: "${item.last_changed}"\n`;
      if (item.attributes && Object.keys(item.attributes).length > 0) {
        yaml += `  attributes:\n`;
        Object.entries(item.attributes).forEach(([k, v]) => {
          yaml += `    ${k}: ${JSON.stringify(v)}\n`;
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
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
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
      const d = new Date(ch.time);
      const timeStr = d.toLocaleString((this._lang === 'pl' ? 'pl-PL' : 'en-US'), { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
      const isCurrent = i === changes.length - 1;
      html += '<div class="history-item' + (isCurrent ? '' : '') + '">';
      html += '<span class="history-time">' + timeStr + '</span>';
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
  '%c  HA-DATA-EXPORTER  %c v1.0.0 ',
  'background: #1976d2; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #e3f2fd; color: #1976d2; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

class HaDataExporterEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    this.shadowRoot.innerHTML = `
      <style>
            :host { display:block; padding:16px; }
            h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
            input { outline:none; transition:border-color .2s; }
            input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
        </style>
      <h3>Data Exporter</h3>
            <div style="margin-bottom:12px;">
              <label style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">Title</label>
              <input type="text" id="cf_title" value="${_esc(this._config?.title) || 'Data Exporter'}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
    `;
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
  }
  connectedCallback() { this._render(); }
}
if (!customElements.get('ha-data-exporter-editor')) { customElements.define('ha-data-exporter-editor', HaDataExporterEditor); }

})();

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-data-exporter',
  name: 'Data Exporter',
  description: 'Export HA entities, states, and attributes to CSV/JSON/YAML',
  preview: true
});
