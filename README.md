# Click Clacks

**Roll together, wherever your table is.** Click Clacks is a free, open source
3D dice roller for tabletop games, with dedicated Draw Steel power rolls.
Share a table link, customize your dice, and see each other's rolls and results
in real time. [Convex](https://www.convex.dev/) powers the shared tables and
keeps connected players in sync.

You can use the hosted roller, run your own site, or build dice rolling into
another app with the TypeScript library and reusable Convex component.

[Website](https://clickclacks.app) · [Live roller](https://dice.clickclacks.app) · [Source](https://github.com/illos/ClickClacks)

[Features](#what-you-can-do) · [Run locally](#run-locally) ·
[Contribute](#contribute) · [Embed](#embed-without-adopting-the-site)

## What you can do

- **Roll the dice you need.** Choose d4, d6, d8, d10, d12 or d20 pools of
  1–20 dice, or a percentile pair for d100. Add a bonus d4 to d6–d20 and
  percentile rolls, and adjust generic bonuses and penalties.
- **Make Draw Steel power rolls.** Roll 2d10 with Edge/Bane controls and tiered
  results. The reusable library also offers Draw Steel interpretation helpers.
- **Share a table.** Invite friends with a link or short table code. See who
  is present, their dice designs, and their rolls in the log.
- **Make the dice yours.** Choose body and ink colors, patterns and fonts,
  with a live customization preview and saved browser preferences.
- **Enjoy the clacks.** Watch 3D dice bounce and settle with recorded physics
  and sound. Mute audio or choose reduced motion, text and contrast preferences.
- **Keep the tray nearby.** On supported desktop browsers, open a floating
  picture-in-picture tray with roll controls and the six latest rolls.
- **Match your workspace.** Choose System, Light or Dark appearance; the main
  page and floating tray share your preference.
- **Build on it.** Use pure dice helpers, a renderer-free room controller,
  optional React/Three.js presentation, or the same shared backend from a CLI.

## Try your first shared table

1. Open the [live roller](https://dice.clickclacks.app/).
2. Choose dice using the picker beside **Roll**, then make a roll.
3. Open **Sharing** and copy the table link or code. Friends can open the link
   directly or enter the code in their own Sharing menu.
4. Customize your name and dice so everyone can recognize your rolls.

The hosted site uses guest sessions, so you can join without creating an account.
Default tables last 24 hours and support eight active participants. Accepted
roll history is retained by the backend for one hour. Clearing the tray clears
everyone's current dice; it does not erase the backend's accepted-roll receipts.

## How Convex powers real-time collaboration

The frontend uses [Convex reactive queries](https://docs.convex.dev/realtime)
to subscribe to table membership and each player's roll track. When stored state
changes, Convex updates connected clients automatically. This lets players see
new rolls, profile changes and shared clears without refreshing the page or
building a separate WebSocket server.

A shared roll follows this path:

1. **Request.** The controller sends the dice configuration, guest credential
   and a stable request ID to the Convex backend.
2. **Generate and accept.** The server generates the faces and binds them to
   that request. The client can prepare cosmetic motion, then submits the roll
   for server validation and persistence. Retrying the same request reuses its
   faces rather than rolling again.
3. **Share.** Reactive subscriptions deliver the accepted result and recorded
   motion to the table. Each participant has a separate track, so their throws
   can be observed independently.
4. **Reveal.** Clients use the shared server timestamp to coordinate when the
   result enters the log. Graphics display the accepted faces; animation
   completion does not decide the result. Text and headless clients use the
   same result lifecycle.

The backend lives in an isolated [Convex component](https://docs.convex.dev/components/overview),
with its own room, session, request and presentation tables plus scheduled
cleanup. The `convex/` directory exposes the site's public wrappers; `component/`
contains the reusable backend. Host apps can install it into their own Convex
project and enforce their own access policy at the wrapper boundary.

Table links and codes grant read access. Each guest has a public viewer ID for
attribution and a separate private credential for writes. Credentials are not
included in shared room views or roll records. See [backend integration](docs/component.md)
for the function flow and access boundaries.

## Run locally

You'll need **Node 24.18.0**, **pnpm 11.5.3**, Git, and your own Convex
development project. The repository pins **Convex 1.45.0**.

Fork the repository if you plan to contribute, then clone your fork (or clone
the upstream repository to explore):

```sh
git clone https://github.com/illos/ClickClacks.git
cd ClickClacks
pnpm install --frozen-lockfile
cp .env.example .env.local
env -u CONVEX_DEPLOY_KEY pnpm exec convex dev
```

Follow the Convex prompts to create or select your development project. Leave
that process running to sync backend changes and generate the ignored app and
component bindings. Clearing an ambient `CONVEX_DEPLOY_KEY` ensures it does not
silently select an unrelated deployment; on Windows, remove that variable from
your shell before running `pnpm exec convex dev`.

Set `VITE_CONVEX_URL` in `.env.local` to your project's public deployment URL:

```dotenv
VITE_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud
```

In a second terminal, start the frontend:

```sh
pnpm dev
```

Open [localhost:9591/powerroller/](http://localhost:9591/powerroller/).
The `/powerroller/` path is retained for compatibility. The frontend connects
directly to the Convex URL you configured. Deployment keys are server secrets
and must never be placed in `VITE_*` variables.

## Find your way around

The stack is TypeScript, React, Vite, Three.js, cannon-es and Convex.

| Directory | Start here for |
| --- | --- |
| [`lib/`](lib/) | Public dice, Draw Steel, controller, React and graphics entry points. |
| [`shared/`](shared/) | Dice configurations, result contracts and shared interpretation. |
| [`component/`](component/) | Convex schema, roll authority, sessions and cleanup. |
| [`convex/`](convex/) | App-facing wrappers and component installation. |
| [`web/`](web/) | Roller UI, 3D presentation, customization, floating tray and landing page. |
| [`scripts/`](scripts/) | Headless CLI and build tooling. |
| [`examples/`](examples/) | Plain TypeScript embedding and Convex integration examples. |
| [`tests/`](tests/) | Focused library, controller and backend regression tests. |

## Contribute

Bug reports, documentation improvements and focused pull requests are welcome.
Use [GitHub issues](https://github.com/illos/ClickClacks/issues) to describe a
problem or discuss a larger change before building it. For bugs, include how to
reproduce the issue, the expected result, and your browser/device when relevant.

Create a branch in your fork, make the change, and open a pull request explaining
what it fixes and how you checked it. Once Convex has generated the bindings,
the repository's checks are:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Keep fixes small and add a focused regression test when it catches a concrete
failure. Preserve server-authoritative results and the existing UI/physics
behavior. Draw Steel helpers retain their source citations; rule changes need
source-backed expectations. Keep generated bindings, `dist/`, credentials and
local session files out of commits.

For deeper context, see the [API coverage](docs/api-coverage.md),
[version-one plan](docs/v1-readiness-plan.md) and
[implementation record](docs/v1-implementation.md). These distinguish implemented
capabilities from proposed work.

## Host your own site

Build and deploy the frontend against your own Convex backend. GitHub Pages
uses the repository's [Actions workflow](.github/workflows/pages.yml) and the
repository variable `VITE_CONVEX_URL`. The default asset base is `/powerroller/`;
set `CLICKCLACKS_BASE` with a trailing slash for another hosting path. The legacy
`POWERROLLER_BASE` variable is also accepted.

Deploy the whole `dist/` directory, which includes shared main/tray assets and
the legacy `dist/pip/` document alias. Publish matching backend functions before
a frontend that requires them. The live Cloudflare roller uses
`pnpm build:cloudflare` to build at `/`; see the
[Cloudflare hosting guide](docs/cloudflare-hosting.md) for configuration.

## Embed without adopting the site

npm publication is deferred. Install a **pinned Git revision or local source
checkout** into a TypeScript application using a bundler such as Vite:

```sh
pnpm add 'clickclacks@git+https://github.com/illos/ClickClacks.git#COMMIT'
```

Replace `COMMIT` with the revision you reviewed. The package exports TypeScript
source; a raw JavaScript-only consumer needs to compile it first. A Vite consumer
should include `vite/client` types and the `DOM.Iterable` TypeScript library for
font assets. Node's native TypeScript runner does not load TypeScript packages
from `node_modules`; use a bundler for these source exports.

Generated Convex bindings are deliberately absent from Git. To distribute a local
backend component artifact, generate bindings during your Convex setup, then run
`pnpm pack` and install the resulting `.tgz` into the consumer. The package includes
the generated component bindings without committing them. A Git-only installation
needs component codegen before using `clickclacks/_generated/component.js`.

| Import | Purpose |
| --- | --- |
| `clickclacks/dice` | Bounded generation, mixed pools, supplied values, keep/drop and percentiles. |
| `clickclacks/draw-steel` | Cited Draw Steel resolution helpers and presets. |
| `clickclacks/format` | Plain semantic descriptions. |
| `clickclacks/client` | Instance-owned room controller and an explicit Convex transport. |
| `clickclacks/three` | Optional 3D tray, fonts, physics utilities and isolated planners. |
| `clickclacks/react` | The roller interface as a mountable `ClickClacks` component. |
| `clickclacks/styles.css` | Explicit opt-in styles for that interface. |
| `clickclacks/convex.config.js` | Isolated backend component installation. |

Core arithmetic and controller imports do not load React, Three.js or application
CSS. Importing a module does not mount a tray, join a room or change browser URLs.
Hosts own configuration, controls, identity, names, storage and logs.

A renderer-free room controller:

```ts
import { createController, convexTransport } from 'clickclacks/client';

const controller = createController({
  transport: convexTransport(myConvexUrl),
  key: myRoomCode,
  identity: myPrivateSessionProvider(), // {viewer, credential}
  profile: {
    name: 'River',
    style: {color:'#70dac3',ink:'#fff4e5',pattern:'solid',font:'serif'},
  },
});
controller.on('available', roll => {
  myLog(roll); // authoritative faces, total, source and shared revealAt
  if (!roll.historical) myAnnouncement(roll);
});
await controller.join();
await controller.roll({id:crypto.randomUUID(),dice:{kind:'dice',sides:6,count:3}});

// Keep the controller alive to receive this and other players' results.
// When the host session ends, leave the table and dispose the controller.
```

Preserve the same `id`, dice and modifiers when retrying an uncertain request.
Sampling is server-owned and bound to that request; acceptance cannot replace its
faces. `roll(input, prepare?)` optionally prepares cosmetic motion. A failed
presentation provider leaves the sampled logical roll usable. `available` uses
the server's reveal timestamp, never a graphics callback.

The controller also exposes `profile`, `clear`, `leave`, `catchup`, `clock` and
`clockEstimate`. `accepted` announces acceptance; `track` carries the latest
presentation per owner, including full motion when a compact history event
arrived first. `room`, `clear`, `status` and `error` support custom controls.
Historical catch-up remains readable and is marked `historical: true` once its
reveal time has passed. `observe()` subscribes to membership your host already
manages: it does not join, heartbeat or leave that membership. Dispose removes
instance timers/subscriptions; call `leave()` separately to retire a membership.

[The plain example](examples/plain/main.ts) combines the public controller,
arithmetic and imperative tray without React or site CSS. A host must supply its
own endpoint and session. For 3D, load the exported fonts before creating the
tray, use one `createThrowPlanner()` per mounted instance and dispose it with the
tray. Cosmetic completion callbacks are telemetry, not result delivery.

## Install the backend in an existing Convex app

Use Convex **1.45.0** for this revision and mount the isolated component:

```ts
// Your app's convex/convex.config.ts
import { defineApp } from 'convex/server';
import clickclacks from 'clickclacks/convex.config.js';
const app = defineApp();
app.use(clickclacks);
export default app;
```

Run your app's Convex code generation. `components.clickclacks` exposes the typed
component functions. Your app owns thin public wrappers and actual access policy;
the repository's `convex/diceDemo.ts` and `convex/diceDemoV2.ts` show the complete
community-site forwarding surface. Retain those function names for the standard
transport, or supply a `Transport` with `call` and `watch` to map your own names.

See [component setup, policies, wrappers and trusted supplied results](docs/component.md).
Do not expose trusted supplied-face or policy operations as unrestricted browser
mutations. A participant's public viewer ID is attribution; its separate private
credential authorizes its writes. Room codes are shared read capabilities. Room
views and roll records do not disclose private credentials.

## Headless CLI

Run the CLI from the repository checkout. It uses the same controller and app
endpoints. Node 24 executes its TypeScript source directly; no separate runner or
browser is required.

```sh
pnpm cli create --backend https://YOUR.convex.cloud --session /tmp/my-roller.json --name River
pnpm cli join --backend https://YOUR.convex.cloud --session /tmp/my-roller.json --key ABCDEFGH
pnpm cli roll --backend https://YOUR.convex.cloud --session /tmp/my-roller.json --dice 6 --count 3 --edges 1 --id UNIQUE_REQUEST_ID
pnpm cli view --backend https://YOUR.convex.cloud --session /tmp/my-roller.json
pnpm cli events --backend https://YOUR.convex.cloud --session /tmp/my-roller.json --after 0
pnpm cli profile --backend https://YOUR.convex.cloud --session /tmp/my-roller.json --name River
pnpm cli clear --backend https://YOUR.convex.cloud --session /tmp/my-roller.json
pnpm cli leave --backend https://YOUR.convex.cloud --session /tmp/my-roller.json
```

The session file contains a private credential and is written with mode `0600`.
Keep it outside a repository. Credentials are not printed. Roll output includes
accepted data and persisted track readback; clear output also reads back state.
Add `--bonus-d4 true` to include the extra d4 in generic d6–d20 or percentile
CLI rolls. Use `--dice 100` (or `--dice percentile`) for the fixed d10 pair;
`--count`, if supplied, must be 2. The first raw face is tens, the second units.
Raw 10 prints zero, and double zero resolves to 100 before adding d4/modifiers.

Use the same explicit `--id` to retry an uncertain roll. Leave removes membership
and the session file. Use a separate file for another backend or participant.

## Scope and practical limits

- The collaborative backend supports the original power roll and homogeneous
  d4/d6/d8/d10/d12/d20 pools of **1–20** dice. Its d10 is the selected diamond model;
  the power-roll model remains the accepted logical d10. A fixed percentile pair
  uses that same original model, with 00–90 tens and 0–9 units (double zero = 100).
  Generic d6–d20 and percentile pools may
  add one bonus d4 (up to 21 total dice). These all have recorded
  physics. This bound is not a performance guarantee on every device.
- General mixed pools, keep/drop and additional Draw Steel presets are pure
  host-side capabilities. They are **not** automatic shared interpretations in
  the community backend. Custom persisted interpretation needs a trusted wrapper.
- Default rooms last **24 hours**, with **8 active participants**, **2,000**
  sampling requests and a **250 ms** per-member sampling interval. Semantic
  receipts last **1 hour**, becoming retry tombstones until room expiry. Clearing
  does not remove retry protection. Leaving removes one's current presence/track,
  while archived accepted results survive.
- Catch-up pages hold at most **20** compact results. Expired cursors restore
  current tracks and resume at the authoritative room cursor; missing expired
  history cannot be reconstructed. Recorded paths are packed losslessly when
  needed to stay within Convex's array limits.
- Browser preferences and observed history are site-owned, bounded and
  origin-specific. Unavailable storage falls back to memory. The library does not
  secretly persist a host's session or rewrite its navigation.
- Sound is on by default; the sound button saves your preference, including mute.
  Embedded hosts can supply their own sound preference. Clacks follow recorded
  bounce timing; reduced/hidden motion uses a result-reveal clack.
- Local motion/text/contrast preferences affect presentation. Shared result
  availability stays aligned with the common reveal timestamp. Real-device
  timing and actual VoiceOver/NVDA checks remain separate manual evidence; this
  repository does not claim WCAG conformance from automated tests alone.

## Compatibility for existing integrations

The source package and new component installations use `clickclacks`; the React
entry exports `ClickClacks` and retains `PowerRoller`/`PowerRollerOptions` aliases.
Existing consumers may install the source under an explicit dependency alias,
for example `pnpm add 'powerroller@git+https://github.com/illos/ClickClacks.git#COMMIT'`.
The community backend deliberately keeps its installed `powerroller` component
namespace, and browser preferences, identities, channels and history keep their
existing storage keys. The default Pages path remains `/powerroller/`; new
builds accept `CLICKCLACKS_BASE` for another hosting path.

### Graphics embedding and the pinned Three patch

The standalone app applies the renderer-ownership fix through its root pnpm patch
configuration. That configuration is not transitive dependency metadata. Hosts
using the optional `clickclacks/three` or React 3D tray must register the same
Three 0.186.1 patch in their own repository to receive the lifecycle fix. Pure
semantic SDK and backend consumers do not create WebGL renderers.

After installing the source package, copy its included patch into your host project:

```sh
mkdir -p patches
cp node_modules/clickclacks/patches/three@0.186.1.patch patches/three@0.186.1.patch
```

Register it in the host's root `pnpm-workspace.yaml` (merge with existing entries):

```yaml
patchedDependencies:
  'three@0.186.1': 'patches/three@0.186.1.patch'
```

Run `pnpm install` and commit the copied patch, configuration and updated lockfile
before using frozen installs in CI. If you installed under a dependency alias,
use that alias in the copy path. Keep the patch in your repository rather than
referencing `node_modules`, which is absent at the start of a clean install.
See [pnpm patch registration](https://pnpm.io/cli/patch) and
[the patch's ownership notes](patches/README.md).

## License and credits

Click Clacks code is released under the [MIT license](LICENSE).
Dependencies keep their own licenses. Eczar, Sora, Caesar Dressing and New Rocker
font subsets retain OFL notices in `web/dice-demo/fonts/`; builds ship
`dice-font-licenses.txt`. Recorded audio comes from
[Gliz Caldo's Dice Roll Sound Effects](https://www.youtube.com/watch?v=F4Kxnv3Hzmk),
used with the creator's permission; see the [audio credits](web/dice-demo-v2/audio/README.md).

The roller originated in Salient and became a standalone project.
The [extraction record](docs/extraction.md) documents its source baseline and
initial publication. Draw Steel helpers retain their rules citations; no game
artwork, catalogs or reference corpus are distributed, and the corpus is not
required to build or run the project.
