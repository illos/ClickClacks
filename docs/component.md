# Install the collaborative backend

Powerroller's backend is an isolated Convex component. Its tables, cleanup cron,
original demo functions and current participant tracks live in `component/`.
The repository's `convex/` directory contains app-facing forwarders. It has no
roller tables. This uses Convex 1.45.0; npm publication is deferred.

Use a versioned repository checkout or package artifact in your application. The
package entry `powerroller/convex.config.js` installs the component:

```ts
// Your app's convex/convex.config.ts
import { defineApp } from 'convex/server';
import powerroller from 'powerroller/convex.config.js';
const app = defineApp();
app.use(powerroller);
export default app;
```

Run your app's normal Convex code generation against your own development
project. The package does not select a deployment or contain a deploy key.
`components.powerroller` then provides the typed component function references.
[Example installation](../examples/convex/convex.config.ts) and
[example query wrapper](../examples/convex/rooms.ts) show the boundary.
The repository's `convex/diceDemo.ts`, `diceDemoV2.ts` and `cleanup.ts` are the
complete guest-site wrapper example; retain their function names if using the
provided controller transport.

A wrapper calls the component through `ctx.runQuery`, `ctx.runMutation` or
`ctx.runAction`. Host applications choose which wrappers are public and enforce
host authorization before forwarding. The guest site uses a public UUID plus a
separate private credential. Never substitute a public participant ID for that
credential, return credentials in room state, or expose the trusted
`acceptSupplied`, `recordSample`, `setPolicy` and cleanup operations as public
browser mutations. Component functions are callable by the installing app;
component-public does not mean browser-public.

## Authoritative generation and headless operation

1. Join through `diceDemoV2.join` with room key/code, public viewer ID, private
   credential, name, appearance and clock readiness.
2. Call `diceDemo.sampleFaces` with those session fields, a stable UUID `id`, and
   `dice: {kind:'dice',sides:6,count:3}` (or `{kind:'power',sides:10,count:2}`).
3. Submit the returned faces and the same ID/configuration to
   `diceDemoV2.throwDice`. Motion is optional. Headless callers do not need
   graphics readiness, Three.js, a canvas or a worker.
4. Read current tracks or the authenticated `diceDemoV2.events` cursor stream.
   Expose text at `revealAt`; a viewer's cosmetic callback never determines that
   timestamp. The controller handles timers, catch-up and deduplication.

Sampling binds server-generated faces to the request. Retrying returns the
original result; changing faces, configuration or modifiers is rejected after
acceptance. Presentation is cosmetic and the first accepted presentation wins.
Results are labelled `generated` or `supplied`.

The default room lasts 24 hours, permits eight active participants and at most
2,000 sampling requests, with a 250 ms per-member sampling interval. Semantic
receipts last one hour or until room expiry. Expired receipts become tombstones
until room expiry; retrying an expired ID fails rather than generating again.
Current tracks survive receipt expiry until replaced, cleared or the room expires.
Catch-up pages contain at most 20 compact results without recorded motion.
`CURSOR_EXPIRED` requires restoring current tracks and resuming at `view.cursor`;
expired history cannot be recovered from the component. Clearing retains the
original shared-clear policy: any participant clears everyone's current trays.
It does not delete semantic receipts. Leaving removes only one's own presence,
private session and current track; archived accepted results remain.

Host-only `setPolicy` can configure bounded capacity, room lifetime, receipt
lifetime, request count and sampling interval. Changing `ttlMs` sets room expiry
relative to its creation time. This is a limit configuration, not a scaling
promise. An indexed, bounded cleanup cron removes expired rooms, sessions and
tracks and compacts expired receipts, scheduling continuations when necessary.

## Existing results and custom interpretation

For host-authorized persisted supplied faces, call
`components.powerroller.diceDemoV2.acceptSupplied` from an internal wrapper or a
public wrapper that first enforces your actual authenticated permissions. Pass
its required session fields and stable ID. It uses the same accepted record,
shared timing, retry protection and built-in interpretation as the generated path.
The community app's corresponding wrapper is internal.

Custom interpretation does not require a backend or a source fork. Use
`powerroller/dice` to resolve your already-authoritative values, or supply your
own interpretation. Your host owns that interpretation and log. Present the
same values with the optional original imperative tray:

```ts
import { expandDice, resolvePool } from 'powerroller/dice';
import { describePool } from 'powerroller/format';
const request = expandDice([{sides:6,count:4,id:'ability'}]);
const result = resolvePool(request, [6,4,3,1], {
  keep:{mode:'highest',count:3}, modifier:2,
});
const text = describePool(result, 'My ability');
// Host log receives plain strings and structured kept/discarded dice.
// No random generation, renderer, browser storage or Convex call is involved.
```

For graphics, `createRoomTray` takes a host element, failure callback and cosmetic
completion callback. Call `participants(...)`, then `play(acceptedRoll,
{offset,uncertainty})`; accepted faces and matching recorded motion belong to the
host. Use `createThrowPlanner()` for optional motion and dispose both instances.
The completion callback is presentation telemetry, not authority or availability.
See the non-React example for controller/tray integration.

## Current boundaries

The collaborative endpoint supports homogeneous stock d4/d6/d8/d10/d12/d20
pools of 1–20 base dice and the original tiered 2d10 power roll. Generic edge/bane
fields are stages 0–2 selecting values 0, 2 and 5. The modifier is the bonus
value minus the penalty value; equal stages cancel and stages 2/1 yield +3.
Generic d6–d20 configurations can set `bonusD4:true` to append one d4;
`count` remains the base dice count, and faces/motion put the d4 last.
The optional flag is forbidden for power rolls and base d4.
Generic results do not produce a tier. It does not persist general mixed
pools, keep/drop choices, percentile interpretations, custom totals or the other
Draw Steel presets. Those are available as pure host-side operations where
implemented; adding shared interpretation requires a trusted host integration.
The original motion frames are retained, with packed Float64 data for large pools
and explicit version 1. Missing versions mean legacy v1. New unsupported versions
are rejected before attachment; replay of an unavailable version falls back to
semantic/text results without rejecting an already accepted roll. Compact receipts
and events contain no motion. A separate per-request presentation record restores
the original known motion on retry after clearing or replacement, and expires
independently at the receipt retention deadline.

Legacy `diceDemo:throwDice` remains the original supplied-face V1 presentation
experiment in a separate table. Use V2 for authoritative collaborative generation.
Do not treat legacy V1 as the generated-results API.

For tests, register the component's schema and modules under `powerroller` with
`convex-test`, then exercise your app wrappers. This repository's
`tests/app/fixtures/table.ts` is the complete example. Generated bindings are
created locally during code generation and excluded from version control.
