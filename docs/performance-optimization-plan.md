# Click Clacks performance optimization plan

> Historical investigation. The implementation order and history policy in
> [the unified version-one plan](v1-readiness-plan.md) supersede this document.
> Measurements below retain their original revision and conditions.

Click Clacks is entering feature completion, polish and bug fixing. This plan reduces
backend usage, startup delay and browser work while preserving the accepted dice,
animations, shared results, controls, history and floating tray. Start with the clock
forwarding call and unnecessary history requests, then separate frequently changing
metadata from recorded motion. Browser work follows the same principle: update only
when something relevant changes, while keeping the current presentation.

This is a proposed implementation plan, not a record of completed optimizations.
The review covers the standalone app, reusable controller, Convex component, worker,
renderer, local persistence and main/PiP builds. Runtime analysis began at `f503321`;
source was subsequently checked against `892d219`. The latter already fixes profile
storage feedback and adds native PiP settings; those changes remain the baseline.
The concurrently requested System/Light/Dark theme work is a separate UI change;
implementers should recheck the theme and PiP preference paths before their slices.

## Evidence and limits

The read-only Convex assessment used the dedicated US East development deployment
`nautical-partridge-636`, its official MCP insights/logs/function surface, and its
dashboard billing queries. Billing counters cover the reported current-period
traffic through October 1, 2026, and can lag the latest activity. Existing browser
acceptance reports were read; no new live roll traffic or browser suite was run for
this plan. Both production entry builds were inspected. Browser hotspots below are
confirmed code mechanisms with unmeasured device-level impact unless stated otherwise.

| Standalone reported usage | Observation |
| --- | ---: |
| Function calls | 31,759 |
| Database I/O | 357.18 MB |
| Database storage including indexes | 21.20 MB |
| Action compute | About 0.019 GB-hours |
| Clock calls, app and component combined | 11,912; 37.5% of calls |
| Track reads, app and component combined | 152.15 MB; 42.6% of I/O |
| Playback receipt reads and writes | 103.25 MB; 28.9% of I/O |
| Accepted-roll mutation reads and writes | 54.46 MB; 15.2% of I/O |
| History events calls | 2,255 |

The saved 72-hour insights include 111 receipt calls with write-conflict retries
against motion-bearing Tracks and six against Rooms. Other room conflicts affect
sampling, roll acceptance, customization and leaving. They contain no recorded
permanent conflict failures or database read-limit events. A bounded log sample of
1,000 completions over 609 seconds includes 316 track executions reading 19.45 MB
and 41 receipts reading 4.12 MB and writing 1.91 MB. The largest track read in that
sample was about 712 KB. Expired-cursor and stale-presence errors in the sample are
recovery-path observations, not proof of user-visible failures.

Earlier combined reference-app and standalone dice traffic was approximately
45,273 calls, 485.33 MB I/O and 673 roll submissions. The earlier monthly estimates
used heartbeat counts as a proxy for user hours. Initial joins, reconnections,
invalid requests and automation make that proxy approximate. Use controlled
sessions to measure optimized costs; do not promise a new monthly price by applying
a percentage to the earlier estimate. The 71.5% I/O share of tracks and receipts
identifies where to work; it is not a claim that all those bytes can disappear.

Aggregate billing/insight evidence remains outside Git in the maintainer's
`click-clacks-cost-20261001` investigation bundle.
Commit summaries and measurements, not raw traffic, credentials or generated bundles.

## Behavior to preserve

- Secure server-owned sampled faces, immutable stable-request retries, supplied-result
  trust boundaries, rate limits, modifiers and all supported dice through 20 base
  dice plus the optional d4.
- Common authoritative reveal time, delivery independent of graphics, exactly-once
  history and announcements, and the current timing/receipt information.
- The original solver, all recorded 60 Hz samples, collision obstacles, numbering,
  materials, fonts, sound timing, overlapping throws, clearing and fade behavior.
- Eight-person rooms, current 24-hour room lifetime, one-hour semantic receipt
  retention and retry tombstones; a current tray can outlive archived presentations.
- Current membership/profile updates, readiness, expiry, join/leave, reconnection,
  room switching and expired-history recovery, including recovery after every tray
  has been cleared.
- Main and PiP control/profile sharing, table routing, focus behavior, independent
  tab identity, supported embed/CLI routes, reduced/hidden graphics and blocked-storage
  fallback. Preserve existing public endpoint shapes through compatibility adapters.

## Implementation order

Each row is a separately reviewable change. Size is relative engineering effort,
not a time commitment. Dependencies keep larger changes from masking small wins.

| Order | Change | Main benefit | Size | Depends on |
| --- | --- | --- | --- | --- |
| 0 | Establish controlled baselines and preserve behavior journeys | Reliable before/after evidence | Small | Current main |
| 1 | Return server time directly from the app clock action | Fewer billed calls and less latency | Small | 0 |
| 2 | Gate automatic history catch-up on the authoritative cursor | Fewer empty events requests | Small | 0 |
| 3 | Replace the global idle UI tick and stabilize log updates | Less main-thread work | Medium | 0 |
| 4 | Separate playback receipts by viewer | Less I/O and fewer write conflicts | Medium | 0 |
| 5 | Split compact current/active metadata from immutable motion and presence | Largest backend I/O opportunity | Large | 4 |
| 6 | Coalesce fallback and renderer timing receipts | Fewer writes and better timing integrity | Medium | 4 |
| 7 | Index and serialize local history persistence | Faster writes and room history loads | Medium | 0 |
| 8 | Reuse renderer geometry/textures with explicit ownership | Less allocation and GPU upload work | Medium | 0, browser profile |
| 9 | Remove per-frame allocation and unnecessary layout reads | Smoother large/overlapping rolls | Small–medium | 0, browser profile |
| 10 | Measure PiP duplicate work and shared asset caching | Faster PiP opening and lower background work | Medium | 3, 5 |
| 11 | Consider worker transfer, sampling and clock-frequency refinements | Additional savings if measured | Conditional | Re-measure 1–10 |

Orders 1 and 2 are the first implementation batch. Order 3 can proceed independently
of backend schema work. Orders 4–6 should share a documented data design but land in
small compatible steps. Record each result here or in a linked implementation note;
do not turn speculative opportunities into release requirements without evidence.

## Backend changes

### Remove the forwarding clock action

In [convex/diceDemo.ts](../convex/diceDemo.ts), `clock` forwards to the component
action in [component/diceDemo.ts](../component/diceDemo.ts), which only returns
`Date.now()`. Return that value directly from the public app action. Keep the
endpoint, return type, component export, seven-sample batch, fastest-three estimator,
30-second refresh, uncertainty handling and visibility/reconnection behavior.

The component clock contributed 5,897 reported calls: removing it would have
eliminated about 18.6% of all calls in this workload. This is a call reduction,
not an 18.6% bill reduction. Verify sampling and reveal accuracy before changing
anything about refresh frequency.

### Catch up only when the room cursor advances

[lib/client.ts](../lib/client.ts), `updateRoom`, requests `events` for every room
update, including heartbeats and customization. Joined controller mode also requests
catch-up after each heartbeat. Compare the observed authoritative target cursor
with the processed cursor before automatic catch-up. Preserve the serialized refresh
loop, arrivals during pagination, explicit force/reconnect recovery and room epochs.
Never infer the cursor from the visible tracks; clearing may leave none.

The site uses `observe()`, which does not start a second controller heartbeat.
React and the observer share one Convex client; duplicate consumers of matching
queries do not establish duplicate wire subscriptions. Optimize actual requests
and changing query dependencies, not the number of hooks alone.

### Separate receipts from motion-bearing tracks

[component/diceDemoV2.ts](../component/diceDemoV2.ts), `receipt`, reads and patches
the current track, including its full recording. Every viewer of a roll writes the
same document. Add small receipt rows indexed by room, roller, roll ID and viewer,
with a bounded read adapter exposing the same current receipts. Give each viewer
its own write target; one shared small receipt array would retain the contention.
Expose at most the same eight current viewer samples, with the existing credential
checks and no receipt from an older roll replacing the current roll's telemetry.

The built-in app must subscribe to receipts separately from motion. A small receipt
document that the large track query still reads will continue invalidating motion
reads. Keep the existing `track` endpoint as a compatibility facade for older
consumers, while the built-in client moves to the compact endpoints. Make repeated
identical receipt submissions no-ops and preserve measured timing over fallback
timing regardless of arrival order.

### Fetch motion by roll ID and subscribe to compact metadata

`track` currently reads Rooms for membership, motion-bearing Tracks for the latest
roll, and up to eight full Presentations to discover compact `activeRolls`. Each
heartbeat changes Rooms and invalidates that dependency. Even an explicit `rollId`
lookup walks the presentation range before finding the requested recording.

Design compact current/active roll metadata with stable IDs and an explicit clear
boundary. Keep heartbeat timestamps separate from static membership and immutable
recordings. Fetch a requested recording directly using the existing `by_request`
index; cache immutable motion within the client using backend, canonical room,
roller and roll ID. Bound that cache by active playback and the current reconnect
requirements. Query-cache hits do not make reading large documents free when a
mutation invalidates the query.

The motion lookup must preserve room capability checks and react to leave, expiry
and clear. Retain the eight-overlap bound, supported-version fallback and playback
order. Replace the current track creation-time clear boundary with an explicit
equivalent; do not accidentally resurrect pre-clear archived recordings.

**Retention constraint:** current Tracks normally last until room expiry, while
archived Presentations expire after one hour. Deduplicating motion storage by simply
pointing the current track at an existing one-hour presentation would break current
tray recovery. Keep a current recording until room expiry, or extend retention while
it is current. Removing a roll from current/active selection after replacement,
clear or leave must not immediately delete a retained recording: replaced throws
may still overlap, and a stable-ID retry after clear returns the original recording
without restoring its tray. Delete archived motion only at its retained expiry.
Choose and test this design before removing the current copy.

This work removes heartbeat and receipt dependencies from expensive motion reads.
Heartbeat frequency and the 30-second presence timeout can remain unchanged.
Keep the accepted-result sequence atomic; the observations do not justify sharding
an ordering counter or introducing a work queue.

### Coalesce delivery and renderer receipts

In [web/dice-demo-v2/main.tsx](../web/dice-demo-v2/main.tsx), `report` writes a fallback
timing receipt on semantic availability and can write again when the renderer
reports measured timing. Delivery deduplication covers history/announcements but
does not deduplicate receipt writes. Publish semantic results promptly, then
coalesce receipt submission so accurate renderer timing wins, with a bounded
fallback if graphics fail, are hidden or are handed off to PiP. Do not delay results
or announcements while waiting for cosmetics. Guard against stale callbacks after
room switches, clear and roll replacement.

## Browser changes

### Replace idle polling with relevant deadlines

`DiceRoom` updates `now` every 250 ms, including while hidden. That rebuilds the
member list and the full JSX tree, evaluates expiry, and constructs resting-scene
inputs. `RollLog` receives newly created children and its layout effects scan row
positions and reconnect ResizeObservers. The current visible log is bounded to
100 rows, but even that work need not repeat four times per second.

Use deadlines for membership expiry, roll start/reveal/fade and cooldown; reuse the
existing exact cooldown timer. Trigger updates on room/roll/profile events and
refresh state on visibility return. Keep the renderer's own animation clock.
Memoize stable log content and separate changes to row avatars from changes to row
order, so the displacement animation runs on a relevant layout change. Preserve
all current rows, bottom fade, keyboard scrolling, live avatars and reduced-motion
behavior. Do not use virtualization to remove accessible history as an initial fix.

Warm physics when dice configuration or the settled obstacle scene changes, rather
than deriving/stringifying the same scene on every UI tick. `warmThrows` already
deduplicates identical scene keys and the worker already precomputes the next fresh
trajectory. Preserve those protections and fresh per-throw seeds. Keep obstacle
updates at settle/fade/member boundaries and recheck the scene on the actual click.

### Index and serialize local history

[web/site/storage.ts](../web/site/storage.ts) opens IndexedDB for each operation and
`getAll()` scans the whole origin's history on both load and every saved roll. It
then validates, filters and sorts up to 10,000 entries to retain at most 1,000 per
room. Reads from other rooms should not grow the cost of saving one roll.

Use indexes for backend/room and save time, targeted room reads, direct keyed
upserts, and bounded pruning. Serialize the site's pending history writes and make
pruning decisions in the same read/write transaction; preserve cross-window
correctness. Reuse a database connection with `versionchange` handling. Upgrade
the browser store without losing saved history; the server's disposable-dev-data
policy does not authorize deleting user-local history. Retain malformed-row
validation, newest-first ordering, 30-day retention, global/per-room bounds,
motion-free storage and in-memory fallback. Cache failure remains cosmetic.

### Reuse graphics assets and reduce per-frame work

[web/dice-demo/dice-models.ts](../web/dice-demo/dice-models.ts), `createDie`, builds
geometry, a material and a 256×256 texture for each generic die face. Twenty d20s
create 400 face meshes and textures per lane. Their RGBA texture pixels alone are
about 100 MiB before mipmaps, canvas copies and driver overhead; this is an
allocation estimate, not measured device memory. Overlapping lanes repeat the work.

Cache immutable face geometry by model and painted textures by all appearance and
numbering inputs within each renderer. Keep per-lane materials where opacity/fade
is mutable; never share a mutable material across independent fading lanes. Add
reference ownership and a bounded cache, adapting `disposeGroup` so removing one
lane cannot dispose another lane's assets. Preserve all 256-pixel art, frosting,
fonts, d4 vertex numerals and power-roll digit conventions. Consider atlases or
merged meshes only after profiling confirms draw calls remain the bottleneck;
transparent sorting and frosting make that a larger visual risk.

[web/dice-demo-v2/renderer.ts](../web/dice-demo-v2/renderer.ts), `pose`, allocates
cloned vertex vectors every visible frame to calculate support height. Reuse scratch
vectors and loop directly. `resultLabel` can read `offsetWidth` after pose/style
work; measure widths in a dedicated layout phase, invalidate on resize/text/font
change, and keep draw-loop DOM reads separate from writes. The worker's capture
and resting-scene code have similar scratch-vector opportunities. Preserve the
same numeric operations and every recorded sample; no solver or frame-rate changes.

The tray already sleeps when settled and pauses when the document is hidden.
The customization preview mounts only while customization is open and draws at
30 Hz with reduced-motion handling. Audio is opt-in and tracks played rolls.
Keep these existing optimizations. Profile preview style scrubbing and large-pool
sound scheduling before optimizing them further; they are not measured dominant
costs in this review.

### Measure PiP and bundle reuse

The main and PiP entries are built independently, and the PiP iframe creates its
own Convex client and roller. The opener suppresses heartbeat, customization writes
and sound while PiP is active, but still has clock synchronization, subscriptions,
UI and rendering work. Both trays are visible capabilities, so removing the opener's
live view would change behavior. Start by removing redundant local history writes
and receipt reports, and measure a host-owned shared clock/transport adapter with
explicit lifecycle and fallback. Keep standalone embeds and separate browser tabs
independent. A backgrounded opener must not invalidate an active PiP session.

The `f503321` production build had about 376.7 KB raw / 116.4 KB Vite-estimated gzip
initial site JavaScript. Deferred Three-related chunks were approximately 352.3 KB
and 185.4 KB raw; the worker was 201.7 KB raw. The PiP build emits another comparable
graph under a separate path. Those are build sizes, not measured transferred bytes;
server compression and browser caching determine actual transfer. Investigate a
shared main/PiP asset output only if opening PiP downloads significant duplicates.
Keep hidden-3D imports lazy and the two supported HTML routes/base paths working.
The four font subsets together are only about 13 KB, so removing fonts has little
benefit and would remove accepted appearance choices.

## Conditional refinements after measurement

- **Lossless worker transport:** profile structured cloning and pack/unpack costs on
  20+1 pools. Transfer Float64 buffers where useful while retaining exact samples,
  motion versions and semantic reveal timing. Avoid Float32 conversion or sample
  reduction. Account for detached-buffer ownership and the worker's next warm path.
- **Sampling round trips:** the root sampling action forwards to another action,
  which checks a prior receipt and calls `recordSample`. Shared handler logic or
  removing a redundant preflight read may help, but each layer currently protects
  retry/authority behavior. Component sampling and preflight receipt checks each
  contributed only about 492 calls. Preserve secure randomness and all stable-ID
  conflict/expiry checks before simplifying them.
- **Clock frequency:** keep seven concurrent samples and the 30-second refresh in
  the first pass. Fewer/less frequent batches need drift, uncertainty, reconnect,
  focus and shared-reveal measurements. This is a conditional experiment, not a
  guaranteed behavior-preserving change.
- **Audio density calculation:** `dice-sound.ts` filters the impact list for every
  impact. If maximum-pool profiles show meaningful cost, a sorted sliding window
  can compute the same density. Preserve the same clacks, gains, timing, mute and
  iOS gesture/audio-session behavior.

Cleanup already uses indexed bounded batches, and its 249 reported calls were
under 1% of the workload. Cosmetic random names are small and the site already
chooses them locally. Neither needs priority. Do not add backend products,
analytics subscriptions, dependency upgrades or new features just to optimize.

## Measurement and acceptance

The test coordinator owns controlled browser/live journeys and applicable suites.
Implementers use authoring checks and focused tests as allowed by the project
workflow. Reuse accepted results at publication; deploy steps do not repeat suites
just because the revision or environment changed.

For each relevant change compare the same revision pair, fixed room/player count,
dice configurations, roll cadence, viewport, cache state and observation duration.
Record actual session duration directly. Test one, two, four and eight participants;
twelve participants require multiple rooms. Separate normal play from repeated
stress rolling and from idle visible/hidden tabs. Isolate load/fixture generation
from shared live rooms and record any traffic that contributes to billing.

| Scenario | Required evidence |
| --- | --- |
| Idle visible and hidden, fixed observation window | Calls by function, I/O bytes, query invalidations, React commits, worker messages, CPU wakeups and renderer frames |
| Power roll, every stock die, 20+1 pool | Click-to-accept latency, preparation time, full motion bytes/samples, frame-time distribution, result values and common reveal time |
| Two/four/eight players with overlapping throws | Per-user and per-room usage, receipt conflict retries, independent lane fades, playback timing and no missing/duplicate results |
| Clear, leave, expiry and disconnected catch-up | Persisted readback, preserved cursor/tombstones, no resurrected pre-clear paths and correct current-track recovery |
| Main/PiP open, focus, hide, close and table switch | One participant identity, controls/profile routing, no feedback loops, correct sound owner and restored membership ownership |
| History fixtures near 1,000 per room and 10,000 globally | Indexed load/write timings, concurrent-window writes, bounds, malformed entries and blocked/quota storage fallback |
| Cold/warm startup, graphics on/hidden | Enabled Roll and graphics-ready separately, transfer sizes, no eager hidden graphics, immediate first-click recorded path |

Use `tests/clock-sync.test.ts`, `tests/client.test.ts`, the authority/standalone dice
tests, motion/version/recorded-results tests, and storage tests for concrete
regressions. Coordinator browser journeys can reuse startup, overlap, concurrent
tray, live PiP, profile sync, history and hidden/keyboard scenarios. Current storage
tests primarily cover memory fallback; add real IndexedDB concurrency coverage
when changing that path. Physical Safari and real assistive-technology evidence
remain separate from emulated Chromium results.
In particular, prove clear → retry of the same request returns the same accepted
result and retained presentation while the current track remains absent; prove
replacement still permits the existing overlapping playback.

Proposed success criteria for the first implementation pass:

- Clock requests execute one server action; sample selection and refresh behavior
  remain equivalent, with no reveal-accuracy regression.
- A heartbeat with an unchanged cursor performs no automatic history events fetch.
- An unchanged presence heartbeat and a new playback receipt perform zero motion
  reads/writes through the built-in optimized endpoints. Initial joins and new roll
  motion fetches are expected work.
- Simultaneous viewer receipts avoid the shared track write target and preserve all
  samples; reported retry counts and I/O improve under the same controlled workload.
- Idle log layout work and the global 250 ms UI tick disappear; membership expiry,
  cooldown and roll reveal/fade still occur at their required deadlines.
- A normal local-history write and room load do not scan the global store; retained
  history survives upgrades and concurrent window writes.
- GPU/CPU changes improve measured large-pool behavior without visual drift,
  cross-lane resource corruption, missing frames, or unbounded caches. Set numeric
  frame-time/memory budgets only after recording the device baseline.

Measure medians and tail latencies where enough samples exist, retain errors and
retries, and report the actual test output. A mutation response alone is not proof
of retained state. Stage schema-compatible changes and new public wrappers before
switching clients; leave compatibility endpoints for existing embeds/CLI consumers.
Coordinate any development reset with its owner, rather than preserving/migrating
disposable server records. Recalculate the monthly model from measured calls and
bytes per active hour after the main changes; include shared team allowances and
the room mix. Roll back a slice if its behavioral checks fail.

## References and completed foundations

- [Startup performance](startup-performance.md): already completed seven concurrent
  clock samples, earlier fonts, local names and immediate first-click readiness.
  Its controlled median improved from 2.789 to 2.064 seconds; that is prior lab
  evidence, not a newly measured result from this review.
- [Standalone audit](standalone-audit.md), [component contract](component.md) and
  [API coverage](api-coverage.md): behavior, authority, lifecycle and supported hosts.
- [Convex best practices](https://docs.convex.dev/understanding/best-practices):
  keep documents/query dependencies focused and prefer shared handler functions.
- [Convex resource pricing](https://www.convex.dev/pricing) and
  [usage limits](https://docs.convex.dev/production/state/limits): current pricing,
  resource accounting and team-wide included allowances.
- [Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html):
  explicit geometry, texture and material ownership when introducing caches.
- [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB):
  indexed queries, transaction lifetimes and schema-version coordination.
