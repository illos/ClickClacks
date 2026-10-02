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
  full tracks are normalized in bounded batches so old 24-hour/absent deadlines
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

No GitHub repository rename, Convex project rename, main merge/push or shared live
promotion has been performed by this implementation thread. Those publication steps
must use the assigned coordinator and the session's authorization. Preserve all other
threads' branches, worktrees and running previews.
