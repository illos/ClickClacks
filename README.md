# Click Clacks

Click Clacks is an open source dice roller for tabletop games. It supports
3D dice, shared tables, and Draw Steel power rolls. [Convex](https://www.convex.dev/)
stores shared table state and sends roll updates to connected players.

The project includes a hosted web app, a TypeScript library, and a Convex backend
component for use in other applications.

[Website](https://clickclacks.app) · [Live roller](https://dice.clickclacks.app) · [Source](https://github.com/illos/ClickClacks)

[Features](#features) · [Run locally](#run-locally) ·
[Contributing](#contributing) · [Embedding](#embedding)

## Features

The roller supports d4, d6, d8, d10, d12 and d20 pools of 1–20 dice, plus a
percentile pair for d100. Generic rolls have bonus and penalty controls and an
optional extra d4 for d6–d20 and percentile rolls. Draw Steel power rolls use
2d10, Edge/Bane controls and tiered results.

Players join a shared table through a link or short code. The table shows
participants, their dice designs, and a log of their rolls. Dice colors,
patterns and fonts can be changed in the customization preview; preferences
are saved in the browser.

The 3D tray plays recorded dice motion with sound. Settings include mute,
reduced motion, text and contrast preferences, and System, Light or Dark
appearance. Supported desktop browsers can open a floating picture-in-picture
tray with roll controls and the six latest rolls.

The TypeScript library provides dice calculations, Draw Steel helpers, a room
controller, and optional React and Three.js presentation. A headless CLI uses
the same controller and shared backend.

## Using the hosted roller

1. Open the [live roller](https://dice.clickclacks.app/).
2. Choose dice using the picker beside **Roll**, then make a roll.
3. Open **Sharing** and copy the table link or code. Friends can open the link
   directly or enter the code in their own Sharing menu.
4. Set your name and dice appearance in the customization menu.

The hosted site uses guest sessions, so you can join without creating an account.
Default tables last 24 hours and support eight active participants. Accepted
roll history is retained by the backend for one hour. Clearing the tray clears
everyone's current dice; it does not erase the backend's accepted-roll receipts.

## Real-time collaboration with Convex

The frontend uses [Convex reactive queries](https://docs.convex.dev/realtime)
to subscribe to table membership and each player's rolls. Convex sends updates
when the stored state changes, including new rolls, profile edits and shared
clears. Each player has a separate roll track, so the client can subscribe to
their throws independently.

For a shared roll, the controller sends the dice configuration, guest credential
and a stable request ID to the backend. The server generates the faces and
records them against that request. The client prepares any dice motion, then
submits the roll for validation and storage. Retrying the same request reuses
the recorded faces.

Subscriptions deliver the accepted result and recorded motion to the other
players. A shared server timestamp coordinates when the result appears in the
log. The animation displays the server's result; text and headless clients
receive the same values and reveal timing.

The reusable backend is a [Convex component](https://docs.convex.dev/components/overview)
with its own room, session, request and presentation tables, plus scheduled
cleanup. Its implementation is in `component/`. The site's `convex/` directory
contains public functions that forward calls to the component. Applications
that install it supply their own public functions and access policy.

Table links and codes grant read access. Each guest has a public viewer ID for
attribution and a separate private credential for writes. Credentials are not
included in shared room views or roll records. See [backend integration](docs/component.md)
for the function flow and access boundaries.

## Run locally

Use Node 24.18.0, pnpm 11.5.3, Git, and your own Convex development project.
The repository pins Convex 1.45.0.

Fork the repository if you plan to contribute, then clone your fork (or clone
the upstream repository):

```sh
git clone https://github.com/illos/ClickClacks.git
cd ClickClacks
pnpm install --frozen-lockfile
cp .env.example .env.local
env -u CONVEX_DEPLOY_KEY pnpm exec convex dev
```

Follow the Convex prompts to create or select your development project. Leave
that process running to sync backend changes and generate the ignored app and
component bindings. Clearing an ambient `CONVEX_DEPLOY_KEY` prevents it from
selecting an unrelated deployment; on Windows, remove that variable from
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

## Repository layout

The stack is TypeScript, React, Vite, Three.js, cannon-es and Convex.

| Directory | Contents |
| --- | --- |
| [`lib/`](lib/) | Public dice, Draw Steel, controller, React and graphics entry points. |
| [`shared/`](shared/) | Dice configurations, result contracts and shared interpretation. |
| [`component/`](component/) | Convex schema, roll authority, sessions and cleanup. |
| [`convex/`](convex/) | App-facing wrappers and component installation. |
| [`web/`](web/) | Roller UI, 3D presentation, customization, floating tray and landing page. |
| [`scripts/`](scripts/) | Headless CLI and build tooling. |
| [`examples/`](examples/) | Plain TypeScript embedding and Convex integration examples. |
| [`tests/`](tests/) | Focused library, controller and backend regression tests. |

## Contributing

Report bugs and discuss proposed changes in
[GitHub issues](https://github.com/illos/ClickClacks/issues). A bug report should
include steps to reproduce it, the expected result, and the browser and device
when relevant. Discuss larger changes before starting implementation.

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

See the [API coverage](docs/api-coverage.md),
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

<a id="embed-without-adopting-the-site"></a>

## Embedding

The package is not published to npm. Install a pinned Git revision or local
checkout in a TypeScript application with a bundler such as Vite:

```sh
pnpm add 'clickclacks@git+https://github.com/illos/ClickClacks.git#COMMIT'
```

Replace `COMMIT` with the revision you reviewed. The package exports TypeScript
source; a raw JavaScript-only consumer needs to compile it first. A Vite consumer
should include `vite/client` types and the `DOM.Iterable` TypeScript library for
font assets. Node's native TypeScript runner does not load TypeScript packages
from `node_modules`; use a bundler for these source exports.

Generated Convex bindings are excluded from Git. To distribute a local
backend component artifact, generate bindings during your Convex setup, then run
`pnpm pack` and install the resulting `.tgz` into the consumer. The package includes
the generated component bindings without committing them. A Git-only installation
needs component codegen before using `clickclacks/_generated/component.js`.

| Import | Purpose |
| --- | --- |
| `clickclacks/dice` | Dice generation, mixed pools, supplied values, keep/drop and percentiles. |
| `clickclacks/draw-steel` | Draw Steel result helpers and presets with source citations. |
| `clickclacks/format` | Text descriptions of results. |
| `clickclacks/client` | Room controller and Convex transport. |
| `clickclacks/three` | Optional 3D tray, fonts, physics utilities and isolated planners. |
| `clickclacks/react` | The roller interface as a mountable `ClickClacks` component. |
| `clickclacks/styles.css` | Styles for the React interface. |
| `clickclacks/convex.config.js` | Isolated backend component installation. |

Core arithmetic and controller imports do not load React, Three.js or application
CSS. The host application supplies configuration, controls, identity, names,
storage and logs. Creating a tray or joining a room requires an explicit call.

This example rolls through the room controller without a renderer:

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

Use the same `id`, dice and modifiers when retrying a request whose outcome is
unknown. The server retains its sampled faces. `roll(input, prepare?)` accepts
an optional function for preparing dice motion; a failure in that function
does not invalidate the sampled result. The `available` event uses the server's
reveal timestamp.

The controller also provides `profile`, `clear`, `leave`, `catchup`, `clock` and
`clockEstimate`. Its events include `accepted`, `track`, `room`, `clear`, `status`
and `error`. Catch-up results are marked `historical: true` once their reveal
time has passed. `observe()` subscribes to a membership managed by the host
without joining, sending heartbeats or leaving it. `dispose()` removes the
controller's timers and subscriptions; call `leave()` to end its membership.

[The plain example](examples/plain/main.ts) combines the public controller,
arithmetic and imperative tray without React or site CSS. A host must supply its
own endpoint and session. For 3D, load the exported fonts before creating the
tray, use one `createThrowPlanner()` per mounted instance and dispose it with the
tray. Completion callbacks report playback status; use `available` for results.

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
component functions. Add public wrappers that enforce your app's access policy
before forwarding calls. The repository's `convex/diceDemo.ts` and
`convex/diceDemoV2.ts` show the site's wrappers. Retain those function names for
the standard transport, or supply a `Transport` with `call` and `watch` to map
your own names.

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

## Limits

- The collaborative backend supports the original power roll and homogeneous
  d4/d6/d8/d10/d12/d20 pools of **1–20** dice. Its d10 is the selected diamond model;
  the power-roll model remains the accepted logical d10. A fixed percentile pair
  uses that same original model, with 00–90 tens and 0–9 units (double zero = 100).
  Generic d6–d20 and percentile pools may add one bonus d4 (up to 21 total dice).
  All supported pools have recorded physics.
- General mixed pools, keep/drop and additional Draw Steel presets are pure
  library capabilities. The shared backend does not store these interpretations;
  custom persisted interpretation requires a trusted wrapper.
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
  manage the host's session storage or navigation.
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
The hosted backend keeps its installed `powerroller` component
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
