# Standalone follow-up audit

This follows the clean literal extraction recorded in `extraction.md`. The source
implementation remains Salient V272, `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b`.
The owner's subsequent instructions authorize variable dice, classical names,
removal of the Source link, and collapsed accessibility controls. Default Power
Roll layout, models, material pipeline and recorded physics remain the baseline.

## Changes justified by the extraction plan

| Requirement | Adaptation |
| --- | --- |
| Independent module imports | Source entry points for pure dice, Draw Steel presets, client, optional Three, React, formatter and scoped CSS. No site initialization on import. |
| Independent authority | Component contains moved original functions; app wrappers preserve endpoint names. Generated faces bind to private session and stable request. Supplied results require a trusted host wrapper. |
| Retry and cleanup | Indexed retained request receipts survive shared clear/replacement. Meaningful input changes reject retries. Room/session/receipt cleanup is bounded and scheduled. |
| Text independent of animation | Shared availability time comes from the original recorded-path reveal calculation. Controller timers deliver results without canvas/worker callbacks. Hidden graphics skip renderer and physics imports. |
| Reusable lifecycle | Per-instance room/context/controller/planner. No import-time URL mutation, ambient endpoint, CSS side effects or worker allocation. Host supplies connection, identity, name/profile, room and callbacks. |
| Browser persistence outside library | `web/site/` owns URL routing, private tab identity, preferences and compact IndexedDB history partitioned by deployment/table. Invalid or blocked storage falls back safely. |
| Accessibility | Approved closed section; local device/reduced/full motion, hide 3D, contrast and announcement choice. Detailed HTML descriptions and serialized semantic announcements. Decorative profile remains unchanged. |
| Requested variable dice | Original physics generalized by die stride and hull; all stock models use original materials/fonts/patterns. Power roll uses the original logical d10; generic d10 is a trapezohedron. Count 1–20 is an animation/backend bound, distinct from the pure generator's 100-die limit. |
| Standalone names/title | Greek/Roman default pool; title only Power Roller. No catalog or reference corpus copied. |
| Hosting | Existing Actions Pages publication, explicit dedicated dev Convex target, original font licenses and project-base worker/asset paths. |

These are targeted extensions of the copied source. The default power-roll
solver branch retains its original parameters, entry path, random consumption,
camera, lighting, scales and recorded 60Hz playback. Larger recorded paths use a
Float64 transfer buffer; this changes transport representation, not frame rate.

## Scope and open questions

See `api-coverage.md` for exact API coverage. The plan's broader collaborative
mixed groups, alternate rulesets, context metadata and logical pools above 20
are queued by the owner for a later release; the current community UI follows the owner's requested
stock-die picker. Pure APIs cover mixed dice, keep/drop, percentiles and cited
Draw Steel interpretations, and hosts can present already accepted results.
This is not completion of every proposed P3 collaborative capability.

Package publication to npm and future Salient dependency versus fork are
undecided. Source consumption and the installable component are documented;
no Salient integration is changed here. Normal-theme timestamp contrast debt
remains; opt-in high contrast does not imply normal-theme conformance.

Actual VoiceOver/NVDA delivery and physical-device animation/performance remain
pending under the owner's publication waiver. Browser/DOM evidence cannot replace
those checks or establish WCAG conformance.

## Verification

Authoring typecheck passed. Initial combined suite: 10 files, 59 tests passed.
Backend component-focused checks: original/authority tests 8 passed and component
TypeScript passed. Production build with the explicit dedicated public endpoint
includes separately loaded renderer, preview, physics worker and all four fonts.
Final focused browser and consumer results will be recorded with the release.

Host asset overrides are explicit: `loadDiceFonts(customSources)` accepts per-font
URLs; `createThrowPlanner({workerFactory})` accepts a host-managed worker factory.
Defaults retain the copied bundled font/worker URLs. Vite's project-base setting
can be overridden for a custom-domain build without changing application source.

Focused Chromium acceptance on the dedicated dev backend passed: two contexts
observed the same persisted power faces/total, all six stock models accepted
recorded paths, seven cached log entries survived reload, and a motionless roll
reached a full-3D peer without errors. Fresh hidden-3D boot requested no graphics
or physics modules. Name/style/preferences restored; Arrow/Escape menu handling
and dialog focus return passed. Two mounted rollers retained host styling and
independent selections without duplicate IDs or graphics loading.

A 320×225 viewport exposes the copied layout's short-height clipping. A concrete
vertical-wrap preview is prepared; applying it awaits the owner's decision.
Normal 390×844 and 640×450 layouts have no horizontal overflow and reachable Roll.
Real assistive technology and physical devices remain pending, not simulated.

The packed artifact was installed into an independent temporary consumer. Its
core/client build rejected React, Three, Cannon and CSS imports; its optional
Three build rejected React/CSS imports. Both built successfully. Installed
component source and the consumer typechecked. Generated component bindings are
included in artifacts, never committed. npm publication is not part of this release.
