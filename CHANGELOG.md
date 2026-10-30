## 4.3.1 (2026-10-30)

Fixes from issue #6 (Home Assistant iOS app, narrow dashboards):

- Add **Select all within filters (N)** and **Clear selection (N)** above the
  table in every layout. The narrow layout hides the table header, so 4.3.0 had
  no select-all there. `show_select_all: false` hides the select-all button.
- Keep the page still during periodic Home Assistant updates. Visible rows are
  updated in place; domain, area and device pickers, filter chips and
  pagination change only when their content changes. Expanded rows keep their
  loaded history.
- Fix Save in the Home Assistant iOS/macOS app, which failed with
  NSURLErrorDomain -999. The download link stays valid while the app asks
  where to save the file, and Save never leaves the app for a browser.
- Count export columns for the export scope: the selected entities, or all
  within filters. Column choices list only reviewed attributes, instead of
  every attribute of every entity.
- Word the scope note as "Selected: N; outside filters: N; matching filters: N".

## 4.3.0 (2026-10-29)

- Fix issue #6: unrelated Home Assistant updates no longer erase a reviewed
  filtered export. Relevant data and access changes still require a fresh review,
  with actionable Polish and English guidance.
- Add initial/available tab options, collapsed user-specific help and visual
  editor controls. Preserve unknown configuration fields and existing full cards.
- Use mobile sorting instead of a wrapped table header, left-aligned headings,
  readable theme colors, minimum text sizes and accessible entity identifiers.
- Add native dashboard placement with preview, width selection, confirmed save,
  conflict-aware Undo and copy-only configuration for YAML dashboards.
- Avoid duplicate card-picker entries and periodic snapshots in card previews.
- Enable dashboard placement immediately when an empty card is attached. The
  review dialog follows HA primary colors and theme changes without discarding
  reviewed content.

- Separate Export and Records/comparison tabs, retaining selections, snapshots,
  timers and comparison choices when switching.
- Follow entity selection with collapsed columns/format and one bottom Preview
  and save action. Selected entities outside filters remain included; all within
  filters includes every page. The reviewed export policy and file schemas are
  unchanged; private fields start off each time.
- Load area/device registries on the first explicit + Filter action, with one
  shared request, clear unavailable state and manual retry. Active filter chips
  clear one filter and return keyboard focus to its control.
- Display friendly timestamps with seconds and offsets using system/browser time
  by default, respecting Home Assistant profile overrides and daylight-saving
  changes. Raw timestamps and exports remain unchanged. Numeric history times
  retain their meaning when preferences change.
- Refresh rows immediately when user/connection and time preferences change
  together. Natural name sorting follows the full Home Assistant locale.

## 4.2.0 (2026-10-15)

- Show changed snapshot states directly below the chosen pair, with both source timestamps, explicit missing entities, and pages of 20 changes.
- Keep the full checkbox and expand controls visible in narrow records, including at 200% browser zoom.
- Preserve the historical privacy decision for snapshot exports even after an entity is renamed or removed. Older unclassified numeric cells are omitted without rewriting local history.
- Refresh rows, filters and pagination immediately after visual-editor changes.
- Resume enabled automatic snapshots after returning to a detached card or same-user role changes, and synchronize settings controls when switching users.

- Keep entity ID, name and current state together in narrow card containers; retain the sortable table in wider layouts.
- Add keyboard sort buttons, `aria-sort`, named entity checkboxes and stable focus/selection during state updates.
- Filter by device and area, choose export fields and their order, and preview the exact chosen scope. Entity area takes precedence over device area.
- Compare two local snapshots by state and timestamp; export changed rows without treating browser snapshots as Recorder history.
- Expand the visual editor with domains, default format, page size, attributes and storage namespace, while preserving other YAML options.
- Review JSON, CSV or YAML, edit the filename, and explicitly save the frozen preview. Names and reviewed entity/device/area identifiers require consent for each export.
- Always exclude credentials, users, addresses, raw configuration and arbitrary text states/attributes. Missing registry metadata remains explicit; numeric zero and unavailable states retain their meanings.
- Use a native modal with keyboard focus, truthful download status and protection against repeated saves or stale source/access context.

## 4.1.13 (2026-10-08)

- Export selected entities across search/domain filters while respecting configured domains and current availability.
- Show configuration guidance when Settings is used in a standalone card.
- Include device and area IDs/names from Home Assistant registries in CSV, JSON and YAML exports; entity area takes precedence over device area (issue #1).
- Cancel exports when registry reads fail or the signed-in account changes during the read.
- Keep spreadsheet formula-like text inert while preserving numeric attribute values; quote YAML keys and values.
- Preserve CSV attribute values whose names collide with base columns or other attribute headers, using unique headers.
- Restore snapshots and settings from the configured `storage_key`; changing namespaces cannot copy the previous card's history into the new key.
- Escape stored snapshot attribute counts before rendering.
- Update the visible saved-snapshot count when automatic snapshots are taken.
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
