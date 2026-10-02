# Click Clacks V1 implementation

Implementation base: `87b0646`, after the D100/theme/collision handoff. Integration
branch: `refactor/v1-cleanup`, isolated worktree `.worktrees/v1-cleanup`.
This implements the authorized cleanup, frontend performance and backend cost plan.

## Integrated changes

- Compact semantic tracks; immutable recording fetched separately by roll ID.
  Current tracks store semantic data once. Legacy combined endpoints remain adapters.
- Playback telemetry is independently indexed by room/roller/roll/viewer. A fallback
  receipt cannot overwrite an actual rendered receipt. No motion rewrite on receipt.
- Compact subscriptions use the canonical UUID even when a player joined using a
  share code, avoiding room heartbeat dependencies. Room view still
  includes presence and sequence; cursor changes trigger catch-up, heartbeats do not.
- Clock forwarding returns server time directly. Site controller consumes the existing
  browser clock estimate instead of making three additional serial clock requests.
- Current results, recordings, receipts and browser history expire at the original
  one-hour request deadline. Minimal retry tombstones remain until room expiry.
  Cleanup remains bounded/indexed; legacy V1 expiry is covered, and pre-upgrade
  full tracks are normalized two at a time with shared read-limit headroom, so
  old 24-hour/absent deadlines
  do not leave recordings indefinitely. Leave-by-code resolves
  the canonical key before deleting its persisted track.
- Pure contracts/codecs/preferences and cosmetic names live in `shared`. UI authority,
  acceptance and retry use the same controller as the SDK. Presentation/dialog/history/
  telemetry lifecycles are isolated modules. Idle React ticks use nearest deadlines.
- IndexedDB v2 upgrades in place, indexes room/time/expiry, serializes atomic pruning
  across tabs, caps histories and closes connections on errors/version changes. An open log
  sweeps persistent expired rows at its nearest original result deadline.
- Pinned Three 0.186.1 patch owns/disposes lighting lookup per renderer. Active trays
  retain their own lookup. Immutable geometry/texture caches are instance-owned and
  bounded; lane materials retain independent opacity. Per-frame support calculations
  use scratch vectors. Planner warming coalesces obsolete intent and prioritizes throws.
- Main and PiP share one asset graph, worker and font URLs. The old tray document URL
  remains available without a second bundle. Per-document performance clock origins
  remain independent; shared controls retain epoch-based ready deadlines.
- Primary source/package name is `clickclacks`, with `ClickClacks` React exports and
  legacy aliases. Browser storage keys and the installed community component namespace
  remain compatible. Remote project metadata and Pages hosting paths are unchanged. Source-package
  graphics consumers register the included pinned Three patch in their own host;
  package-manager patch configuration does not propagate transitively.

## Coordinator acceptance request

Authoring checks have passed typecheck and the changed focused tests. Full suite,
backend rehearsal, browser profiles and session-soak checks belong to the assigned
coordinator; implementation worktrees must not run them independently.

The new frontend requires the new backend endpoints. Do not point a candidate
frontend at the older shared live deployment and interpret missing endpoints as
regressions. Use an isolated anonymous/local backend for rehearsal, or coordinate
an explicitly authorized deployment. Unset ambient `CONVEX_DEPLOY_KEY` for CLI work.
No reset, snapshot, import or write to another thread's shared environment is requested.

Suggested private ports: preview 9610, isolated Convex cloud/site 9612/9613. Convex
1.45 supports `CONVEX_AGENT_MODE=anonymous`, `--local-cloud-port` and `--local-site-port`;
check target configuration and announce local-anonymous before startup. Generate the
component bindings against this isolated backend; ignored copies are authoring-only.
Keep artifacts outside Git under `test-artifacts/v1-readiness-<commit>/`.

1. Typecheck and the complete unit/Convex suite once at the frozen candidate. Validate
   actual Convex schema/function registration and legacy component mount preservation.
2. `node tests/browser-site-history.mjs`: real v1→v2 IndexedDB upgrade, expired data,
   concurrent writes from independent windows, indexed reads with getAll forbidden.
   Extend targeted checks to caps, blocked upgrade and connection cleanup as needed.
3. `URL=<private preview> OUT=<artifact> node scripts/profile-lifecycle.mjs`: 30 preview
   cycles, native context/texture/DOM and post-GC heap plateau. Keep a live main tray
   and PiP rendering while previews close; retired-renderer disposal must not damage them.
4. `scripts/profile-frontend.mjs`: normal/throttled startup, fixed styles for comparable
   20d20 timing, idle DOM churn, edited-quantity warming, PiP transfer, repeated rolls,
   hide/show/reset/customize, sound and renderer transitions. Preserve exact D100 pair,
   d4 labels/modifiers, frozen results, two-second gate and queue snapshots.
5. `scripts/profile-storage.mjs`: real indexed 0/1000/10000-entry timing. The new
   benchmark seeds valid one-hour timestamps and v2 indexes; old reports used 30-day
   retention and their entry ages are not interchangeable.
6. At least one long-session soak with repeated rolling and preview/visibility/PiP
   cycles; take spaced post-GC points, inspect worker/WebGL/listener/audio/socket counts
   and errors. Exercise an open result crossing its original one-hour deadline. A short
   loop or flat JS heap alone does not prove no retained native/GPU resources.

Compare source, commit, style, viewport and environment explicitly. Chromium software
rendering provides main-thread/frame-gap evidence, not a physical phone FPS claim.

## Remaining design/publication boundaries

The settled/all-owner collision fix and adaptive hull sizes are preserved. Independent
moving paths remain the existing behavior. Reciprocal moving collisions need the scene
revision/cutover design in `tray-collisions.md` and a result/printed-label decision;
the owner confirmed on 2026-10-02 that this larger behavior change is deferred.
Keep the settled-dice fix for version one.

No GitHub repository rename or Convex project rename is included. Publication was
authorized by the owner on 2026-10-02; the release record below identifies the
merged commit and targets. Preserve all other threads' branches, worktrees and
running previews.

## Release acceptance — 2026-10-02

The implementation candidate is `847dbbf`, reviewed independently without a concrete
remaining blocker. The assigned Test coordinator accepted:

- 160/160 unit and Convex tests at `e2a541b`; final backend budget adjustment at
  `847dbbf` passed 14/14 targeted legacy checks and post-codegen TypeScript checking.
- Actual isolated Convex schema/function registration and the preserved component mount.
- Connected D100, bonus d4 and modifier checks; IndexedDB upgrade, blocked-open and
  recovery checks; PiP, repeated rolls, clear, preview and audio transitions.
- Thirty preview cycles with native WebGL contexts 1→1, textures 4→4 and DOM nodes
  436→436. This addresses the confirmed preview lifecycle leak; it is not a claim
  that every form of memory use is constant.
- Full frontend phase/continuation and throttled startup captures, indexed storage
  benchmarks, and independent package installation with the included Three patch
  registered in the consumer host.

Evidence is outside Git in `test-artifacts/v1-readiness-a43eaa6/`,
`v1-readiness-e8d33d6/`, `v1-readiness-e2a541b/` and `v1-readiness-847dbbf/`.
The frontend captures span the documented commits; the final budget adjustment
changes backend cleanup limits only. Existing acceptance is reused for publication.

A real one-hour soak ran from 02:22:06 to 03:22:13 UTC on frozen `847dbbf`.
The assigned test thread reported exit 0 and no page errors across 20 rolls,
nine preview cycles, three PiP cycles, four visibility transitions and six sound
cycles. After the initial roll's original deadline, its UI row and IndexedDB
entry were absent and the public backend read returned `CURSOR_EXPIRED`.
This proves logical expiry, rather than physical database row deletion.

Native WebGL contexts stayed at one and textures at 26 across all five retention
samples. Heap grew from 7.28 to 10.04 MB and DOM nodes from 493 to 1092 as the
session accumulated retained log rows; this does not establish constant memory
use or rule out every leak. Worker/socket construction counts were one each,
and all six constructed audio contexts were closed. Listener counts, physical
GPU allocations and phone FPS were not measured. The result covers `847dbbf`,
before the subsequent roll-latency and Reload changes. Full evidence and limits
are in `test-artifacts/v1-readiness-847dbbf/soak-summary.json`.

Publication order is pushed main, dedicated Convex dev backend, then an explicit
Pages workflow dispatch. The release commit uses `[skip ci]` to prevent the main
push from automatically publishing the new frontend before its backend exists.
The test thread released the clean frozen worktree and stopped its private
9610/9612/9613 stack after the soak.

### Publication result

`7b9f177` (runtime candidate `847dbbf` plus this release acceptance record) was
fast-forwarded into standalone `main` and pushed to `illos/powerroller`.
The dedicated dev backend `nautical-partridge-636` reported functions ready at
02:31:50 UTC; codegen, schema validation and TypeScript checks succeeded.
The ambient Salient deploy key was explicitly unset.

[Pages run 36956072861](https://github.com/illos/powerroller/actions/runs/36956072861)
built and deployed successfully at 02:32:37 UTC. No additional suite or browser
runs were added for publication. The owner authorized publication while the soak
was still running; its later passing result is recorded above.
