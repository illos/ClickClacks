# Click Clacks: clean version-one plan

Investigation date: 2026-10-02. Code review baseline: standalone `main` **05b6c42**.
This is the implementation plan for the existing app, reusable package and Convex
component. It combines the codebase cleanup review, measured frontend performance
investigation and database/cost review. No runtime changes are included in this
document's commit.

**Recommendation:** undertake a focused refactor in small, independently reviewable
slices. The existing arithmetic, server authority, component isolation and optional
graphics are useful foundations. The substantial cleanup is in orchestration,
contracts, resource ownership, database subscriptions and history storage.

The owner confirmed that the feature set is complete and requested polish, bug fixes
and optimization. The subsequent history decision is **one hour**, without cleanup
triggered by the last participant leaving. That decision supersedes the earlier
30-day browser-history preservation requirement.

On 2026-10-02 the owner authorized executing the combined cleanup/performance/Convex
plan, then instructed this thread to wait until POWERROLLER lands its current work
before starting implementation. No implementation began before that instruction.
The owner also requested proper Click Clacks naming throughout the codebase. The
naming work below supersedes this plan's earlier recommendation to leave the old
package/component branding as the primary name.

## Current state and evidence

- `05b6c42` is main/live according to POWERROLLER's handoff. It includes System,
  Light and Dark themes; adaptive dice sizing; and collisions with all visible
  settled dice, including the roller's own. Small pools use scale 0.7475; larger
  pools taper by `sqrt(6/count)` with a floor of 0.5. Renderer, planner and prior
  obstacles retain matching per-roll scales. Its owner reports typecheck, both
  builds, nine focused tests and Chromium geometry/persisted roll checks passing.
- Frontend measurements precede that sizing change: `f6319d3`, with profiling
  checkpoints `33c82b8`, `65ddbfb`, `62a1c58`, `f5a06be` and `8f9bcb0`. Use them to
  identify causes, then measure the settled sizing revision for comparisons.
- The backend study uses the dedicated `nautical-partridge-636` deployment's
  2026-10-01 testing traffic. It is evidence of cost drivers, rather than an exact
  estimate of ordinary players' active hours.
- Daily usage counters are prepared at `dc00359` on `feat/basic-usage`, outside
  main. They count created tables, participant-table sessions, accepted rolls and
  dice. They are not unique-player or connected-hours measurements. The shared
  daily counter row is a potential contention point to monitor, not a reason to
  introduce counter sharding before traffic warrants it.
- POWERROLLER also has owner-requested D100 work underway on `feat/percentile`:
  the fixed original power-model pair becomes tens/ones, with generic modifiers
  and optional bonus d4, without count controls. It is not in the `05b6c42` audit
  baseline. Reconcile its final contracts/model labels/storage and acceptance
  evidence before starting dependent cleanup or comparing final-release profiles.
  Preserve this accepted addition when it lands.

The review inventoried 165 authored TS/TSX/MJS/CSS/HTML files under `lib`, `shared`,
`component`, `convex`, `web`, `scripts`, `tests` and `examples` (14,916 lines), plus
root configuration, deployment workflow, documentation and asset provenance.
It traced imports and public entry points and inspected the room/request lifecycle,
UI orchestration, graphics, workers, audio, persistence and representative tests.
There are 27 focused test files and 31 browser scenario scripts. Generated Convex
bindings, dependencies and build products are excluded from cleanup inventory.
Static import reachability was checked against HTML entries, package exports and
backend modules; worker `new URL(...)` entry points and Vite asset imports were
accounted for manually. Reachability alone is not permission to delete a file.

This task is a static investigation and plan. Existing profiling was run by the
test coordinator; no new application tests or live mutations were run for this
documentation task. New correctness findings below are identified from code and
need their specified regression checks when fixed.

Supporting historical reports, now copied alongside this plan:

- [Backend and cost investigation](performance-optimization-plan.md), originally
  committed at `e368a43`.
- [Frontend measurements and leak diagnosis](frontend-performance-investigation.md),
  originally committed at `b960b2b`.
- [Sizing and collision contract](tray-collisions.md), current at the review baseline.

### Measured priorities

| Area | Evidence | Implication |
| --- | --- | --- |
| Preview lifecycle | 30 open/close cycles: native WebGL contexts 2→32, native textures 10→190, DOM nodes 437→617, post-GC JS heap 5.366→6.990 MiB | Confirmed accumulating retention; fix resource ownership first |
| Leak root | Three 0.186.1's module-scoped `DFG_LUT` retains renderer dispose listeners/source caches; scoped diagnostic disposal releases retired contexts | Fix the pinned renderer integration without disposing the global lookup under another live tray |
| Large roll setup | Fixed active-frame probe: first and repeated 20d20 runs had approximately 1.55-second maximum rAF gaps; nearby long tasks were about 0.6 and 1.0 seconds | Reduce construction/upload work; p95 near 16.7 ms hides the severe hitch |
| Graphics allocation | One 20d20 lane creates 400 face textures plus 20 shadows | Reuse immutable textures/geometries; retain independently fading materials |
| Worker queue | 19 quantity edits generated intermediate warm jobs; observed reply delays reached 3.27 seconds, with some warm simulations failing to settle | Coalesce obsolete warm intent and prioritize actual throws |
| Empty idle page | Zero GPU draws, but 1,428 DOM mutations in 12 seconds | Remove the global 250 ms React tick and stabilize log effects |
| Browser history | At 10,000 entries, median load 70.45 ms and save 78.85 ms; both scan the global store | Index room/time reads and use transactional targeted writes |
| PiP | Opening the native floating tray transferred an additional ~345 KB and created another socket | Share build assets first; measure connection/clock sharing separately |
| Convex calls | 11,912 of 31,759 invocations were root/component clock calls | Return server time directly from the root action |
| Convex bandwidth | Tracks 42.6%, playback receipts 28.9%, accepted-roll mutations 15.2% of 357.18 MB I/O | Stop reading/writing complete recordings for heartbeat and telemetry changes |
| Receipt contention | 111 receipt OCC retry insights in the sampled period | Write telemetry independently per viewer, away from the motion-bearing track |

The browser profiles used Chromium, a 430×932 viewport and software SwiftShader,
not a physical phone. Throttled cold startup median was 2.503 seconds to enabled
Roll and 2.384 seconds to canvas. Normal cold startup was about 1.008 seconds to
Roll. Recorded rAF gaps are main-thread scheduling evidence, not measured physical
GPU presentation FPS. Earlier full-run frame counts have a sampler defect and
must not be reused; the corrected focused timing probe is the frame-gap source.
GPU byte estimates and native-object counts are different measurements.

## Cleanup findings

| Finding | Source and effect | Treatment |
| --- | --- | --- |
| Roller orchestration is concentrated in one component | [main.tsx](../web/dice-demo-v2/main.tsx), 1,658 lines. `DiceRoom` owns membership, clocks, retries, queues, worker/renderer/audio, delivery, storage callbacks, settings and controls | Extract by responsibility and lifecycle, maintaining the existing UI |
| Site and SDK have two submission paths | UI `submit` directly customizes/samples/prepares/accepts; [client.ts](../lib/client.ts) already samples/prepares/accepts/retries. UI also creates an observing controller for delivery | Use one authority/delivery service, with browser adapters for current interaction requirements |
| Clock and subscription ownership is scattered | Browser clock service gathers seven concurrent samples; observer controller independently gathers three sequential samples. UI and observer both consume tracks | Inject a shared clock within a mounted roller. Consolidate decoding/delivery; identical Convex query arguments may already share the wire subscription |
| Pure contracts live under presentation directories | `lib/client.ts` imports clock math, codecs and room parsing from `web/dice-demo*`; config/roll/style types and API shapes are independently declared | Move pure contracts/helpers into `shared`; retain public exports and compatibility re-exports. These imports currently do not load Three or React |
| Reusable React types depend on site persistence types | Main, accessibility controls and log use `SitePreferences` from `web/site/storage.ts` | Define reusable presentation preferences separately from site-only profile/room/history persistence |
| Backend behavior and API declarations drift across layers | 789-line [component/diceDemoV2.ts](../component/diceDemoV2.ts), schema validators, root forwarders, browser refs, SDK and CLI method classification | Extract shared validators/handler helpers while keeping registered endpoint files and names stable; make method kinds/results explicit |
| Community request-ID validation differs between client and server | Controller accepts any 1–128-character ID; the community backend requires a UUID | Document and validate the community constraint in its adapter without silently restricting a custom host transport's supported IDs |
| A code-based leave misses its persisted track | `leave` resolves `found.key`, then queries the track with `args.key`; tracks are stored under the UUID. Passing the eight-character room code leaves the track behind | Use the canonical resolved room key; assert persisted deletion for UUID, code and accepted normalized code input |
| Legacy V1 rooms are omitted from expiry cleanup | [cleanup.ts](../component/cleanup.ts) handles only V2 tables; [diceDemoTables.ts](../component/diceDemoTables.ts) gives V1 rooms only a key index | Add indexed, bounded legacy expiry cleanup while the API remains served |
| Local history policy and server history differ | [storage.ts](../web/site/storage.ts) retains 30 days by `savedAt`; server semantic receipts/presentations retain one hour, while current tracks survive up to 24 hours | Apply the selected one-hour result policy consistently; keep minimal retry guards separate |
| IndexedDB cleanup can race and leak an acquired connection on error | `getAll` is outside the later write transaction; `db.close()` occurs only on success | Atomic targeted upsert/pruning, indexed reads, and reliable connection/versionchange cleanup |
| SDK retries retain large cosmetic data | `requests` is bounded by 1,000 entries but holds both prepared and accepted motion; `dispose` does not clear those maps | Release heavy references on disposal and use byte/age bounds for completed motion, preserving stable-ID authority |
| Package stylesheet can affect its host document | [theme.css](../web/dice-demo-v2/theme.css) includes unscoped `html[data-theme]` styling in `powerroller/styles.css` | Keep document styling in site/PiP shells; scope reusable themes to each roller |
| Production code is mixed with experiments and inherited CSS | Stock models, worker and codec live in `dice-demo`; actual PiP boot lives in `popout-demo`; `game-values.css` includes Salient class/resource selectors unused by this roller | Move shared machinery before retiring inactive demo UI; keep only reachable roller CSS and explicit workbench/example sources |
| Small duplication and readability debt | Classical name arrays occur in server/site; root forwarders have unused broad imports; several SDK/CLI/control files compress functions into one-line blocks | Share cosmetic data, prune verified unused imports and format changed modules in their owning slice |
| Browser checks repeat infrastructure | 31 scripts repeat launch/display, endpoint/session, error capture and cleanup setup | Share test infrastructure while preserving scenario assertions and persisted readback |

The SDK request-cache risk is separate from the measured website preview leak:
the current site uses its own submit path and an observing controller, rather than
calling that controller's `roll` method. Its ordinary roll-loop heap was bounded
in the recorded short investigation.

The app already has an intentional guest capability model: room codes permit shared
reads and a separate private credential authorizes a participant's writes. Trusted
supplied-face/policy wrappers are internal; root cleanup is internal. Keep those
boundaries. Requiring player accounts would add a feature rather than clean up the
existing design. The review found indexed, bounded V2 database access, not a general
unbounded backend scan. The expensive paths primarily reread large documents.

## Result retention: selected policy

Apply this to the built-in Click Clacks site and community defaults. An installing
host may deliberately configure its own bounded policy and own its own log.

| Data | Planned lifetime |
| --- | --- |
| Shared accepted-result history and per-request recorded presentation | Existing one-hour request deadline, capped by room expiry |
| Current accepted track's result/motion payload | No later than that same one-hour deadline; clearing/replacement/leave may remove it earlier |
| Site IndexedDB, fallback memory and visible history | The same original result deadline, with existing per-room/global/count bounds as additional caps |
| Minimal request tombstone | Until room expiry; request ID/configuration/conflict guard, without faces, full result, motion or timing telemetry |
| Room, private session and cumulative request limits | Current 24-hour room policy; no last-participant departure trigger |
| Playback telemetry | Bounded independently, no longer than its result's deadline |
| Aggregate daily usage, if deployed | Existing analytics policy; compact counts are not individual roll histories |

Transmit an explicit history deadline with new compact accepted records, derived
from the persisted request expiry. Cache it rather than computing `savedAt + 1h`
each time a roll is observed. Reload, reconnect, PiP, a retry or a second observer
must not extend a result's lifetime. For older cached entries without a deadline,
derive a conservative one-hour deadline from their original roll time, never a
fresh hour from the time of import. Validate it before restoring data.

Use a nearest-expiry timer for an open log, refresh on visibility return, and filter
expired payloads in server reads even before physical pruning. Indexed bounded
cleanup removes them on the existing five-minute maintenance cadence, with
continuations for backlog. That gives a one-hour logical limit with possible
maintenance delay for physical deletion. A closed browser can only prune its local
disk on a later visit; stale entries must not be displayed then.

Retry tombstones are necessary: deleting the entire request after an hour would
allow the same stable ID to sample again. Expired retries must continue to fail
with `REQUEST_EXPIRED`, and old cursor recovery must remain supported. Retention
must not reset cumulative room request limits. Shared tray clear continues to
clear current dice while retaining unexpired history and retry protection.
Define equivalent payload expiry for any still-served legacy V1 presentation route;
at minimum its expired rooms must be physically removed in bounded batches.

## Intended module boundaries

Keep the present stack and source-package model. Make Click Clacks the primary
name while supporting existing `powerroller/*` installation aliases, `PowerRoller`
props/exports and endpoint names through the explicit compatibility plan below.
Folder names below describe proposed ownership, not a compulsory mass rename.

| Layer | Owns | Must not own |
| --- | --- | --- |
| `shared/contracts`, pure helpers | Dice configuration, style, semantic result, motion, room snapshots, deadlines, clock math, codec, parsing and cited arithmetic | DOM, storage, React, Three, deployment choice |
| `lib` public entries + controller | Public adapters, request/retry state, accepted/available delivery, cursor recovery and instance disposal | Site navigation, localStorage, mandatory graphics or implicit backend selection |
| `component/lib` + stable Convex endpoint modules | Credential/member checks, canonical room lookup, policy, request binding/acceptance, compact events, motion/receipt persistence and cleanup | Browser preferences or application-specific account policy |
| `convex` | Explicit installing-app wrappers and access boundaries | A second implementation of roller behavior |
| Browser React integration | Focused room/presentation hooks, controls, settings, history rows, announcements | Independent authority/retry algorithms |
| Browser graphics/audio/planner modules | Explicit owned resources and cosmetic playback/preparation | Generating accepted faces, determining result availability or storing host history |
| `web/site` and PiP shell | Endpoint/identity, route, preferences, indexed history, document theme, host callbacks and window coordination | Pure library behavior or hidden global package side effects |
| `examples`/workbench | Legacy experiments, standalone examples and sound authoring tools | Production boot dependencies concealed as demo code |

Use one logical request service for sample→optional prepare→accept→available. Keep
the UI's click-time input snapshot, two-second gate, serialized authority queue and
uncertain-request retry semantics. Make membership and clock ownership explicit:
an observer must not accidentally join/heartbeat/leave membership owned by its
host. Prefer optional injection to two competing implementations. Do not replace
the controller with a new framework or introduce a generic state-management stack.

## Ordered implementation slices

Each slice gets its own branch/worktree, concrete acceptance checks and coordinator
handoff. Do not combine file moves, schema changes, new rendering techniques and
interaction changes into one large diff. Reuse historical evidence; fresh checks
are for the concrete changed paths.

| Slice | Work | Size | Dependencies |
| --- | --- | --- | --- |
| V1-01 | Repair preview/renderer resource retention | Medium | Settled current main |
| V1-02 | Establish pure contracts and typed transport boundaries | Medium | Current main; may follow V1-01 independently |
| V1-03 | Correct lifecycle cleanup and implement one-hour result retention | Medium | V1-02 for deadlines; canonical-key/legacy cleanup fixes are independent |
| V1-04 | Extract room/request/clock orchestration and eliminate idle polling | Large, split into small steps | V1-02; coordinate V1-03 deadlines |
| V1-05 | Reduce Convex call and document amplification | Large, staged endpoints/schema/client | Clock/cursor fixes are independent; remainder uses V1-02/V1-03 and V1-04 adapter |
| V1-06 | Index browser history and serialize persistence | Medium | V1-03; site storage boundary from V1-04 |
| V1-07 | Reuse graphics assets, reduce frame allocations and coalesce warm work | Medium–large | V1-01; planner boundary from V1-04 |
| V1-08 | Share build assets and simplify PiP ownership | Medium | V1-04, V1-05; build assets can precede connection sharing |
| V1-09 | Finish Click Clacks naming, module/CSS/tooling/docs cleanup and verify the release candidate | Medium | Relevant earlier slices; coordinated hosting rename |

Start with the confirmed lifecycle leak. Ship the independent direct-clock,
cursor-gating, canonical-leave and legacy-expiry fixes early; they do not need to
wait for the larger orchestration or database refactor. Dependencies apply to the
parts that change contracts, deadlines or optimized transport, not every small fix
listed under a later slice. Preserve final owner-authorized D100 work as it lands.

### V1-01 — stop preview and renderer retention

Treat the DFG lookup lifetime as an owned renderer integration issue. Prefer a
renderer-specific lookup with explicit disposal, or a narrowly scoped patch to the
pinned Three version that releases only the retired renderer's references. Inspect
the installed 0.186.1 source and maintain a reproducible patch if required. Calling
the module-global LUT's `dispose()` whenever a preview closes can invalidate the
still-live main tray or another embed; the diagnostic call is not a production fix.

Centralize tray/preview teardown without sharing a live WebGL context across
independent canvases. Cover partial construction failure, context loss, listeners,
resize observers, timers and resource disposal. Reusing a paused preview may reduce
mount churn, but must not substitute for fixing retention through other remounts.

Acceptance: reproduce the leak before the change, then repeat 30 preview cycles
without profiling wrappers. Native contexts/textures, detached nodes and post-GC
heap must plateau after warm-up rather than gain one context/six nodes per cycle.
Check main-tray playback, multiple embeds, hidden/visible graphics and room remounts.
Keep physical/frosted materials and all accepted designs visually identical.

### V1-02 — make contracts independent of demo and site code

Move pure style/dice/motion/room/result types, room parsing, clock arithmetic and
motion codec to shared modules. Separate `RollerPreferences` from site persistence
metadata; preserve the current public type/prop surface through aliases or optional
fields. Put reusable Convex validators in a neutral component module, with old
table modules re-exporting them during the transition.

Replace repeated action/query/mutation name lists with a small typed method map
used by the SDK, React adapter and CLI. Reduce `any` at transport boundaries using
typed internal calls/unknown external values without preventing a custom host
transport. Keep legacy diagnostic codes and credential redaction. Do not build an
API generator or universal validation framework for this small surface.

Acceptance: public arithmetic/client imports still reject React, Three, Cannon and
CSS; optional Three still rejects React/CSS. Node 24 CLI and source consumers keep
working with explicit TypeScript import paths. Backend validators and client return
types agree for bonus d4, packed motion, semantic events and missing legacy versions.

### V1-03 — fix canonical keys and retention cleanup

Correct code-based `leave` to delete by `found.key`. Add a persisted-table regression
for joining/rolling/leaving through a room code, including rejoin: a leftover track
must not return. Checking the public track query alone is insufficient because the
removed participant currently hides the orphaned row.

Add the legacy expiry index and bounded cleanup. Apply the retention policy above
to compact results, presentations and current payloads, preserving tombstones,
request counters, 24-hour rooms and credential checks. Expiry cleanup is distinct
from shared clear and participant leave. Verify at just before/after one hour, even
before the maintenance job runs. Expose deadlines additively before clients use them.

Acceptance: old results disappear from current/history reads and the open log at
their deadline; cleanup removes payloads; expired stable IDs cannot reroll. Unexpired
clear→retry returns the original accepted result and presentation without restoring
cleared dice. UUID/code leave removes the intended rows. Legacy and V2 cleanup stay
indexed and bounded. Coordinate any disposable dev reset; do not reset user browser
preferences or another thread's environment.

### V1-04 — extract orchestration while removing idle work

First extract controls, settings/share dialogs, history rows and announcement queue
without changing markup, keyboard handling or focus. Then extract room membership,
request intent/queue, clock/reconnect and presentation lifecycle. Use the public
controller's request/delivery path with the site's adapter requirements, rather
than retaining two sample/accept/retry implementations. Remove redundant observer
clock startup by injecting the already-owned estimate.

Bound completed-request motion by bytes and age; retrieve an unexpired retained
presentation again when a retry needs it instead of keeping 1,000 full recordings.
Keep request identity/fingerprint and authoritative conflict/expiry behavior. Clear
heavy maps on controller disposal even when a host keeps the disposed API object.

Replace the 250 ms component tick with deadlines for cooldown, participant staleness,
start/reveal, tray fade and history expiry. Resynchronize on visibility/reconnect.
Keep animation inside the renderer. Memoize unchanged log content; run row-motion
and observer setup when rows/layout really change. Preserve live avatar updates,
the full bounded log, bottom fade and reduced-motion behavior.

Share clock estimates in a defined time coordinate. Main and PiP documents have
different `performance.timeOrigin`; copying a raw performance-relative offset is
incorrect. Translate through epoch time or a shared server-now abstraction.

Acceptance: an unchanged idle room has no 250 ms React commits/log effect rebuilds
or recurring scene warm requests. Actual deadlines still fire. First enabled Roll
gets motion if graphics become ready during its server requests. Queue snapshots,
modifier reset, uncertain retries, reconnect, hidden/text results and announcements
remain correct. Local UI readiness must not wait for cosmetic worker success.

### V1-05 — reduce backend cost at the document boundaries

1. Return `Date.now()` directly from the root `diceDemo:clock` action. Preserve its
   public name/result and the existing seven-sample estimator and refresh cadence.
2. Gate automatic event catch-up on authoritative cursor advancement, with initial
   join/reconnect/manual catch-up exceptions. Preserve in-flight coalescing,
   `hasMore` and expired-cursor recovery, including an empty cleared tray.
3. Store playback receipts separately by room/roller/roll/viewer. A receipt must
   not read or rewrite a complete motion-bearing track. Coalesce fallback and
   renderer reports; an empty fallback must not overwrite accurate frame timing.
4. Introduce compact current/active roll metadata and immutable motion-by-request
   fetches. Derive overlap metadata from compact records, not eight full presentation
   reads. Index any added room/viewer/sequence access. Fetch/decode each new path once
   and retain the existing bounded overlapping lanes.
5. Isolate heartbeat/profile presence from the room's accepted-result sequence and
   motion. Use bounded participant/session reads and existing authorization semantics;
   do not replace membership liveness with an unauthenticated viewer ID.

Keep existing combined endpoints as compatibility adapters for hosts while the
built-in client adopts optimized endpoints. Maintain explicit clear boundaries:
archived motion/retries must not resurrect cleared or replaced current lanes. Receipt
expiry and current-track expiry now follow V1-03, replacing the old 24-hour-current
retention constraint in the historical backend plan.

Acceptance: one root action per clock ping; unchanged-cursor heartbeat performs no
automatic events fetch; heartbeat/receipt operations perform zero full-motion
reads/writes through optimized endpoints. Two/four/eight concurrent viewers retain
their telemetry without a shared track write target. Compare function calls, bytes,
latencies and OCC retries under the same workload. Keep secure server randomness,
first accepted presentation, result source, stable ID conflicts, all 60 Hz samples
and independent reveal delivery. Stage backend support before dependent frontend.

### V1-06 — make local history proportional to this table

Upgrade IndexedDB with backend/room/result-time and expiry indexes. Load only the
selected room; upsert by stable key. Serialize local pending writes, but also make
upsert/pruning decisions in a read/write transaction for cross-window correctness.
Use bounded expiry/count pruning and reliable connection cleanup/versionchange
handling. Retain validation, newest-first order, motion-free storage, quota/blocked
storage fallback and existing count caps. Apply V1-03 deadlines to disk, memory and
loaded UI data; shorten historical entries intentionally without erasing preferences.

Acceptance: room loads and ordinary writes do not `getAll()` the global store.
Compare 0/1,000/10,000-entry fixtures, concurrent main/PiP writes, malformed entries,
quota failures and blocked upgrades. Fresh rows survive concurrent pruning; expired
rows cannot gain a new hour by being observed again. Real IndexedDB tests are needed;
the existing storage tests mainly exercise fallback and mocked transactions.

### V1-07 — make large throws cheaper without changing their appearance

Introduce renderer-owned bounded caches for immutable model face geometry, numeral
textures and the radial shadow texture. Include every appearance/model/numbering
input in keys. Keep lane-specific material opacity and shadow gains independent.
Change `disposeGroup` ownership rules before sharing assets: its current traversal
disposes every mapped texture/geometry, which would break another cached lane.
Dispose caches when their renderer is retired; do not create an unbounded global
palette cache. First benefit should be a warm repeated pool reusing its face art.

Reuse scratch vectors in support-height calculations and avoid per-frame temporary
arrays. Separate label-width measurement from repeated transform writes; invalidate
on text/font/resize changes. Preserve arithmetic, models, d4 vertex numerals, power
d10 numbering, frosting, shadows, outlines and adaptive per-roll collision scales.

Coalesce warm requests by the latest complete dice/settled-obstacle scene. A planner
must not enqueue every superseded count change behind the next real throw. Preserve
fresh random cosmetic seeds and prioritize real preparation; stale warm results must
not replace the requested scene. Recheck obstacles at actual preparation. Do not
increase solver iterations or settling bounds to cover queue inefficiency.

Acceptance: fixed-appearance first/repeated power, stock and 20+1 throws show smaller
construction/upload costs; repeated rolls stop rebuilding 400 numeral textures.
Report worst active-frame gap and long tasks as well as median/p95. Proposed same-lab
target: remove recurring ~1.5-second setup stalls and bring warm repeated 20d20's
maximum gap below 250 ms; establish the post-sizing fixed-style baseline first.
Rapid quantity edits produce a bounded latest warm job, not a seconds-long backlog.
Cache memory plateaus under many styles and overlapping fades. Compare all themes,
patterns and fonts; reduced/hidden graphics retain semantic behavior.

### V1-08 — share downloads and clarify floating-tray ownership

Build site and PiP as multiple HTML entries into one shared asset graph/output,
preserving the currently supported HTML URLs and base-path/custom-domain behavior.
Keep fonts/renderer/worker lazy for hidden 3D. Move the actual PiP boot out of
`popout-demo` into its production shell, with examples using that shell explicitly.

After assets are shared, assess an opener-owned transport/clock and delivery bridge
for same-origin Document PiP, with a fallback for an unavailable/hidden opener.
Membership heartbeat, profile writes, audio and telemetry each need one intentional
owner. Both visible trays may continue drawing; preserve the opener's live view.
Separate browser tabs and unrelated embeds remain independent. Never expose the
private credential in URL/messages/logs or accept an unvalidated message origin.

Acceptance: warmed PiP reuses shared JS/font/worker URLs and avoids the measured
duplicate ~345 KB graph. Verify root and nested base paths, single shared identity,
focus/first-click readiness, controls/profile/theme synchronization, owner transfer
on open/close/background, table-switch closure and failed-load retry. Share fewer
sockets only if lifecycle evidence supports it; asset reuse can ship independently.

### V1-09 — leave a maintainable release candidate

Move document-level theme styles into the site/PiP shell, consolidate roller theme
tokens, and remove verified unused inherited selectors. Preserve host styling and
two independently themed embeds. Keep public import paths and source-consumption
behavior through compatibility aliases while making Click Clacks primary.

### Naming pass — Click Clacks throughout the maintained app

Use **Click Clacks** for human-readable names, **clickclacks** as the proposed
machine/package/repository slug, and **ClickClacks** for the React component.
Existing hosting/publication settings need to be coordinated with the owner and
the active thread; do not rename a live repository or deployment during its build.
This task initially updates the plan, with runtime changes waiting for POWERROLLER's
current work to land.

| Surface | Change and compatibility |
| --- | --- |
| UI, CLI help, workflow labels, maintained docs and examples | Replace product-name references with Click Clacks. Preserve Draw Steel's actual “power roll” mode and truthful historical extraction/commit records |
| Package and imports | Rename the private source package to `clickclacks`, update self imports/examples and current consumption instructions. Support existing consumers through an explicit dependency installation alias, rather than claiming two self-package names automatically resolve |
| React exports and types | Add primary `ClickClacks` / `ClickClacksOptions`; retain `PowerRoller` / `PowerRollerOptions` aliases with identical behavior |
| CSS | Use the branded container class; retain the legacy class/selector compatibility while theme scoping is refactored. Avoid changing approved styling or host isolation |
| Build configuration | Introduce `CLICKCLACKS_BASE` with `POWERROLLER_BASE` fallback. Coordinate the default asset base, PiP paths and source/live links with the actual hosting address at publication |
| Preferences, private identity and history | Centralize naming constants. Validate/migrate or deliberately retain legacy persisted identifiers so existing choices/session ownership survive. Do not blindly open a fresh empty IndexedDB database under the new name; combine any transition with V1-03/V1-06's one-hour/indexed history work |
| PiP/events/channels | Rename maintained identifiers with explicit mixed-name compatibility where required. Avoid duplicate event/result delivery and preserve one participant across the opener and tray |
| Convex component | Use Click Clacks in the component's maintained name/new installation instructions. Keep the existing app's mounted component namespace explicit during transition; renaming a mount is not merely a display-label change and must not silently create an empty second backend |
| GitHub repository | Rename the existing repository in place if the owner selects the proposed slug; retain its history. Update remotes, links and Pages asset paths together. No replacement repository is required |
| Convex project settings | Update the existing project's name/slug through Project Settings when authorized; use the same dedicated deployment rather than creating another project merely to change branding |
| Host checkout/project paths | Coordinate any filesystem/project-registration rename after active worktrees and peer endpoint dependencies are settled. A legacy path may remain explicitly for compatibility; never move another thread's checkout during its work |

Both services support renaming an existing project/repository: [GitHub repository
rename](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)
and [Convex Project Settings](https://docs.convex.dev/dashboard/projects#project-settings).
GitHub redirects repository/git traffic, but its project Pages URL is an exception;
the site/base-path transition must be coordinated rather than assuming the old
`/powerroller/` page automatically redirects. Convex project display/slug naming and
the component's mounted storage namespace are separate concerns.

Acceptance: new code/docs use the primary Click Clacks names; maintained old
branding occurrences are limited to documented compatibility identifiers, historical
records and still-live URLs pending transition. Existing preferences, private
sessions and unexpired logs survive the intended upgrade. Both build bases/PiP
routes, old/new React names, explicitly aliased consumers and the installed backend
remain usable. Record the final repository/project names and publication URLs.

### Remaining module, tooling and documentation cleanup

Classify legacy UI and sound experiments explicitly. `dice-clack`, `wood-clack` and
the cinematic cue source are not the normal site's current recorded sound path;
some remain authoring/provenance/test assets. Keep useful workbench sources under
examples/tooling, retain rights notices, and delete only verified obsolete runtime
or test code. Do not remove the worker, core models or actual PiP boot because an
import-only graph labels them unused. Keep supported V1 endpoints as compatibility
functions unless their retirement is separately approved.

Share the classical-name data. Prune unused wrapper imports and format affected
SDK/CLI modules for review. Consolidate browser launch/endpoint/artifact/cleanup
helpers; preserve distinct regressions, persisted readbacks and existing coordinator
ownership. Add a small import-boundary check if the refactor introduces enforceable
layer rules; avoid tests that only mirror helper implementation or file layout.

Update README, component/API coverage and architecture notes to current behavior.
Mark historical extraction/performance records as history rather than competing
instructions. Fold the authored profiling probes into maintained coordinator tooling
if they are reused; raw results and heap snapshots stay outside Git. Keep exact host
tool pins, MIT attribution, font notices and audio provenance. Refresh site metadata
for discoverability when the canonical public address is actually selected; domain
purchase and publication remain separate owner decisions.

## Collision investigation and coordinated workstream

POWERROLLER confirmed on 2026-10-02 that [its collision investigation](tray-collisions.md)
is final at `05b6c42`. The all-owner settled-hull fix is live. Moving-roll protocol
changes have not been implemented. This workstream is included in the unified plan
at the owner's request; it needs a behavior decision and feasibility prototype
before it becomes an implementation commitment for version one.

### What the current system does

Each thrower prepares a complete Cannon recording in its worker before accepting
the roll. The server subsequently assigns `startsAt`, and each viewer replays the
recording independently. The next planner includes completed, visible dice as
static obstacles at their original scales. It now includes the roller's own dice.
These recordings provide synchronized presentation, but concurrently moving rolls
do not participate in a shared dynamic physics world and can intersect.

Merely adding another recording as a kinematic obstacle gives one-way avoidance:
the new throw can react, while the earlier path remains unchanged. It also requires
time alignment before preparation. Reciprocal collisions require jointly planning
the affected moving bodies rather than independently playing immutable paths.

### Proposed shared-scene protocol

| Stage | Proposed work | Dependencies and acceptance |
| --- | --- | --- |
| C1: behavior and feasibility | Define treatment of already-revealed dice; prototype two overlapping throws with persistent face labels and unchanged accepted results | Pure contracts/resource boundaries from V1-02/V1-07; no live protocol change. Demonstrate labels, upper faces and accepted results remain consistent across a replan |
| C2: scene authority and transport | Add canonical scene revision/state and reserve a future cutover before planning; publish joint paths atomically against that revision | Compact semantic/motion separation from V1-05. Concurrent planners retry stale revisions; revisions, cutovers, clear and leave are explicit |
| C3: planning and playback integration | Resume affected bodies from the canonical scene, add the incoming throw, jointly record motion and switch viewers to accepted future paths at cutover | C1/C2 and bounded resource ownership. Keep stable roll IDs/results/receipts/reveal delivery and validate cross-viewer continuity |
| C4: load and lifecycle proof | Compare solver/queue/payload costs and run overlap, clear/retry, disconnected recovery and long-session cases | Coordinator evidence on the final feature set, including D100 when merged. Publish only after the chosen behavior and performance bounds are proven |

The reservation is essential: today the recording is already finished when the
server sets its start time, so a planner cannot align another moving roll precisely
at simulation time. The accepted scene revision must atomically choose its future
recordings; simultaneous participants cannot each publish incompatible room futures.
Stale preparations need bounded retries with a visible/recoverable failure path.
The owner’s existing two-second follow-up gate stays intact.

Keep semantic authority separate from scene authority. A replan cannot resample
faces, change accepted totals/source, generate another history event for the same
roll, repeat announcements/sounds, or silently alter an established reveal time.
Scene state needs enough versioned current pose/velocity information to resume the
chosen simulation; a history result by itself is insufficient.

**Unresolved behavior:** final numbering offsets are currently chosen from the
original recording's settled orientation. Joint replanning can turn an existing
die and expose a different upper face. Recomputing its numbering offset can visibly
change printed labels. Before implementation, choose and prove how revealed and
still-moving accepted dice retain their printed labels and result consistency.
An unconstrained shared Cannon recording does not automatically satisfy that.
The investigation does not establish a final answer to this product/physics choice.

### Performance and database consequences

- A scene replan may affect several rolls, increasing solver bodies and planner
  work. Coalescing obsolete warm jobs, shared asset caches and clear resource
  ownership become more valuable. Keep model geometry, adaptive scales, solver
  fidelity and sample precision; profile the largest supported concurrent scene.
- Store compact scene revisions separately from large path data. Two worst-case
  20+1 recordings alone contain 1,131,312 packed bytes before envelopes, exceeding
  the existing one-megabyte result bound. Fetch/partition motion by revision and
  roll rather than returning one full room-scene blob. Do not solve this by dropping
  samples or reducing the accepted dice limit.
- Distinguish immutable historical accepted results from replaceable future
  presentation segments. Retry returns the same accepted result; active viewers
  and reconnect recovery need the currently accepted scene future. Clear/leave
  invalidates affected scene state without resurrecting removed dice. Apply the
  one-hour history policy to archived segments and remove obsolete segments in
  bounded indexed cleanup.
- Every viewer needs the same accepted revision and cutover. Measure missed-cutover
  recovery, discontinuities, event ordering, payload size, conflicts, main-thread
  decoding and worker queue delay. Main/PiP must not replan independently for one
  participant. Background/resume needs current-scene catch-up, not replaying every
  old scene revision.

Recommendation: complete the immediate leak, contracts and metadata/motion work,
then use C1 to resolve feasibility and the result/label decision. If full reciprocal
collisions are selected for version one, C2–C4 become required before release;
otherwise the shipped settled-dice correction and current moving-roll limitation
remain explicit. This avoids estimating protocol work as a small cleanup patch.

## Release evidence and completion criteria

Implementers run allowed authoring checks and focused tests for concrete changed
paths. The test coordinator owns browser/live journeys and applicable suites.
Coordinate backend/frontend compatibility and any disposable environment reset.
Publication reuses accepted results instead of rerunning suites on promotion.

| Evidence | Required result |
| --- | --- |
| Authority and lifecycle | Wrong credentials refused; sampled faces/accepted result stable through retries; supplied path remains host-only; code/UUID leave has persisted deletion |
| History/expiry | One-hour server/browser/open-log expiry; no refresh extension; tombstones/cumulative limits preserved; cursor recovery and clear→retry work |
| Resource lifetime | Preview/remount retention plateau; caches bounded; disposal drops owned workers/audio/listeners/timers and heavy request references |
| Long-session behavior | Coordinator-run hour-scale soak with rolling, style changes, preview, PiP, background/resume and reconnect; post-GC samples distinguish bounded live logs/caches from a growing slope |
| Network/database | Per-active-hour/per-roll calls and bytes recorded for 1/2/4/8 players and idle windows; zero motion I/O on optimized heartbeat/receipt paths; reduced OCC retries |
| Browser responsiveness | Cold/warm enabled-Roll and canvas timing, large-pool worst gaps/long tasks, count-edit queue, storage tails and PiP transferred bytes improve under matched conditions |
| Product parity | Every supported stock/bonus pool, overlap, themes, patterns/fonts, mute/audio ownership, hidden/reduced motion, keyboard/focus, reflow and announcements preserved |
| Consumers/builds | Public pure/client/Three isolation, mountable React, Node CLI, installed component/codegen and both HTML routes retain their supported behavior |
| Collision scope | Settled/all-owner scale parity remains proven; if reciprocal moving collisions are selected, C1–C4 prove label/result consistency, atomic scenes, synchronized cutovers and bounded payloads |

The hour soak is meaningful after lifecycle/cache changes; it has not been run yet.
Pin profile/appearance, number of players, roll cadence, viewport, cache state and
GPU/backend conditions for comparisons. Do not compare random default styles as
if identical. Use physical mobile/Safari observations for device FPS and interruption
behavior; the existing Chromium lab evidence cannot certify those. Actual screen
reader evidence remains distinct from automated DOM announcements and existing
publication waivers. Record any remaining device limitations explicitly.

Use the dedicated deployment's existing Functions/Health/Usage views. If the already
requested daily counters are integrated, carry their exact session definitions and
avoid heartbeat/retry increments. Counter summaries can persist beyond individual
history. Track their OCC contribution before deciding on sharding. Twelve active
users span multiple eight-person rooms. Improved database structure should reduce
spend without removing features, but testing calls do not predict an exact bill;
update the projection using measured active duration and real post-change usage.

Version one is ready when the required slices' behavior and evidence are accepted,
the retained-data/lifecycle defects are fixed, and documentation describes what
actually shipped. This is an implementation plan; the existing code has not gained
these changes merely because the plan is complete.

## Conditional later work

Only proceed when measurements or a separate feature decision justify it:

- Texture atlases/merged faces/instancing if draw calls still dominate after cache
  and construction fixes. Transparent/frosted sorting and independent fading need
  careful visual proof.
- Lossless Float64 worker transfers if structured clone/pack/unpack costs remain
  material. Preserve buffer ownership, all recorded samples and motion versions.
- Audio density via a sorted sliding window if maximum-pool scheduling is costly.
- Further sampling-hop or clock-frequency reduction after authority/clock evidence.
- Sharded daily counters when actual concurrency shows the prepared metric row is hot.
- The collision protocol is covered by the coordinated C1–C4 workstream above;
  its version-one inclusion follows the behavior/feasibility decision.

Do not couple this cleanup to accounts, a dashboard, a framework replacement,
mandatory package publication, new dice/rules modes or broad dependency upgrades.
Keep the current accepted feature set while making its ownership and costs clear.
The owner-requested D100 addition is accepted in-progress work to preserve, rather
than an unrequested new mode introduced by this cleanup.
