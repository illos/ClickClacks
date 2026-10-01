# Extraction work log

Source: Salient `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b` (approved V272 visuals), with V273 release decisions. The user authorized independent implementation, subagent review/testing and GitHub Pages publication in this thread. A separately assigned helper owns deployment to the dedicated Powerroller Convex dev deployment.

## Implementation

- P1: independent repository, MIT authorization/notices, public TypeScript exports, React UI, scoped CSS, standalone site and approved palette/fonts. No Salient schema, catalog, endpoints, reference corpus or Cloudflare requirement.
- P2: secure Node sampling in the app wrapper, transactional component acceptance, separate receipt/tombstone lifecycle, generated/supplied attribution, room credentials, cursor catch-up and shared reveal. Semantic delivery never depends on graphics. Snapshot recovery and room-switch races were repaired during review.
- P3: logical pools/mixed groups, modifiers, keep/drop, percentiles and cited Draw Steel presets; d3/d4/d6/d10/d100 animated models and custom model providers. Trusted custom result interpretation uses `acceptResolved` with validated dice envelopes.
- P4: HTML results/details, local motion/text/contrast preferences, serial announcements, focus-preserving native dialogs and announcement delivery inside active modals. Header CSS scope and short-view clipping were fixed from browser evidence.
- P5: versioned preferences/session credentials, bounded backend/table-partitioned IndexedDB history, memory fallback, reload reconciliation, independent default names and Pages workflow. Clean/default appearance metadata was fixed after browser validation exposed the strict backend rejection.
- P6: GitHub repository, README adaptation/setup guide, non-React consumer, shared CLI/API routes and dedicated Convex backend. Pages publication is the remaining publication step.

## Recorded validation

- Pure rules/core: 19 source-derived tests passed.
- Component/backend: 9 focused tests passed, including persisted readback, wrong credential/room rejection, own clear, receipt expiry/conflicts, rapid rolls, retained current dice, policy limits and trusted custom results.
- Controller: 12 tests passed for timers, retry/cursor delivery, reconnect/snapshot recovery and stale responses.
- Site storage: 8 tests passed, including backend/table isolation, blocked storage and strict appearance sanitization.
- Models: 6 focused tests passed for face/value correspondence and percentile/d3/d4 representations.
- Public imports: 1 test passed with no browser/React initialization. An independent consumer built public core/controller/tray exports while rejecting React/CSS imports: 77 modules, build passed.
- Clean independent Git archive: offline frozen install and frontend build passed without Salient, generated Convex bindings or reference corpora.
- Live CLI/API: own disposable room created; generated result independently checked; `view` persisted readback, clear readback, stable retry and cursor event readback passed; membership retired. Private credential was kept in a temporary session file and removed.
- Browser: 10 accepted journeys: two clients/persisted result; stock models/percentiles; local preferences/history; keyboard/reflow/forced colors; blocked storage/WebGL; repeated/concurrent DOM announcements; invalid input correction/copied-tab identity; modal announcer; fresh default boot; two mixed32 pools fitting independently, five-second hold/fade and persisted logs. Initial startup failed because port9590 was occupied; tests bind127.0.0.1:9591. Initial selector mistakes were corrected. Actual clean-default and CSS bugs were fixed, then affected cases rerun.
- Complete current unit suite: 55 tests across6 files passed (512ms).
- Mixed-pool browser validation corrected image-classifier facet seams and composited overlays; screenshots show64 separated dice inside the tray. Renderer framing, d4 size and timed fade were improved.
- Typecheck and production frontend build passed. Build emits a Three.js chunk size advisory; graphics remain dynamically loaded and initial text-only mode proves no graphics imports.

## Publication

- `f03beaa`: Convex deployment/codegen passed at `dev:nautical-partridge-636`, https://nautical-partridge-636.convex.cloud. Initial `96194c0` deploy was rejected before publication because components cannot run Node actions; secure sampling moved to the app wrapper.
- `805bb22`: custom trusted interpretation update deployed; codegen, CLI TypeScript and schema validation passed. Accepted focused results reused rather than rerunning suites for deployment.
- User enabled Pages Source → GitHub Actions after token's Pages creation permission returned403. Public backend URL set as repository Actions variable. Deployment key stays outside source/frontend/Actions variables.

## Explicitly pending evidence

The user approved publication with actual VoiceOver/NVDA spoken delivery and real-device animation checks pending. Browser DOM updates do not prove actual speech, and Chromium software rendering does not establish all-device behavior. No WCAG conformance or exact cross-device synchronization claim is made. Track the manual checklist in `docs/open-questions.md`.
