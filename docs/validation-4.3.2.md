# 4.3.2 validation — 2026-11-02

Runtime SHA-256: `fa8b799a83eb71a785db47f5f20b8f5f5a044416f022c7fb6361ca992c161287`.
Baseline: public 4.3.1, commit `4f5fc0bc9d8a9bba5d107eb4ca3c833731bba920`.

## Problem and behavior

Issue #6 was reported again on 4.3.1 on November 2. Live updates to a reviewed
sensor invalidated the ready Blob, clearing the preview and disabling Save.
This was reproduced on real Home Assistant, both with production data and in
an isolated HA 2026.10.2 installation using the public HACS package.

The review now owns immutable bytes. Changes to live values or timestamps only
add a freshness notice; Save writes those same bytes. Refresh creates a new
review. The source description includes the review creation timestamp.
Entity membership, access, connection, explicit export choices and source
availability still fence the review. One review permits one download handoff.

## Current evidence

- Regression tests: four expected failures before implementation; all 128 Node
  tests pass after implementation. Coverage includes three formats, exact bytes,
  repeated updates, live sort reorder, changes during a pending build, source
  removal, role/connection revocation, privacy, late I/O and double-clicks.
- Real HA/Chromium: 65 synthetic sensors, across multiple pages; current-public
  failure reproduced after a sensor update. Candidate Save remains enabled,
  preview is unchanged and the freshness notice appears. Actual CSV/JSON/YAML
  files match their respective UTF-8 previews.
- 390 px real HA: Select all selects all 65 filtered sensors; Clear selection
  clears them. Review remains scrollable and Save stays visible in its footer.
- Household account: preview and Save available for its HA-provided states;
  administrator dashboard-placement action absent.
- Native macOS WKWebView/WKDownload: actual Blob downloads for CSV (2090 bytes),
  JSON (1752 bytes), YAML (1452 bytes); filenames and UTF-8 bytes exactly match
  the reviewed content. All remain savable after a sensor update. No navigation
  errors. Reproducible harness: `tests/webkit/README.md`.
- Production validation: authorized backup, configuration validation and one
  restart to activate a versioned panel URL. New runtime hash verified through
  the browser debugger without cache overrides; the previous entity count
  recovered after startup. No household state changes or private downloads.

The native WebKit test uses synthetic HA and programmatic clicks. It is not an
iOS Home Assistant wrapper test. Phone tests were explicitly excluded by the
owner. The reported iOS `NSURLErrorDomain -999` cancellation was not reproduced
and its cause remains unconfirmed. The earlier claim of an iOS fix is corrected
in README and CHANGELOG; issue #6 must stay open.

## Reused evidence and scope

The 4.3.0/4.3.1 qualifications remain applicable to unchanged source: reviewed
field allowlists, serializers, missing/null/zero, device/area registry lookup,
snapshot retention/namespace/migration, options/editor, dashboard placement,
minimum HA version and native theme/layout tokens. This release changes neither
those mechanisms nor the HACS entrypoint and package format. Its new context
split and freshness message have current tests above, not inherited passes.
The complete source test suite also covers the inherited paths.

Public HACS 4.3.1 was freshly installed through its real UI and its downloaded
asset hash verified before applying the exact candidate to that installation.
Native HACS upgrade/fresh tests of the published 4.3.2 package and released CI
are post-publication checks, not claimed here before a release exists.

## Issue response draft (not sent)

Thanks for testing 4.3.1 and reporting that it still fails. I reproduced the
inactive Save button: updates to an exported sensor were clearing the preview.
In 4.3.2, the preview keeps the exact content you reviewed and remains savable;
a notice offers Refresh preview when newer values are available. Changes to
access or the export scope still require a new review.

I verified actual CSV, JSON and YAML downloads in Home Assistant in Chromium
and in native macOS WebKit. I have not reproduced the iOS -999 cancellation,
so I cannot yet claim that part is fixed. My earlier explanation about the
Blob URL timeout was not confirmed. This issue remains open.
