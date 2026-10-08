## 4.1.13 (2026-10-08)

- Include device and area IDs/names from Home Assistant registries in CSV, JSON and YAML exports; entity area takes precedence over device area (issue #1).
- Cancel exports when registry reads fail or the signed-in account changes during the read.
- Keep spreadsheet formula-like text inert while preserving numeric attribute values; quote YAML keys and values.
- Restore snapshots and settings from the configured `storage_key`; changing namespaces cannot copy the previous card's history into the new key.
- Escape stored snapshot attribute counts before rendering.
- Translate the entity table, filters, export toolbar, pagination, first-run guidance and support controls for Polish and English. Language changes retain focused search and export choices.
- Apply the configured default export format, attribute choice and bulk-selection visibility.
- Update optional support immediately when the administrator role changes and discard history responses from the previous account.
- Show the default title in sidebar mode while retaining custom card titles.

## 4.1.12 (2026-08-28)

- Isolation: Bento CSS is component-local and cannot be captured from `window.HAToolsBentoCSS` by load order.
- Isolation: persistence is now card-local, removing `window._haToolsPersistence` load-order coupling while retaining existing localStorage keys.
- Security: remove the suite-wide DOM/shadow-root injector; intro and support UI now render only inside this card.
- Security: normalize arrays/objects before inherited HTML escaping, including persisted snapshot values.
- Lifecycle: cancel deferred renders on disconnect; add isolation/XSS runtime regression coverage.

## 4.1.11 (2026-07-18)

- Fix: the documented page_size and show_attributes card options are now applied. Both were accepted by setConfig and then ignored (page size was hardcoded, the attributes checkbox always started checked).

## 4.1.10 (2026-07-18)

- Fix (UI): the small accent dot before section titles no longer detaches from the title text (it was pushed to the opposite edge by the header's flex space-between); it is now pinned next to the title.

# Changelog — Data Exporter

## [4.1.7] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.6] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.3] - 2026-05-12

### Fixed
- Removed Google Fonts CDN @import (1 occurrence(s)); now uses system font stack with Inter as the preferred locally-installed face.
- Normalized bare `font-family: "Inter", sans-serif` declarations to a complete cross-platform system stack.
- Privacy section in README: claim now matches behaviour (no CDN dependencies).

All notable changes to **Data Exporter** are documented here.

## [4.0.0] - 2026-05-10

### Major
- **Split from `MacSiem/ha-tools` monorepo** into a dedicated standalone HACS plugin.
- Bundled Bento Design System CSS inline — no shared dependency required.
- Inlined `_haToolsEsc` XSS sanitizer.
- Persistence keys migrated to per-tool namespace `ha-data-exporter-…` (clean break — old data under `ha-tools-…` is **not** migrated automatically).
- Donation/support footer added to the panel.
- Cross-tool discovery banner removed; each tool stands on its own.

### Compatibility

- Home Assistant ≥ 2024.1.0
