# Startup performance

Owner requested reducing navigation-to-enabled-Roll time, preserving the copied
UI and dice behavior. This pass starts from `5336a31`.

## Measured bottlenecks and changes

- The UI waited for seven sequential clock actions: roughly 1.1 seconds after
  the WebSocket opened. Those independent actions now run concurrently. All seven
  samples still complete before readiness, and the original fastest-three clock
  estimator, uncertainty, deadline, retry and visibility invalidation remain.
- Font requests waited for larger renderer modules. Font loading now begins as
  soon as the small font module resolves, alongside the graphics imports. All
  four fonts still load before creating the tray; existing fallbacks remain.
- First naming used a cosmetic server mutation before membership. The site now
  uses its existing nameProvider hook with a literal copy of the same 22-name
  classical pool. Saved names remain preferred; the library's default server
  naming path remains supported. No backend implementation or deployment changes.
- Initial membership now publishes ready state in one mutation after clock sync.
  A readiness change during a pending heartbeat waits for it to finish, avoiding
  a dropped update and ten-second delay. Subsequent reconnects can still publish
  an existing member as unready. Roll waits for acknowledged ready membership.
- A click during startup could retain an old graphics=false closure through the
  server requests. Throw preparation now checks the actual current tray afterward,
  so graphics that finish during those requests participate in the first roll.

No geometry, solver, materials, appearance, identity ownership or stored user
choices were changed. Hidden-3D startup still loads no graphics or physics.

## Controlled before/after

Production builds served compressed from two local ports with the same backend
(`nautical-partridge-636`). Each of three runs used a new Chromium context,
430×932 touch viewport, empty storage/cache, 4× CPU throttling, and HTTP network
throttling of 150 ms latency / 1.6 Mbit/s download / 0.75 Mbit/s upload. The socket
still reached the real dedicated backend; its observed clock RTT was about
150–230 ms. This is a repeatable lab comparison, not a physical iPhone result.

A DOM observer measured the first enabled Roll button from navigation time zero.

| Metric | Before | After |
| --- | ---: | ---: |
| Visit → Roll, run 1 | 2.745 s | 2.146 s |
| Visit → Roll, run 2 | 2.789 s | 2.064 s |
| Visit → Roll, run 3 | 3.008 s | 2.056 s |
| Median | 2.789 s | 2.064 s |

Median improvement: 0.725 seconds, **26%**. Font download starts moved from
roughly 2.26 seconds to 1.49 seconds; this reduces a graphics waterfall rather
than cutting fonts or bypassing rendering.

Initial live GitHub Pages baseline (three fresh contexts): median 1.978 seconds
without throttling; 2.827 seconds with the same mobile throttling. These are
separate observations, not interchangeable with the controlled local comparison.

## Verification and reproduction

Typecheck, production build and three focused clock-sync tests passed. Tests
prove concurrent collection with the same estimator, cancellation on background,
fresh sampling on return, and retries after offline/timed-out batches.

`tests/browser-startup.mjs` clicks on the first enabled DOM update, without
waiting for the load event, fonts or canvas. Persisted backend readback proved
that the first full-3D roll includes its original recorded motion and reaches
history. Hidden-3D startup accepted a roll without motion or graphics/font/worker
requests. Both produced no page errors. Full-3D immediate click: 2.093 seconds
in that separate journey; hidden-3D: 2.316 seconds (different network samples).

To collect timings from a production build or hosted URL:

```sh
URL=https://illos.github.io/powerroller/ RUNS=3 THROTTLE=1 \
  OUT=/tmp/powerroller-startup.json node scripts/measure-startup.mjs
```

Omit THROTTLE for an unthrottled run. The script records resource timings and
RPC names/timestamps, without session credentials or RPC argument contents.
Raw timing artifacts stay outside Git. Browser performance remains dependent
on connection latency, browser cache and device speed; this does not prove
physical iPhone Safari timing or animation performance.
