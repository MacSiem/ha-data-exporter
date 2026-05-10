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
   HA Tools — Bento Design System v2.0 (Premium)
   ═══════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

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
@media (prefers-color-scheme: dark) {
  :host {
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
  .card, .card-container, .main-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg-2); color: var(--bento-text); border-color: var(--bento-border); }
  table th { background: var(--bento-bg-2); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  pre, code { background: #1e1e2e !important; color: #e2e8f0 !important; }
}

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
  overflow-x: auto !important; overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important; border-bottom: 0 !important;
  width: fit-content; max-width: 100%;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 8px 16px !important;
  border: none !important; background: transparent !important; cursor: pointer !important;
  font-size: 13px !important; font-weight: 600 !important;
  font-family: "Inter", sans-serif !important;
  color: var(--bento-text-secondary) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 0 !important;
  transition: all var(--bento-trans) !important;
  white-space: nowrap !important; flex: none !important;
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
  font-size: 12px; font-weight: 700; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 16px 0 10px;
}
.section-header::before, .section-title::before {
  content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--bento-primary);
  margin-right: 8px; flex-shrink: 0;
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
  font-family: "Inter", sans-serif;
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
  transition: all var(--bento-trans); font-family: "Inter", sans-serif;
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
  cursor: pointer; font-family: "Inter", sans-serif;
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
  font-size: 14px; font-family: "Inter", sans-serif;
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
  // Per-tool first-run intro banner (one-line scope + 3 use cases)
  var INTROS = {
    'ha-yaml-checker': { headline: 'Validate Home Assistant YAML configuration on demand.', steps: ['Click \'Check HA Configuration\' to run homeassistant.check_config.', 'Switch to \'Encje\' tab to search entities by domain.', 'Use \'Template\' tab to preview Jinja2 templates.'] },
    'ha-data-exporter': { headline: 'Browse, filter, and export Home Assistant entity data.', steps: ['Filter by domain or search entities live.', 'Take a snapshot or export selection to CSV / JSON.', 'Privacy warning before downloading attributes with sensitive data.'] },
    'ha-chore-tracker': { headline: 'Household chore tracker with kanban + recurring schedules.', steps: ['Add a chore: name + assignee + frequency.', 'Drag from \'Todo\' to \'Done\' to mark complete.', 'Stats tab shows counts per assignee.'] },
    'ha-energy-optimizer': { headline: 'Tariff-aware energy usage with hourly heatmaps + tips.', steps: ['Today / Yesterday / 7-day / 30-day usage and cost.', 'Patterns tab — hourly heatmap of consumption.', 'Recommendations tab — auto-generated tips.'] },
    'ha-energy-insights': { headline: 'Daily / weekly / monthly energy charts + top consumers.', steps: ['Switch view tabs to see consumption over time.', 'Top devices ranked by kWh.', 'Tips tab with energy-saving suggestions.'] },
    'ha-energy-email': { headline: 'Energy reports delivered by email via ha_tools_email.', steps: ['Click \'Send Now\' to email the current snapshot.', 'Schedule daily / weekly / monthly delivery.', 'Configure SMTP in the Schedule tab (one-time).'] },
    'ha-log-email': { headline: 'Daily error / warning digests delivered by email.', steps: ['Click \'Send Now\' to email the current digest.', 'Schedule daily delivery + threshold (e.g. \u22653 errors).', 'Requires ha-tools-email-integration.'] },
    'ha-smart-reports': { headline: 'Aggregate weekly / monthly reports — energy + automations + state changes.', steps: ['Weekly summary card on Overview.', 'Drill down by Energy / Automations / System sub-tabs.', 'Privacy-safe view strips entity names before sharing.'] },
    'ha-network-map': { headline: 'Visualise the network around HA — devices, topology, MAC bindings.', steps: ['Devices tab — table of all known devices.', 'Topology tab — graph view of the network.', 'Click \'Rescan\' to ping the local subnet (user-initiated).'] },
    'ha-trace-viewer': { headline: 'Step through HA automation traces with a flow graph.', steps: ['Pick automation in sidebar to see latest 5 traces.', 'Click trace for full path through triggers / conditions / actions.', 'Export trace as JSON for offline debug.'] },
    'ha-automation-analyzer': { headline: 'Surface slow / failing / suspicious automations.', steps: ['Overview shows total + health score + top failing.', 'Performance tab ranks by avg runtime.', 'Optimization tab suggests improvements (loops, redundant triggers).'] },
    'ha-storage-monitor': { headline: 'Disk + recorder DB + add-on storage breakdown.', steps: ['Overview shows used / free + per-category breakdown.', 'Backups tab — count + size warning.', 'Cleanup tab — actionable suggestions.'] },
    'ha-backup-manager': { headline: 'Create + list + inspect HA backups.', steps: ['List existing backups (date / size / encryption).', 'Click \'Create backup now\' to invoke backup.create.', 'Restore selected backup.'] },
    'ha-security-check': { headline: 'Security audit + remediation tips.', steps: ['Overview shows score (X/100) + letter grade.', 'Click warning row for step-by-step remediation.', 'Tips tab — checklist of best practices.'] },
    'ha-device-health': { headline: 'Device battery / signal / last-seen health.', steps: ['List devices grouped by health (OK / Warning / Critical).', 'Filter by low battery (<20%) or weak signal.', 'Click device for model / manufacturer / last seen.'] },
    'ha-encoding-fixer': { headline: 'Detect + fix UTF-8 / mojibake issues across HA.', steps: ['Click \'Scan\' to walk entity registry + states.', 'Per-entity \'Fix\' button calls homeassistant.reload.', 'Optional: deep file scan via shell_command (see README).'] },
    'ha-entity-renamer': { headline: 'Bulk-rename HA entities + friendly names.', steps: ['Pick an entity, set new ID — entity_registry/update.', 'Bulk pattern: sensor.old_* \u2192 sensor.new_*.', 'Optional: rewrite Lovelace dashboard refs.'] },
    'ha-frigate-privacy': { headline: 'One-click Frigate privacy mode (pause detection / recording / snapshots).', steps: ['Click \'Pause 15 min\' for instant privacy.', 'Schedules tab — daily privacy window (e.g. 22:00\u201306:00).', 'Resume at any time to re-enable cameras.'] }
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
  function buildIntroBanner(tag, intro) {
    var stepsHtml = intro.steps.map(function(s){ return '<li>' + s + '</li>'; }).join('');
    return '<div class="intro-banner" data-intro="' + tag + '">' +
      '<button class="intro-dismiss" type="button" title="Dismiss" aria-label="Dismiss">✕</button>' +
      '<div class="intro-headline">💡 ' + intro.headline + '</div>' +
      '<ol class="intro-steps">' + stepsHtml + '</ol>' +
    '</div>';
  }
  function introDismissed(tag) {
    try { return localStorage.getItem('ha-intro-dismissed-' + tag) === '1'; } catch(e) { return false; }
  }
  function dismissIntro(tag, el) {
    try { localStorage.setItem('ha-intro-dismissed-' + tag, '1'); } catch(e) {}
    var node = el.shadowRoot && el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"]');
    if (node) node.remove();
  }
  function injectAll() {
    SPLIT_TAGS.forEach(function(tag){
      deepFindAll(tag).forEach(function(el){
        // panel_custom auto-init: HA assigns hass/panel/narrow but does not always call setConfig.
        if (typeof el.setConfig === 'function' && !el.config && !el._config) {
          try { el.setConfig({ type: 'custom:' + tag, title: tag }); } catch(e) {}
        }
        if (!el.shadowRoot) return;
        // 0) First-run intro banner (skip if tool has its own native tip)
        var intro = INTROS[tag];
        if (intro && !introDismissed(tag)) {
          var hasOwnTip = el.shadowRoot.querySelector('#tip-banner, .tip-banner');
          var injectedIntro = el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"]');
          if (!hasOwnTip && !injectedIntro) {
            var topCard = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild;
            if (topCard) {
              try {
                topCard.insertAdjacentHTML('afterbegin', buildIntroBanner(tag, intro));
                var btn = el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"] .intro-dismiss');
                if (btn) btn.addEventListener('click', function(ev){ ev.stopPropagation(); dismissIntro(tag, el); });
              } catch(e) {}
            }
          }
        }
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
/* === HA Tools split — premium banners (donate / intro / prereq) === */

/* Donation footer — diamond top */
.donate-section {  margin: 24px 0 4px; padding: 20px 24px; position: relative; overflow: hidden;  background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.18); border-radius: var(--bento-radius-md, 18px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;  font-family: 'Inter', -apple-system, sans-serif;}
.donate-section::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
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
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, rgba(129,140,248,0.10), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.25); }  .donate-section h3 { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }  .donate-section p { color: #d6d3d1; } }
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
@media (prefers-color-scheme: dark) {  .prereq-banner.prereq-error { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.30); color: #fca5a5; }  .prereq-banner.prereq-info  { background: rgba(129,140,248,0.10); border-color: rgba(129,140,248,0.30); color: #c7d2fe; }  .prereq-banner code { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); } }
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
@media (prefers-color-scheme: dark) {  .intro-banner { background: linear-gradient(135deg, rgba(129,140,248,0.14), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.30); }  .intro-banner .intro-headline { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }  .intro-banner .intro-steps li { color: #fafaf9; }  .intro-banner .intro-steps li::before { background: #16161f; border-color: rgba(129,140,248,0.35); color: #a5b4fc; }  .intro-banner .intro-dismiss { background: #16161f; border-color: #27272f; color: #d6d3d1; }  .intro-banner .intro-dismiss:hover { background: #27272f; color: #fafaf9; } }


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
