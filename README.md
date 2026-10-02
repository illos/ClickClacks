# Click Clacks

Click Clacks is the standalone dice roller published from `illos/powerroller`.
The approved High Voltage branding changes the site name; package, API and browser-storage identifiers remain compatible.

[The version-one readiness plan](docs/v1-readiness-plan.md) combines the codebase
cleanup review, measured frontend/database optimizations, selected one-hour history
policy and collision investigation. It describes proposed work, not changes already shipped.

Use the appearance icon in the top menu to choose **System**, **Light**, or **Dark**.
System is the default and follows device changes live; an explicit choice is saved
in this browser. Appearance is also available in Customize dice and the floating
tray’s Dice settings. The main page and PiP share the preference. Dice colors,
fonts, patterns, roll state and table history stay independent of the app theme.

A free realtime dice roller for Draw Steel, with a reusable TypeScript library,
optional React/Three presentation and an isolated Convex backend.

[Website](https://clickclacks.app) · [Live roller](https://app.clickclacks.app) · [Source](https://github.com/illos/powerroller)

The default interface, materials, recorded physics, customization preview, social
menus and compact log come from Salient commit
`23cf9035b6e55d3e2e3a8198cba8c2320e7d205b` (V272). The standalone site adds the
requested dice picker inside Roll: Power roll (2d10), d20, d12, diamond d10, d8,
d6 and d4. The +1d4 toggle adds one bonus d4 to generic d6–d20 pools. Generic rolls support 1–20 base dice and numeric bonus/penalty controls; power rolls
retain Edges, Banes and tiers. Generic dice bonus/penalty controls cycle through
0, 2 and 5; the wire fields `edges` and `banes` remain stages 0–2. A bonus
adds its stage value and a penalty subtracts its stage value, so equal stages
cancel (stage 2 bonus and stage 1 penalty give +3). Clearing preserves the original shared tray behavior.

The floating tray has a settings cog with Sharing and Dice tabs. Its name, design
and accessibility controls use the same settings as the main page. Joining or
leaving a table switches the main page and closes the current floating tray;
reopening uses that new table. Shared links open the full site.

On supported desktop browsers, the popout icon beside the customization and
social icons opens a floating dice tray. It shares your table, player and current
roll controls, with the six latest rolls behind the dice. The main log keeps its
full history and fades only near the bottom of its scroll area.

## Run your own site

Use **Node 24.18.0** and **pnpm 11.5.3**.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm exec convex dev
```

Select **your own Convex development project**. Code generation creates ignored
bindings for the app and component. Set `VITE_CONVEX_URL` in `.env.local` to that
project's public deployment URL, then:

```sh
pnpm dev
```

Open `http://localhost:9591/powerroller/`. The frontend connects directly to
Convex; the package supplies no default backend URL. A deployment key is a server
secret, never a `VITE_*` value. When using a shell with an unrelated ambient
`CONVEX_DEPLOY_KEY`, clear it before selecting or deploying this project's backend.

```sh
pnpm typecheck
pnpm test
pnpm build
```

`dist/` is generated output and must not be committed. GitHub Pages publication
uses the repository's Actions workflow and the repository variable
`VITE_CONVEX_URL`. The default asset base is `/powerroller/`; configure `CLICKCLACKS_BASE` (legacy `POWERROLLER_BASE` is also accepted)
for another hosting path. Publish matching backend functions before a frontend
that requires them.

The build shares one asset graph between the main site and PiP tray. It also
emits the old tray document under `dist/pip/` as a compatibility alias.
Deploy the whole `dist/` directory. Set `CLICKCLACKS_BASE` (with a trailing slash)
when building for a hosting path other than `/powerroller/`.

The live Cloudflare roller uses `pnpm build:cloudflare` to build the same app
at `/`. The static-assets configuration, publication record and backend/team steps
are documented in [docs/cloudflare-hosting.md](docs/cloudflare-hosting.md).

## Embed without adopting the site

npm publication is deferred. Install a **pinned Git revision or local source
checkout** into a TypeScript application using a bundler such as Vite:

```sh
pnpm add 'clickclacks@git+https://github.com/illos/powerroller.git#COMMIT'
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
| `clickclacks/three` | Optional original tray, fonts, physics utilities and isolated planners. |
| `clickclacks/react` | The original interface as a mountable `ClickClacks` component. |
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
await controller.dispose();
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
- Optional tray sounds are off by default and saved locally. Clacks follow recorded bounce timing; reduced/hidden motion uses a result-reveal clack. Recorded clips are from [Gliz Caldo's Dice Roll Sound Effects](https://www.youtube.com/watch?v=F4Kxnv3Hzmk), used with the creator's permission; [audio provenance](web/dice-demo-v2/audio/README.md).
- Local motion/text/contrast preferences affect presentation. Shared result
  availability stays aligned with the common reveal timestamp. Real-device
  timing and actual VoiceOver/NVDA checks remain separate manual evidence; this
  repository does not claim WCAG conformance from automated tests alone.

## Source and license

Powerroller-owned code is **MIT** with the copyright owner's authorization.
Dependencies keep their own licenses. Eczar, Sora, Caesar Dressing and New Rocker
font subsets retain OFL notices in `web/dice-demo/fonts/`; builds ship
`dice-font-licenses.txt`. No Salient catalog, monster names, game artwork or
reference corpus is distributed. Implemented Draw Steel mechanics retain source
citations; the corpus itself is not required to build or run the project.

[The extraction record](docs/extraction.md) records the named source baseline and
initial publication. Later standalone capabilities are described by this README
and the current code. Salient is an independent consumer; this project does not
modify its deployment, characters or campaign rules.

## Naming compatibility

The source package and new component installations use `clickclacks`; the React
entry exports `ClickClacks` and retains `PowerRoller`/`PowerRollerOptions` aliases.
Existing consumers may install the source under an explicit dependency alias,
for example `pnpm add 'powerroller@git+https://github.com/illos/powerroller.git#COMMIT'`.
The community backend deliberately keeps its installed `powerroller` component
namespace, and browser preferences, identities, channels and history keep their
existing storage keys. Renaming does not create a new database or discard data.
GitHub/Convex project metadata and the existing Pages path are unchanged until
the hosting rename is coordinated. New builds accept `CLICKCLACKS_BASE`.

The main page and PiP tray now share one production asset graph. The tray loads
from `web/popout/tray.html`; the older `pip/web/popout/tray.html` URL is emitted
as a compatible document using the same shared assets.

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
