# 📤 Data Exporter

![Preview](banner.png)

Browse, filter and export Home Assistant entity data — states and attributes
to CSV / JSON / YAML, with optional local snapshots for a lightweight trend
history. Zero configuration: add the card and it lists every entity in your
instance.

[![Version](https://img.shields.io/github/v/release/MacSiem/ha-data-exporter)](https://github.com/MacSiem/ha-data-exporter/releases) [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Part of the [HA Tools](https://github.com/MacSiem) ecosystem — split into individual HACS-installable plugins.

## How it works

**Short version: it works automatically.** The card needs no configuration and
no extra integration:

1. **Entities from HA state.** On load, the card lists every entity from
   `hass.states` — domain filter, live text search, and sortable columns
   (Entity ID / Name / State / Domain / Attribute count).
2. **Attribute drill-down + 24h history.** Expanding a row shows its full
   attribute set and, on demand, its last 24h of state changes fetched from
   your own Home Assistant instance (`/api/history/period`).
3. **Export on your terms.** Select rows (or export everything currently
   filtered) as CSV, JSON or YAML, with attributes optionally included. A
   privacy confirmation is shown before every download.
4. **Optional local snapshots.** Turn on periodic snapshots (interval from
   30s to 1h) to build a lightweight, browser-local trend history per entity
   — independent of HA's recorder/history retention.

### What is automatic vs. manual

| Automatic | Manual (optional) |
|---|---|
| Listing every entity, with domain counts | Filtering by domain / search text |
| Sortable table columns | Selecting rows to export vs. "Export All" |
| Live entity count + pagination (15/25/50/100 per page) | Choosing export format: CSV / JSON / YAML |
| Theme follows your Home Assistant theme (light/dark) | Including attributes in the export |
| Confirming before an export leaves your device | Enabling periodic local snapshots + interval/retention |

## Screenshots

| Light | Dark |
|---|---|
| ![Data Exporter, light theme](docs/screenshots/card-main-light.png) | ![Data Exporter, dark theme](docs/screenshots/card-main-dark.png) |

*The entity browser: domain filter, search, sortable table with a mix of
sensors, lights, switches and binary sensors, export controls and the
snapshot bar. Dark mode follows your Home Assistant theme automatically.*

## Installation (HACS)

**Data Exporter is in the HACS default store** (category: **Plugin** / Lovelace dashboard resource) — no custom repository needed:

1. Open **HACS** in Home Assistant
2. Search for **Data Exporter**
3. Install and refresh your browser

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MacSiem&repository=ha-data-exporter&category=plugin)

## Quick start

```yaml
type: custom:ha-data-exporter
```

That's it — no options are required. Optional config:

```yaml
type: custom:ha-data-exporter
title: Data Exporter
default_format: csv        # csv | json | yaml
domains:                    # restrict the browser to specific domains
  - sensor
  - light
  - switch
```

### Optional sidebar panel (`configuration.yaml`)

```yaml
panel_custom:
  - name: ha-data-exporter
    sidebar_title: Data Exporter
    sidebar_icon: mdi:home-assistant
    url_path: ha-data-exporter
    js_url: /local/community/ha-data-exporter/ha-data-exporter.js
    embed_iframe: false
    config: {}
```

After restart, **Data Exporter** appears in the HA sidebar.

> The card's visual editor currently only exposes the **Title** field. Set
> `default_format`, `domains`, `show_attributes`, `show_select_all` or
> `page_size` via YAML as shown above.

## Features

- Browse every entity in your instance with a live domain filter and text search.
- Sortable table — Entity ID, Name, State, Domain, Attribute count.
- Expandable per-entity attribute view, plus on-demand 24h state history from
  Home Assistant's own history API.
- Export selected entities, or everything currently filtered, to **CSV, JSON
  or YAML** — with attributes optionally included.
- Privacy confirmation dialog before every export.
- Optional periodic snapshots (30s–1h interval, 20–200 kept) for a
  browser-local trend history per entity, independent of HA's recorder.
- Bundled Bento Design System (light + dark mode, follows your HA theme, mobile-friendly).
- Self-contained — no shared HA Tools dependency.
- Tool settings, snapshots and dismissed-banner state are cached in browser `localStorage`.

## FAQ

**Do I have to configure anything?**
No. Add the card and it lists every entity in your Home Assistant instance by itself.

**Does this send my data anywhere?**
No third-party or cloud calls. The only network request the card makes is to
your **own** Home Assistant instance's REST API (`/api/history/period`), and
only when you expand an entity row to load its 24h history — exactly like a
native HA history card. Exports are generated and downloaded entirely in your
browser; nothing is uploaded. Because exported files can contain entity names,
locations and sensor values, the card shows a confirmation dialog before every
download and warns you not to share exports publicly or with third-party
services without informed consent.

**Where are snapshots stored?**
In your browser's `localStorage`, per browser and per device. Clearing browser
data removes them. Use CSV/JSON/YAML export for a permanent copy.

**Which export formats are supported?**
CSV, JSON and YAML, selectable per export. You can toggle whether attributes
are included, independent of the format.

**Can I limit the browser to specific domains?**
Yes — set `domains: [sensor, light, ...]` in the card YAML (see Quick start).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Support

If this tool makes your Home Assistant life easier, consider supporting the project:

- [☕ Buy Me a Coffee](https://buymeacoffee.com/macsiem)
- [💳 PayPal](https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W)

## License

MIT — see [LICENSE](LICENSE).
