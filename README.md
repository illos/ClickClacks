# Powerroller

A free realtime collaborative dice roller for Draw Steel, with an embeddable TypeScript library.

**Community site:** https://illos.github.io/powerroller/

The site preserves the compact shared tray and log, approved dice palette, four materials and four
numeral fonts. Participants have equal access and can clear their own dice. Supported animated launch
models are d3, d4, d6, d10 and percentile d100 (two d10). General logical dice, mixed pools, modifiers,
keep highest/lowest, power rolls, saves, opposed/project totals and combat opening are supported.
The roller reports dice results; it does not automate character abilities or combat effects.

## Run your own site

Use Node **24.18.0** and pnpm **11.5.3**. Clone this repository; no Salient checkout, catalog or game
reference corpus is needed to build it.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Create your own Convex project, then configure `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` in
`.env.local`. Authenticate with your own Convex account and deploy/codegen:

```sh
pnpm exec convex dev --once
pnpm dev
```

The site runs at http://localhost:9590/powerroller/. Importing the library has no automatic backend
URL fallback. Supply your own endpoint. Never put a Convex deployment key in the Vite environment,
frontend source or GitHub Pages bundle. The public Convex URL is configuration, not a secret.

To publish a fork on GitHub Pages, enable **Settings → Pages → GitHub Actions**, set the repository
Actions variable `VITE_CONVEX_URL` to your deployment's public URL, and adjust `PAGES_BASE` in
`.github/workflows/pages.yml` to your repository path. A custom domain uses `/`. Push `main` to build
and publish; generated site assets are uploaded as an artifact rather than committed. The workflow
only builds static assets and does not deploy a backend. Configure and publish your backend separately.

## Embed or adapt

npm publication is deferred. Use the repository as a Git/file dependency in a TypeScript-aware
bundler. Public exports are deliberately separate:

| Import                         | Provides                                             | Dependencies loaded                                                  |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `powerroller/dice`             | Validation, generation, resolution, result formatter | Pure TypeScript; no browser globals required for supplied resolution |
| `powerroller/draw-steel`       | Cited Draw Steel interpretations                     | Pure TypeScript                                                      |
| `powerroller/client`           | Instance controller, transport, room/result events   | Convex client; no React or graphics                                  |
| `powerroller/three`            | Imperative tray, models, previews and appearance     | Three.js; no React or global CSS                                     |
| `powerroller/react`            | Optional compact accessible React UI                 | React and Lucide; dynamically loads tray if shown                    |
| `powerroller/styles.css`       | Opt-in scoped default styling                        | Applies within `.powerroller`                                        |
| `powerroller/convex.config.js` | Reusable isolated Convex component                   | Mount in your backend; generate types with Convex                    |

Use the example at [examples/plain](examples/plain/main.ts) to replace React with your own controls,
menus and log while retaining generation, realtime behavior and presentation. It supplies its own
backend and demonstrates mounting a tray directly into a DOM element. No Tailwind is required.

```ts
import { resolveRoll, formatResult } from "powerroller/dice";

// Resolve an existing accepted result without generation or graphics.
const result = resolveRoll(
  {
    requestId: "host-roll-1",
    dice: [{ sides: 10, count: 2 }],
    ruleset: "draw-steel/power",
    modifiers: { characteristic: 3, edges: 1 },
  },
  [7, 8],
);
console.log(formatResult(result, "Morgan", true));
```

```ts
import { createRoller, convexTransport } from "powerroller/client";

const roller = createRoller({ transport: convexTransport(yourConvexUrl) });
roller.on("result.available", (result) => yourLog.append(result));
await roller.join(undefined, {
  name: "Morgan",
  appearance: {
    color: "#42a5ab",
    ink: "#ecf6ff",
    pattern: "solid",
    font: "serif",
  },
});
// Save this request ID if retrying. Changing its meaningful inputs is rejected.
await roller.roll({
  requestId: crypto.randomUUID(),
  dice: [{ sides: 6, count: 3 }],
  ruleset: "sum",
});
// Query/readback and subscribed cursor catch-up deliver the same persisted result.
await roller.clear();
await roller.dispose();
```

The controller emits `result.accepted`, `result.available`, `room`, `clear`, `status` and `error`.
An accepted record contains stable identity, attribution, per-die kept/discarded values, natural and
final totals, interpretation, source (`generated`/`supplied`), and server timestamps. Availability uses
`revealAt`, independently of rendered frames or animation callbacks. Replayed old records carry local
`historical: true` metadata so hosts can avoid announcing old results. Subscribe before making calls.
Multiple instances are isolated; call `dispose()` to release subscriptions and timers.

`createTray(element, { clock, preferences, models, maxAnimatedDice })` returns `present`, `clear`,
`setPreferences` and `dispose`. Pass accepted records with `participantId: record.memberId` and
`style: record.appearance`. Custom `models[sides]` providers can return matching `VisualDie` objects.
The stock graphics budget is32 dice per participant; larger logical requests remain valid and fully
readable in HTML. Unsupported model types also preserve complete text results. Cosmetics never
supply entropy or make rolling depend on WebGL. Changing display preferences only changes that viewer.

## Install the backend component

Mount the component as shown by [convex/convex.config.ts](convex/convex.config.ts), then expose your
own app wrappers. The example wrappers in [convex/rooms.ts](convex/rooms.ts) show the guest policy.
Copy/adapt wrappers as integration code; component tables/functions remain isolated and reusable.
Generated bindings are produced by `convex dev --once` and are ignored by Git.

The site creates random private credentials, kept in sessionStorage. Participant IDs are public and
cannot authorize writes. The backend checks room-scoped credentials, membership, capacity, request
bounds and ownership. Site users cannot call the supplied-result path. A trusted host wrapper may
call `components.powerroller.rooms.acceptSupplied` after enforcing its own identity/permission policy.
Host parent IDs are opaque context values; the component imports no host schema or account system.

Default policy:8 active participants,200 lifetime sessions,24-hour rooms,30-second presence,10-second
heartbeats,one-hour catch-up/receipt window,10,000 events per room. Expired receipts retain request
identity tombstones until room expiry and reject retries instead of generating new values. Roll/clear
operations are throttled250ms. Acceptance schedules a150ms start and2200ms shared reveal. A trusted
component caller can supply bounded room policy options at creation; the public site keeps defaults.
Expired data is cleaned in bounded scheduled batches. This is a modest community-tool policy, not a
promise that increasing limits alone scales rooms indefinitely.

Supported requests are listed by `RollRequest` in [src/dice.ts](src/dice.ts). Logical bounds are100
dice and2–1000 sides. Percentiles use exactly two logical d10 values, tens first; face10 encodes digit0,
and double0 means100. `keep` explicitly retains highest/lowest N values and records dropped values.
Opposed/project presets have their own Edge/Bane semantics. Critical flags require an explicit main
action ability context; the roller never grants a generic combat action. Extend trusted presets in
host integration code rather than transmitting executable callbacks to the server.

## Browser persistence and accessibility

The site alone owns versioned preferences, observed history and routing. Preferences use localStorage;
private active session credentials use sessionStorage; compact observed results use IndexedDB,
partitioned by backend/table and deduplicated by roll ID (1000 records,30 days). Blocked/malformed
storage falls back to memory. Invite URLs take precedence over the saved table. Expired saved tables
offer a new-table action. Local history is not a shared archive of rolls missed while closed.

Menus contain local **Use device setting / Reduce motion / Full animation**, **Hide3D dice**,
**High contrast**, and **All rolls / My rolls / Off** announcement preferences. Complete navigable
HTML results remain available in every mode. Device motion preference is applied before graphics
start. Text-only mode does not load the Three.js chunk. New rolls do not steal focus or force scroll.

Actual VoiceOver/NVDA and real-device verification are listed separately in
[open questions](docs/open-questions.md). Automated checks do not prove spoken delivery or WCAG
conformance. This project does not currently make a conformance claim.

## Validate changes

```sh
pnpm typecheck          # after Convex codegen
pnpm test               # pure core, component persisted readback, controller, storage and models
pnpm build              # static Pages artifact
pnpm exec playwright test # focused site journeys; backend must be deployed
```

Review changed code independently, run checks that catch concrete failures, and record exact results
in [docs/work-log.md](docs/work-log.md). Publication reuses accepted evidence. Do not run broader tests
solely because a deployment or Git commit changed. The browser tests use disposable rooms, not campaign
data. Shared tool versions are pinned above; Playwright is1.63.0.

## License and provenance

Powerroller-owned code is MIT, authorized by its copyright holder. The four digit-font subsets keep
SIL OFL1.1. Dependency and font notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[src/three/fonts](src/three/fonts/README.md). Draw Steel belongs to MCDM. This independent tool ships
no reference corpus, artwork, monster catalog or catalog-derived default names. Mechanics cite source
paths/sections; game content is not included in the MIT license. Salient's own license is unchanged.

Extraction baseline: Salient`23cf9035` with approved V272 visuals; release decisions V273. See the
[extraction plan](docs/extraction-plan.md), [work log](docs/work-log.md) and
[queued questions](docs/open-questions.md). Salient integration is a separate future task.
