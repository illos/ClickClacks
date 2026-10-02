# Click Clacks frontend performance investigation

> Historical investigation. The implementation order and history policy in
> [the unified version-one plan](v1-readiness-plan.md) supersede this document.
> Measurements below retain their original revision and conditions.
>
> Reproduction scripts below live in the original `docs/frontend-performance`
> investigation branch at `b960b2b`; this consolidation copies the report only.

Investigated on 2026-10-02 after POWERROLLER completed System/Light/Dark at
`f6319d35a70791a0a54b63b8ad00b3018455f659`. This report owns the frontend
investigation; POWERROLLER supplied the theme completion handoff. No application,
backend, solver, theme or interaction code was changed by this investigation.
The theme owner subsequently began a separate 15% die-size change, including
matching local collision hulls (`0.65 → 0.7475`) and shadows. It is also investigating
settled own-die and moving-die collisions. Measurements here remain explicitly at
the pre-size-change `f6319d3` baseline. Larger hulls may change settling and planner
cost; use the eventual collision revision as the baseline for implementation.

## Conclusions

The strongest opportunities are avoiding repeated graphics construction, coalescing
physics warm-up requests, sharing assets between the site and PiP, and removing idle
React work. Browser history should use indexed, bounded operations as it grows.
Treat these as separate changes with before/after evidence, preserving all features.

A preview lifecycle memory leak was reproduced without page instrumentation:
30 settings open/close cycles retained one additional native WebGL context per
cycle. Ordinary repeated rolls, tray fade/clear, sound and PiP did not show comparable
unbounded growth in the bounded run. Preview retention is the first fix to pursue;
post-GC heap and native-object growth are evidence, not proof of leaked GPU bytes.

## Method and evidence

Production main/PiP builds used the settled theme revision, served by Vite preview
at `127.0.0.1:9610`, with the existing dedicated anonymous Convex deployment
`nautical-partridge-636`. No deployment or database reset occurred. Usage-counter
work was confirmed local-only during measurements. Traffic came from fresh test
rooms, with about 30 bounded roll submissions across completed probes; an earlier
measurement run was stopped after 118 seconds to correct its clear-button sequence.
This is test traffic, not a representative active-user billing baseline.

The test coordinator executed the browser commands under the project test workflow;
this thread authored the probes, inspected the implementation, analyzed the raw
results and wrote the recommendations. Dependencies matched Node 24.18.0, pnpm
11.5.3 and Playwright 1.63.0. Install/build and completed browser probes exited zero.

- Full/retention and cold/warm startup: `33c82b8`, raw JSON/logs under
  `test-artifacts/frontend-performance-33c82b8/`.
- Focused active-frame, uninstrumented preview and actual IndexedDB module probes:
  `65ddbfb`, raw JSON/logs under
  `test-artifacts/frontend-performance-65ddbfb/`.
- Preview native retention: `62a1c58`, artifacts under
  `test-artifacts/frontend-performance-62a1c58/`.
- Strong-retainer path probe: `f5a06be`, artifacts under
  `test-artifacts/frontend-performance-f5a06be/`.
- Lookup ownership diagnostic: `8f9bcb0`, artifacts under
  `test-artifacts/frontend-performance-8f9bcb0/`.
- Module-size analysis: build with `write:false`, artifact `bundle-modules.json`
  retained outside Git with the maintainer's investigation evidence.
  It writes no application build files. Module rendered lengths are pre-minification
  attribution, not measured transferred-byte percentages.

Three fresh Chromium contexts each measured cold navigation and same-context reload.
The 430×932 viewport used dark OS appearance. The slow profile added 4× CPU and
150 ms HTTP latency, 1.6 Mbit/s download and 0.75 Mbit/s upload. WebSockets reached
real Convex; do not equate HTTP throttling with fixed socket round-trip latency.
Profiles were selected through the existing random palette, and stayed the same
within each context; finishes were not fixed across independent contexts. The large
texture counts are structural, but setup timings can vary by finish. Future
before/after comparisons should use a fixed palette/font and matching cold/warm
shader/cache state, not simply compare these independent random rolls.
The browser identified ANGLE/Vulkan **SwiftShader software graphics**, at pixel
ratio one. These observations do not establish physical phone/iPhone Safari FPS,
GPU memory, field Core Web Vitals, or multi-hour leak freedom. Firefox/WebKit host
library limitations were reported by the theme owner; those engines were not run here.

The probes counted WebGL calls/resources, worker timings, long tasks, DOM mutations,
CDP CPU/heap counters and post-GC retention. Wrappers and rAF monitoring add small
measurement overhead. Heap totals exclude some worker/GPU memory. Raw heap snapshots
for the separate preview probe stayed in process memory; only native class counts
were saved, without identity strings or credentials.

The first profiler's frame sampler could retain callbacks across adjacent phases.
Its frame counts/distributions are **excluded**. A generation guard and active-draw
classification were added, and only the focused probe supplies frame timing below.
The earlier startup marks, long tasks, resource counts and post-GC retention remain
useful. CPU figures include observer overhead and are approximate lab observations.

## Startup and downloads

| Median of three runs | Cold, normal | Reload, normal | Cold, slow profile | Reload, slow profile |
| --- | ---: | ---: | ---: | ---: |
| First contentful paint | 276 ms | 236 ms | 1,328 ms | 628 ms |
| Observed LCP | 288 ms | 236 ms | 1,488 ms | 772 ms |
| Canvas inserted | 299 ms | 245 ms | 2,384 ms | 1,115 ms |
| Roll enabled | 1,008 ms | 743 ms | 2,503 ms | 1,156 ms |

Canvas insertion is not a guarantee that the first trajectory is warmed. An enabled
Roll may finish cosmetic setup while server requests run; retain the existing
first-click behavior and logical fallback. These measurements are separate from the
previous controlled startup study, not a before/after comparison with it.

One cold normal context transferred 343,299 resource bytes, including 338,714
encoded payload bytes. Its reload transferred 4,800 reported bytes. Worker resource
accounting has separate timing/cache quirks, so do not infer network savings just
from encoded worker size. The measured server was already compressing responses.

The current entry is 383,662 raw bytes / approximately 117 KB gzip. Deferred Three
chunks are 352,322 and 185,363 raw bytes; the worker is 201,731 raw bytes. The UI
entry's largest retained module is React DOM; Convex and the app also contribute.
There is no evidence that replacing React or removing functionality is warranted.
Settings are a possible future split, but prioritize measured graphics/clock work.

Opening native PiP after the site was already loaded transferred **345,250 additional
resource bytes**, including 339,850 encoded bytes, and opened another WebSocket.
The worker bytes are identical in both builds, but live under different URLs.
Fonts and the common stylesheet are also emitted under separate paths. HTTP cache
reuse therefore cannot eliminate these duplicated downloads in the current build.
The PiP button became ready at 652 ms in this unthrottled sample.

Recommended startup work: keep the established concurrent clock sampling and lazy
hidden-3D path; remove the root-to-component clock action hop from the backend plan;
then emit main/PiP HTML entries into one shared asset graph while retaining their
existing routes. Keep all four fonts (about 13 KB total), both themes and the
identity ownership handshake. Do not eagerly load graphics for hidden-3D users.

## Idle, rolling and warm-up

Empty and settled 12-second windows recorded zero WebGL draw calls and zero new
textures/buffers. The renderer already sleeps and respects visibility. Preserve it.
The empty window still observed **1,428 DOM mutations** and about 85 ms of total
main-thread tasks, including profiling overhead. This is a small one-player CPU
cost, but recurring work rather than necessary rendering. `DiceRoom` updates global
`now` every 250 ms; `RollLog` rechecks offsets and replaces its ResizeObserver as
fresh `children` are created. Empty-window layout time was zero: the mutation count
alone does not establish 1,428 forced layouts.

Focused active-draw rAF observations (single roll per row; not GPU presentation FPS):

| Case | Active samples | Median / p95 gap | Largest gap | Gaps over 34 ms |
| --- | ---: | ---: | ---: | ---: |
| Power roll | 317 | 16.7 / 16.8 ms | 50.0 ms | 2 |
| First 20d20 | 238 | 16.7 / 16.7 ms | 1,566.6 ms | 1 |
| Repeat 20d20 | 163 | 16.7 / 16.8 ms | 1,549.9 ms | 1 |

Most frames were paced near 60 Hz; one long hitch dominated each large roll. A
healthy median or p95 hides that single severe interruption. The focused large
rolls had adjacent long tasks of 608/973 ms and 606/965 ms. These values support
prioritizing setup/compile/upload stalls rather than lowering the target frame rate.

A successful 20d20 roll created **420 textures** (400 numbered face textures and
20 shadows). The full probe recorded 74,760 WebGL calls during its 18-second window
and long tasks of 88 and **953 ms**. This establishes a stall and repeated setup
work; it does not attribute all 953 ms to texture painting. Shader compilation,
uploads, rendering and browser overhead need trace attribution during the fix.

A 256×256 RGBA face image is 256 KiB. Four hundred unique images imply about
**100 MiB of base image pixels**, before mipmaps, canvas backing stores and driver
allocation. This is arithmetic from dimensions, not measured GPU allocation. All
20 dice of the same style can reuse the same 20 numbered images and shadow image,
with exactly the same pixels. The existing implementation recreates them per die.

Changing counts quickly posts warm-up requests for intermediate configurations.
The full probe observed queued warm replies reaching **3.27 seconds** while the
UI moved toward 20 dice, and another sequence reaching **2.73 seconds** when count
was reduced. The first 20d20 attempt delivered a text history result with zero
WebGL draws; the repeat produced graphics. Do not call the first attempt healthy
60-FPS playback. The focused worker-error capture below distinguishes fallback
from actual rendering.

The focused first large roll captured three warm-up replies with
`This throw did not settle. Try another throw.` while changing configurations.
Its actual 20-face request succeeded with a 2,679 ms round trip but only 0.2 ms
reported in-worker planning time after it was dequeued. That difference strongly
indicates queue wait, with message/copy overhead also included. The repeat succeeded
with 289 ms round trip / 288 ms planning. The earlier text-only attempt remains an
observed cosmetic fallback whose exact error was not captured; these newer error
records do not establish that earlier attempt's cause.

Recommended rolling work: immutable texture/geometry reuse with explicit bounded
ownership; per-lane materials for opacity; one in-flight warm-up plus the latest
pending configuration, and priority for an actual requested throw. Keep every
60 Hz motion sample, secure faces, stable-ID retries and the original solver.
Move repeated vector clones out of per-frame pose loops. Atlas/merged geometry
or instancing can reduce the approximately 420 draw calls per populated 20d20
frame, but require dedicated visual checks for frosted transparency, face numbering,
d4 corner numerals, shadows, overlapping lanes and both themes. Cache reuse alone
does not reduce that draw-call count.

## Long-session memory and slowdown

The full probe lasted 398 seconds and included 15 additional single-die rolls,
a fresh active clear, five preview/audio cycles and repeated PiP open/close.
Forced GC occurred outside timing windows. Compact history intentionally grows;
clearing the tray intentionally leaves history intact.

| Point | CDP JS heap | History rows | Live main-roll buffer delta |
| --- | ---: | ---: | ---: |
| Before repeat cycles | 8.344 MiB | 5 | 0 |
| After 5 more rolls | 8.497 MiB | 10 | 0 |
| After 10 more rolls | 8.566 MiB | 15 | 0 |
| After 15 more rolls | 8.670 MiB | 20 | 0 |
| After active clear | 8.658 MiB | 21 | 0 |
| After final PiP close | 8.696 MiB | 21 | 0 |

Before preview cycles, create-minus-delete texture count returned to the same five
renderer-internal textures; buffers returned to zero. Five preview cycles released
five WebGL contexts; their internal placeholder textures need not individually
call delete after whole-context loss. The main context stayed active, and all five
AudioContexts closed. PiP-close heap readings included one transient 8.859 MiB
point that returned to 8.696 MiB on the next cycle. Documents remained two.

The initial five-cycle preview observation was followed up in a separate browser
with **no page instrumentation**. After warming the preview once:

| Point | Post-GC JS heap | DOM nodes | Native WebGL contexts | Native texture objects |
| --- | ---: | ---: | ---: | ---: |
| Warmed baseline | 5.366 MiB | 437 | 2 | 10 |
| After 10 cycles | 6.406 MiB | 497 | — | — |
| After 20 cycles | 6.713 MiB | 557 | — | — |
| After 30 cycles | 6.990 MiB | 617 | 32 | 190 |

Each repeated preview retained six additional DOM nodes; event listeners remained
664. Snapshot context count increased by exactly 30, as did lost-context extension
and program objects. This is retained native/JS state after disposal and GC, rather
than history growth. The preview currently calls `renderer.dispose()` and
`renderer.forceContextLoss()`, so adding those already-present calls would not fix
this signal. Native texture wrapper counts do not measure allocated GPU memory after
context loss. The follow-up strong-retainer-path probe identified the shared Three.js lookup
texture as the owner; this is not a Playwright DOM-handle retention artifact.

The retainer probe found the same growth after ten cycles and a further 15 seconds
idle. Its shortest strong path was:

`module scope → DFG_LUT DataTexture → source/cache entry → WebGLTexture → retired WebGL2 context`

This maps directly to the installed `three@0.186.1` source:

- `src/renderers/shaders/DFGLUTData.js:31`: module-global lookup texture;
- `src/renderers/WebGLRenderer.js:2745`: physical-material uniforms use that texture;
- `src/renderers/webgl/WebGLTextures.js:719`: texture disposal listener captures the
  per-renderer texture manager, whose cache holds the native texture/context;
- `src/renderers/WebGLRenderer.js:1086`: renderer disposal clears several managers
  but does not dispose this shared lookup texture's per-renderer registrations.

The diagnostic found six `dispose` listeners on the shared lookup after an initial
preview plus five more cycles. Disposing **only that lookup in the disposable
browser** reduced native contexts from **7 to 1**, texture objects from **40 to 4**,
and DOM nodes to **431**. Both before/after heaps came from the same browser; the
probe exited zero with no page errors. This confirms the retained ownership path.
Raw/sanitized diagnostic evidence:
`test-artifacts/frontend-performance-8f9bcb0/lookup-diagnostic.json`.

Recommended correction: clean up the renderer-owned lookup allocation/registration,
or give each renderer an explicitly disposed lookup texture with identical data.
A small pinned dependency patch is an option to assess; a broad upgrade is not
necessary to state the fix. Retaining one paused preview renderer across dialog
opens can bound this particular symptom, but would not address other renderer
remounts in embeds, room changes or hidden-3D toggles. Those paths share cleanup
mechanisms and need targeted validation; their growth was not measured here.
**Do not ship the diagnostic's global lookup disposal on every close**: it also
invalidates the lookup in a still-active main tray and other renderers. Keep the
16×16 lookup data and the original physical/frosted appearance.

Known bounded retention: UI history is capped at 100 rows, room browser history at
1,000 / global history at 10,000 with 30-day TTL, delivery IDs at 5,000 and audio
IDs at 512. Motion lanes expire after the existing lifetime. Latest server-query
motion and the worker's one prepared path may remain available intentionally;
that is different from keeping every old displayed trajectory.

Two implementation risks deserve targeted fixes:

- `web/site/storage.ts` closes IndexedDB only after successful operations. A rejected
  read/transaction bypasses `db.close()`. Use `try/finally` for acquired connections;
  this is a cleanup gap in exception paths, not a measured normal-session leak.
- The programmatic controller in `lib/client.ts` keeps up to 1,000 retry requests,
  including prepared motion and accepted motion. That bound can retain a large
  amount of recording data in long-running **SDK clients**. The website calls its
  own submission route and uses an observing controller, so this is not the cause
  of website heap readings above. Consider an explicit byte/age policy with stable
  retry and return-value semantics; do not simply discard IDs or motion arbitrarily.

Eight sequential operations per fixture used the actual transpiled storage module,
real IndexedDB and isolated browser contexts. Fixture entries were valid compact
2-die results; the target room had at most 1,000 entries, with remaining rows in
other rooms. No application/backend session was created.

| Global rows at start | Median room load | Median save | Max load / save |
| --- | ---: | ---: | ---: |
| 0 | 0.3 ms | 0.5 ms | 0.4 / 1.1 ms |
| 1,000 | 7.6 ms | 9.0 ms | 11.2 / 9.8 ms |
| 10,000 | 70.4 ms | 78.8 ms | 94.0 / 90.0 ms |

The room load returned only 1,000 rows in both populated fixtures, yet global
10,000-row load/save times increased markedly. Larger dice results can have larger
row payloads. These are total async operation durations, including storage work,
not an assertion that the main thread was blocked for the whole interval.

The browser history write opens the DB, reads every global row, validates and sorts
it, then writes/prunes; room loads also scan every room. This creates growing work
with retained history even when memory is not leaking. Add room/time indexes,
serialize same-instance writes, perform bounded pruning and close in `finally`.
Preserve all existing history limits, fallbacks and concurrent-window behavior;
upgrade browser storage without deleting the user's retained history.

## Coordinating the larger dice and collision work

The current resting-scene code skips settled dice from the same owner; independent
moving rolls replay immutable recorded trajectories. These are product/physics
boundaries, not performance defects to remove silently. POWERROLLER owns the
requested size/collision investigation. Its narrow settled-collision fix and any
future shared-scene revision/replanning protocol should remain explicit work.

At report close, POWERROLLER reported that the 0.7475 hull failed the existing
8-second settle bound for 20d20+d4 with seeds 1–8; its correction and final SHA were
still pending. Those are owner-reported checks, not runs from this investigation.
Do not treat the changed planner as validated, or mask those failures by weakening
settle criteria, dropping dice or changing semantic results in a performance slice.

Port performance changes over the eventual accepted size/hull/collision revision,
then measure planner cost again using its real obstacles, overlap policy and final
scale. A warm-up cache key must include the complete scene revision/obstacles and
dice configuration; a new collision policy cannot reuse stale recordings. Coalesce
obsolete preparations without changing accepted faces or replacing already-authorized
motion independently. Resource cleanup and immutable texture caching can be prepared
separately, since they do not alter collision authority or the scene protocol.

## Ordered implementation slices and checks

| Order | Change | Evidence of success |
| --- | --- | --- |
| 1 | Fix renderer-owned lookup disposal and preview lifetime | 30 preview opens/closes plateau in contexts/nodes/post-GC heap; main tray remains correct; room/hidden/embed remounts are checked |
| 2 | Shared immutable graphics assets with bounded ownership; warm shader paths if traces justify it | Repeated 20d20 avoids rebuilding identical images/geometry; long-task and active-frame tails improve; removal/style change never invalidates another lane; memory plateaus |
| 3 | Coalesce obsolete warm-up work; actual-throw priority | Count changes leave at most one running/latest pending warm request; immediate Roll uses final configuration; no additional logical or cosmetic failures |
| 4 | Shared main/PiP build graph | First PiP avoids the duplicated worker/Three/fonts/CSS bytes; both routes, independent embeds, reloads and themes work |
| 5 | Deadline-driven UI updates; stable log subtree/layout effects | No four-per-second whole-room render while idle; cooldown, presence expiry, result reveal/fade, accessibility and resume still fire correctly |
| 6 | Indexed browser history and exception cleanup | Fixture load/write tails no longer scale with global room count; 1k/10k/TTL retention and simultaneous window writes preserved |
| 7 | Scratch-vector reuse and geometry batching after trace evidence | Per-frame allocation and draw calls improve without changing numbering, transparency, outlines, clacks, physics or motion samples |

The earlier Convex optimization plan covers compact motion subscriptions and receipt
writes, which can also reduce frontend deserialization/GC. Keep the backend contract
and frontend resource work separately reviewable. Do not remove the opener's live
tray, lower graphics quality, change FPS/sample limits, remove themes or cut fonts.

Use the existing overlap, stock/bonus dice, clear/retry, hidden-3D, profile, theme,
audio and PiP journeys for concrete affected regressions. Run focused measurements
on the same viewport/cache/GPU conditions and then physical phone/Safari for real
GPU frame pacing. Numeric targets should be chosen against those device baselines.
An hour-scale soak and browser background/foreground/reconnect journey remain
appropriate later validation; the bounded results here do not prove those scenarios.

## Reproduction and primary references

```sh
# Serve the existing production build on the dedicated backend; never ambient key.
env -u CONVEX_DEPLOY_KEY VITE_CONVEX_URL=https://nautical-partridge-636.convex.cloud \
  node scripts/build-site.mjs
node_modules/.bin/vite preview --host 127.0.0.1 --port 9610 --strictPort
# Coordinator-run probes; keep output outside Git.
URL=http://127.0.0.1:9610/powerroller/ OUT=/tmp/frontend-full.json node scripts/profile-frontend.mjs
THROTTLE=1 STARTUP_ONLY=1 URL=http://127.0.0.1:9610/powerroller/ OUT=/tmp/frontend-startup.json node scripts/profile-frontend.mjs
RUNS=1 TIMING_ONLY=1 URL=http://127.0.0.1:9610/powerroller/ OUT=/tmp/frontend-timing.json node scripts/profile-frontend.mjs
URL=http://127.0.0.1:9610/powerroller/ OUT=/tmp/frontend-lifecycle.json node scripts/profile-lifecycle.mjs
OUT=/tmp/frontend-storage.json node scripts/profile-storage.mjs
```

- [Earlier startup study](startup-performance.md): distinct prior comparison.
- [Three.js disposal guide](https://threejs.org/manual/pages/how-to-dispose-of-objects.html):
  dispose GPU resources explicitly; some renderer-internal cached resources are expected.
- [Chrome memory investigation](https://developer.chrome.com/docs/devtools/memory-problems):
  inspect post-GC retention and detached-object behavior rather than transient peaks.
- [MDN heap-counter limits](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory):
  the Chromium legacy counter may omit workers/GPU and does not prove total app memory.
