# Powerroller extraction plan

Date: 2026-10-01. Status: planning document; implementation has not started.

**Pitch: a free realtime collaborative dice roller for Draw Steel.**

Repository name: `powerroller`. The standalone site uses the reusable library and a Convex backend
in the owner's cloud account. Other projects can consume the library, supply their own data and
accepted results, and install the collaborative backend in their own Convex deployment.

This consolidates the dice survey, hosting discussion, extraction analysis and accessibility review.
The inspected baseline is Salient runtime commit `8b93f5c1`, with publication documentation at
`be6dc311`. Findings describe that baseline, not later changes or verified release readiness.
The current implementation specification remains [the dice roller spec](dice-roller-spec.md).

## 1. Confirmed direction and visual constraint

- Extract Powerroller into a standalone repository, with a programmatic API suitable for embedding.
- Use Convex for the supported realtime backend. Keep frontend hosting independent of Cloudflare.
- Supply a small GitHub Pages site that consumes the library and uses the owner's Convex account.
- Let integrations supply dice requests, existing results, modifiers, identity, names and appearance
  through configuration or documented extension interfaces, without editing library source.
- Keep the site's browser persistence outside the core: username, roll history, current table and
  dice customizations belong to a separate site module.
- Include accessibility in the extraction: semantic results independent of animation, screen-reader
  output, keyboard operation and a dedicated local motion preference.
- **Preserve the current default UI.** Its layout, compact log, controls, menus, dice appearance and
  visual character are the baseline to retain. The analysis's suggestions for larger controls,
  different palettes, different density and additional visible UI are not blanket redesign approval.
- An **optional high-contrast mode** is the preferred proposed visual accommodation: it may simplify
  stylistic choices for readability. Its detailed palette and treatment remain design proposals.
- Salient may consume a versioned dependency or maintain an independent fork/branch. A versioned
  dependency is recommended; replacing Salient's current integration is a later, separate change.

Package names, exact API signatures, numeric policy defaults and phase boundaries below are
implementation proposals. The new repository must not import Salient's campaign schema, content
catalog, deployment identity, reference corpora or application-wide styles.

### Release decisions confirmed on 2026-10-01

- Destination repository: [illos/powerroller](https://github.com/illos/powerroller), supplied by the
  user. The next session will have a GitHub token that includes this repository. Defer destination
  access/push operations until then; no access or publication has been verified in this session.
- MIT is the selected license for Powerroller-owned code. The user confirmed ownership of all
  roller code after the provenance audit; third-party software/assets keep their own licenses. This supersedes the earlier GPL recommendation for the new project;
  it does not change Salient's license or third-party licenses. See section 8.
- The first public release covers the expanded design. An extracted 2d10 version is an internal
  milestone, not the community release.
- Include approved palette, material and font work. Coordinate with the UI thread's V272 adoption
  and select a named source commit rather than copying its working tree.
- Every die in the advertised launch set needs animated 3D support. Reduced-motion, text-only and
  graphics-failure paths still work; fallback alone does not complete a launch model. Generic API
  side counts beyond the stock model set are not a promise of arbitrary 3D geometry.
- Aim for everyone to receive results around the same time, aligned with roll resolution/dice
  settling. Tune a common reveal timestamp; it remains independent of any viewer's animation
  callback and applies equally to text and reduced-motion presentation.
- Participants are equal; the standalone site has no privileged host role. Clearing one's own dice
  is the proposed starting policy; shared-clear behavior remains a detail to settle if exposed.
- Use the user's existing Convex account (the same account as Salient), with a dedicated Powerroller
  project/deployment. The specific target remains to be selected.
- Launch at the standard GitHub Pages URL, with a repository and live site. npm publication is
  deferred and is not a release requirement; reusable package boundaries remain part of the design.
- Make the README sufficient for people and their agents to set up and adapt the project. A short
  `AGENTS.md` pointing to it is optional if useful; avoid duplicated instructions or importing
  Salient/Presidium-specific workflows into the distributed project.

This document plans extraction; it does not claim that a repository, package, new cloud deployment
or Pages site has been created. It introduces no new Salient version-one release gate.

## 2. Existing implementation and extraction seams

| Area | Evidence in the checkout | Implication |
| --- | --- | --- |
| Standalone page | [V2 entry](../web/dice-demo-v2/main.tsx), [Vite entry](../vite.dice-v2.config.ts), [HTML](../dice-v2.html) | Already built separately, but the entry owns client creation, URL mutation, controls, state and log. |
| Dice generation | [Shared generator](../convex/lib/dice.ts), [demo sampling action](../convex/diceDemo.ts) | Pure generation can be extracted; surrounding helpers depend on campaign/user tables. The demo sampling endpoint fixes the request to two d10s. |
| Room API | [V2 functions](../convex/diceDemoV2.ts), [client references](../web/dice-demo-v2/api.ts) | Join, view, track, customize, throw, clear and receipt operations exist. Endpoint names and types are tied to the current app. |
| Storage | [V2 tables](../convex/diceDemoV2Tables.ts), [shared demo validators](../convex/diceDemoTables.ts) | Rooms contain participants; tracks are indexed by room/participant and store one current roll. There is no complete shared roll archive. |
| Names | `randomName` in the V2 backend; [name helper](../convex/lib/foeNames.ts) | Reads `contentManifest`, seeded statblocks and a generated Compendium manifest. A missing catalog prevents initial name readiness. |
| Rules | [Shared resolution](../shared/resolve/index.ts) | Edge/Bane and tier functions can be isolated from the wider ability/damage engine. Demo characteristic is fixed at +0. |
| Presentation | [Tray](../web/dice-demo-v2/renderer.ts), [preview](../web/dice-demo-v2/preview.ts) | Mount/play/clear/dispose seams already exist. Rendering still assumes pairs of the same model. |
| Physics | [Solver](../web/dice-demo/physics.ts), [worker](../web/dice-demo/physics-worker.ts), [preparation](../web/dice-demo/prepare-throw.ts) | Two bodies and a 14-number frame are assumed. Worker ownership is module-global. |
| Model and styles | [Logical d10](../web/dice-demo/d10.ts), [V2 styles](../web/dice-demo-v2/style.css), [base styles](../web/dice-demo/style.css) | A twenty-face shape represents each logical d10. Global CSS affects the page; body/ink colors and three patterns are configurable today. |
| Clock and reconnect | [Clock lifecycle](../web/dice-demo-v2/clock-sync.ts) | Reusable implementation includes foreground recovery, deadlines and retry. It remains browser-specific. |
| Browser state | V2 entry's profile, viewer and log state | A reload creates a new participant/profile. Up to 100 observed results live in React state; no browser persistence exists. |
| Hosting | [Hosted development](hosted-development.md), [Wrangler assets](../wrangler.jsonc) | Cloudflare serves static assets. The hosted browser connects directly to Convex. |

### Present roll flow

1. The page requests two random d10 faces from a server action.
2. A worker prepares cosmetic motion and orients the numbering to those faces.
3. The browser submits the faces and motion to `throwDice`.
4. The mutation validates, computes the Edge/Bane total/tier, schedules playback and stores the track.
5. Other viewers subscribe to the recorded track and replay the same trajectory.
6. A reveal callback, or a fallback timer derived from that trajectory, adds the result to the log
   and causes a screen-reader status update.

The backend currently accepts supplied faces without a persistent binding to the earlier sampling
action. Membership checks trust the supplied participant UUID and room access; the UUID is not an
authenticated identity or private participant credential. These are properties of the demo contract,
not guarantees to carry into a reusable public backend.

Other current constraints:

- Eight active participants, 30-second presence expiry, 10-second heartbeat and 24-hour rooms.
- Retry detection covers the latest track only. Replacing or clearing it removes that roll's retry
  record. A user's new click samples anew rather than preserving the entire earlier request.
- Text fallback still requires physics preparation to submit a roll; motion is mandatory in V2.
- New throws can collide with captured resting dice. Concurrent moving throws are independent
  recordings, not one synchronized physics world.
- Expiry checks reject old rooms; the reviewed demo files contain no scheduled expired-room cleanup.
- Raw motion arrays dominate roll records. Increasing dice count needs explicit payload bounds and
  animation capacity separate from logical roll limits.

The existing tests cover selected generation, geometry, clock, storage and concurrent-track cases:
[V1 tests](../tests/app/dice-demo.test.ts), [V2 tests](../tests/app/dice-demo-v2.test.ts).
They do not establish package integration, general dice support, browser cache or accessibility.
Recent UI slices recorded test/device waivers; those are not release evidence for the new library.

## 3. Capabilities available without a library fork

Configuration selects supported behavior. A documented extension adds a new provider or model in
the consuming project. An extension may require integration code, but not editing Powerroller.

| Capability | Proposed public surface | Baseline |
| --- | --- | --- |
| Roll a die or pool | Side count, quantity, stable per-die IDs | Generator supports arbitrary sides; demo exposes 2d10 only. |
| Mixed dice | Ordered groups such as `2d10 + 3d6` | New demo/client/renderer support required. |
| Numeric modifiers | Characteristic and labelled bonuses/penalties | Demo characteristic +0 only. |
| Edges and Banes | Counts interpreted by a Draw Steel preset | Implemented for the demo power roll. |
| Keep/drop | Keep highest/lowest, retain a record of discarded dice | New. |
| Percentiles | Explicit tens/ones aggregation | New; never treat percentile dice as an ordinary sum. |
| Roll purpose | Raw sum, power roll, save, opposed total, project total | Demo exposes one power-roll interpretation. |
| Supplied results | Accept/resolve/present explicit values without generation | Existing internal path needs a deliberate public contract. |
| Context | Label, actor/action references and bounded serializable metadata | Mostly participant attribution today. |
| Custom interpretation | Installed preset or trusted host resolver | Current arithmetic is wired into the demo backend. |
| Names | An array or sync/async name provider, with a usable fallback | Currently requires the Salient catalog. |
| Identity | Guest session provider or host-authenticated identity | Client-supplied UUID today. |
| Dice appearance | Existing body/ink/pattern choices and registered models | Existing customization retained. |
| Rendering | Tray element, optional renderer, instance lifecycle and host asset paths | Existing renderer is a useful starting point. |
| Room operations | Create, join, leave, subscribe, update profile, clear | Most exist; leave and policy seams need definition. |
| Room policy | Capacity, retention, expiry, permissions and bounded request sizes | Hardcoded today. |
| Events | Accepted/available results, connection, participants, errors, presentation status | Currently coupled to React effects. |
| Accessibility | Motion/display/contrast preferences, semantic summaries and announcement hooks | Partial OS-motion and status support. |
| Persistence | Host consumes events and restores its own saved state | Site cache will be a separate module. |
| Hosting | Supplied Convex connection, API bindings and worker/asset base | No intrinsic Cloudflare dependency. |

General request validation currently supports at most 100 dice and 2–1,000 sides. Preserve bounds
initially as generator limits; do not represent them as a proven simultaneous 3D rendering capacity.
Unsupported visual models must have an honest text/static fallback rather than preventing a valid
logical roll. All advertised launch dice still require animated models under the confirmed release
decision above. Registering wholly new geometry is an extension, not a promise that arbitrary shapes
can be obtained from a settings object.

### Dice and roll coverage from the source survey

The fixed expressions found in the pinned corpus are `1d3`, `2d3`, `1d4`, `1d6`, `2d6`, `3d6`,
`4d6`, `1d10`, `2d10`, `3d10` and `d100`. Variable d6/d10 pools and mixed project-roll additions
also occur. This is a survey of expressions, not eleven separate rolling algorithms.

| Use | Source boundary |
| --- | --- |
| Ability rolls and tests: 2d10 plus modifiers | [Power Rolls — Types / Making a Power Roll](../vendor/steel-compendium/en/books/heroes/md/rule/dice/power-roll.md) |
| Opposed rolls: compare totals; special double Edge/Bane treatment | [Opposed Power Rolls](../vendor/steel-compendium/en/books/heroes/md/rule/dice/opposed-power-roll.md) |
| Project totals and breakthrough | [Project Roll](../vendor/steel-compendium/en/books/heroes/md/rule/downtime/project-roll.md) |
| Saves: one d10, normally 6+ | [Saving Throw](../vendor/steel-compendium/en/books/heroes/md/rule/general/saving-throw.md) |
| Combat opening: one d10 determines which side chooses | [Combat Round — Determine Who Goes First](../vendor/steel-compendium/en/books/heroes/md/rule/combat/combat-round.md) |
| d3 and percentile representation | [The Basics — Dice / D3s / D100s](../vendor/steel-compendium/en/books/heroes/md/chapter/the-basics.md) |
| Edges, Banes, tiers and natural results | [Edge](../vendor/steel-compendium/en/books/heroes/md/rule/dice/edge.md), [Bane](../vendor/steel-compendium/en/books/heroes/md/rule/dice/bane.md), [Tier Outcomes](../vendor/steel-compendium/en/books/heroes/md/rule/dice/tier-outcome.md), [Natural Roll](../vendor/steel-compendium/en/books/heroes/md/rule/dice/natural-roll.md) |
| Rare d4 and 4d6 expressions | [Wyvern Lurker — Acidic Anguish](../vendor/steel-compendium/en/unified/md/monster/wyvern/statblock/wyvern-lurker.md), [Logostician Vesper — death explosion](../vendor/steel-compendium/en/unified/md/monster/war-dog/4th-echelon/statblock/logostician-vesper.md) |
| 2d3 and 3d10 discard-lowest examples | [Final Evolution](../vendor/steel-compendium/en/unified/md/feature/beastheart/level-10/final-evolution.md), [Rampage — 24-point row](../vendor/steel-compendium/en/unified/md/feature/beastheart/level-1/rampage.md) |
| Variable pools and mixed additions | [To the Uttermost End — Spend](../vendor/steel-compendium/en/books/heroes/md/feature/ability/fury/level-1/to-the-uttermost-end.md), [Ancient Loremaster — Rare Books](../vendor/steel-compendium/en/books/heroes/md/title/ancient-loremaster.md) |

Keep Draw Steel interpretation in a separate preset. A project roll or opposed total must not silently
inherit a tiered power roll's double Edge/Bane behavior. A high natural power roll must not grant a
generic critical-hit action without the owning game's action context. Class and monster examples
justify generic dice capabilities; they do not bring those classes, monsters or effects into scope.

Read source references only from the canonical main-checkout Compendium. Do not copy or initialize
it in worktrees or the new repository. Rule tests derive expected values from cited passages, not
from the implementation. Unresolved mechanics remain explicit/manual.

## 4. Proposed module boundaries

Use one repository with separately importable entry points; package publication names can be decided
when packaging. Consumers should not download React/Three merely to use dice math.

| Module | Owns | Boundary |
| --- | --- | --- |
| `powerroller/dice` | Dice/result types, validation, generation primitives and generic operations | No browser globals, React, rendering or Salient/Convex schema. A `dice.ts` source entry provides this functionality. |
| `powerroller/draw-steel` | Cited rules presets and semantic result interpretation | Explicit inputs; no character sheets, combat side effects or content database. |
| `powerroller/client` | Instance controller, event subscription, transport and result lifecycle | Receives dependencies; does not create a global room or mutate browser history on import. |
| `powerroller/three` | Models, cosmetic solver/worker, tray and preview | Optional; accepts authoritative results and emits presentation status. |
| React bindings / accessible HTML | Current controls, result views, dialogs and announcer adapter | Scoped styles and reusable components; hosts can supply their own UI. |
| Packaged Convex component | Rooms, membership, accepted rolls, request receipts, presentation records, expiry | Own tables and API; host wrappers supply auth/access policy. |
| `apps/site` | Community page, branding, default name data, browser persistence and Pages build | Consumes the public package APIs; owns site preferences and routing. |

For Convex, package isolated tables/functions rather than copying all of Salient's `convex/` folder.
Consumers mount the component and expose host-owned wrappers. Parent app identifiers cross the
component boundary as opaque references. Supply typed helpers and an example wrapper so installation
is small and explicit. The source's Convex version is 1.45.0; verify packaging against installed types
before using newer APIs. See [Convex component authoring](https://docs.convex.dev/components/authoring).

The site and Salient can reuse an existing Convex client. Backend URL/function bindings, worker URLs
and asset bases are dependencies, not hardcoded package constants. The core can be used locally or
with host-supplied results without a Convex account; collaborative operation uses the installed
Convex backend. Building alternative backend adapters is not required for the first release.

### Frontend portability and replacing the UI

Convex and TypeScript are the supported foundation. Ship the existing React interface as the
ready-to-use default, while allowing a consuming project to omit React and provide its own controls,
log and menus. The current dice page uses ordinary CSS, not Tailwind components; extracting the
roller does not require carrying over Salient's Tailwind stack.

The intended dependency direction is:

```text
Current React UI                 Consumer's own UI
        |                              |
        +------- client/controller ----+
                     |
          dice/presets + Convex transport

Either UI can independently mount the optional Three.js tray into a DOM element.
```

The controller owns room state, subscriptions, request identity, result availability and status;
React hooks adapt that controller rather than being its only implementation. The imperative tray
API can be mounted from another framework or plain browser code. Result data and text summaries
are plain serializable values/strings, not JSX, HTML fragments or Tailwind class names. Host UIs
can use the formatter or render the structured result themselves.

Replacing the UI still means writing replacement markup, styling and accessible controls. The
library does not automatically translate React components to another framework. It should let a
consumer retain the existing dice generation, realtime behavior and 3D presentation while doing
that work. Do not build and maintain bindings for every frontend framework as part of extraction:
the supported React UI plus a small non-React consumer is sufficient to demonstrate this boundary.

Package acceptance must prove that importing the core/controller/imperative tray does not load
React or global site CSS; importing only the core must also avoid Three.js and browser globals.
The current default UI retains its visual design through this refactor.

## 5. Roll authority, timing and API contract

### Separate the three lifecycle events

1. **Accepted:** an authoritative result is recorded and its request identity is fixed.
2. **Available:** text, announcements, host consumers and graphics may expose the result.
3. **Presented:** one viewer finishes, skips or fails its cosmetic presentation.

Availability must never depend on a rendered frame, WebGL, worker success or a presentation callback.
For the standalone site, publish an explicit shared `revealAt` from the controller/server, tuned to
roll resolution and the expected settling time.
Animated, static and text-only viewers honor the same availability policy. A local motion preference
does not change the values or accidentally reveal them ahead of the agreed shared time.

The community site can keep its existing visible timing and animation while that internal dependency
is removed. A graphics failure must still result in an available, readable roll. Independent roll
acceptance also allows a host to choose immediate text results without installing a renderer.

### Requests and records

- Validate an ordered set of identified dice/groups and an installed ruleset. Retain individual values,
  kept/discarded status, natural total, labelled modifiers and final interpretation where applicable.
- Use a stable request ID with a fingerprint of its meaningful inputs. A retry returns the same
  accepted roll; reuse with different inputs is rejected. Reconnect must not generate an extra roll.
- Retain request receipts separately from current tray tracks, for a documented bounded period.
  Clearing the tray must not erase retry protection or the site's saved result history.
- Define bounded cursor catch-up independently of the latest tray track, so two rapid rolls by one
  participant and clearing before reveal do not lose semantic results. Document the response after
  receipt expiry; an expired retry must not silently become a newly generated roll. P2 acceptance
  must cover both delivery cases and an expired receipt.
- Distinguish `generated` from `supplied` results. The generated path binds persisted values to the
  request. The supplied path is an explicit host capability with appropriate backend permission.
- Attach presentation to an accepted roll ID. Validate model IDs, die IDs, payload size and agreement
  with accepted values. Version the motion format and define fallback for unavailable versions.
- Keep cosmetic randomness separate from result generation. Do not expose generator secrets as
  part of public replay records.
- Use transport-neutral, serializable data and structured errors. Do not transmit executable
  client callbacks as authoritative server logic; custom shared interpretation is installed by
  the consuming app in its trusted wrapper/preset.
- Store bounded presentation data separately from compact result records. A full historical archive
  is an optional future capability; bounded request receipts are required even without that archive.

Illustrative signatures, not existing APIs:

```ts
const accepted = await roller.roll({
  requestId,
  dice: [{ sides: 10, count: 2 }],
  ruleset: "draw-steel/power",
  modifiers: { characteristic: 3, edges: 1, banes: 0 },
  context: { label: "Power roll", actorId: "hero-123" },
});

// Independently observe semantic availability; the UI need not mount a tray.
const unsubscribe = roller.on("result.available", result => {
  hostLog.append(result);
});

await tray.present(accepted); // Optional cosmetic consumer.
```

An existing-result API must similarly resolve/present supplied values without invoking generation.
Subscriptions need state/readback and cursor semantics so subscribing after a request cannot lose
that request's result; the example abbreviates setup. Multiple instances need isolated lifecycle and
cleanup. API calls support headless use; a small example CLI can demonstrate the same routes.

### Backend policy

Offer guest capability sessions for the standalone site and host-derived authenticated identity for
embedded apps. Keep public participant IDs distinct from private credentials. Membership, identity,
allowed rulesets, supplied-result permission, room clearing and request limits are enforced server
side, not only by visible controls. Configure reasonable capacity and retention defaults; include
expiry cleanup and bounded public-operation usage. Do not silently promise that larger rooms scale
just by changing the current array-length limit.

## 6. Accessibility with the current UI retained

Accessible semantics and keyboard behavior apply to the ordinary UI. High contrast is a visual
preference, not a prerequisite for screen-reader access or successful rolling.

### Existing strengths and gaps

Native controls, named modal dialogs, labelled icon buttons, HTML results, textual Edge/Bane labels
and OS reduced-motion handling already exist. Preserve them.

| Finding at the baseline | Planned response |
| --- | --- |
| The log is populated by reveal callbacks. | Move semantic delivery to the controller's availability event. |
| Live status contains only name and total. | Include result meaning, with a detailed accessible explanation in the persistent log. |
| The newest-entry live region may miss identical or concurrent announcements. | Deduplicate by roll identity, deliver distinct events through an announcement adapter and test actual assistive technology. |
| OS motion preference works, but there is no explicit control. | Add a dedicated local motion preference applied before graphics start. |
| The 10px timestamp at 50% opacity computes to about 3.16:1 against the page background. | Record the normal-theme contrast debt; make high-contrast timestamps readable. Any normal-theme visual correction should be narrowly reviewed rather than treated as redesign approval. |
| Fixed viewport height and hidden outer overflow may clip enlarged content. | Verify reflow and allow needed scrolling at enlarged/short viewport sizes while preserving ordinary layout. |
| Some controls are 36–40px; preview wheel/drag captures scrolling. | Verify usable hit areas and spacing. Essential actions remain operable without gestures; do not silently redesign default controls. |
| Connection/expiry status and disappearing/disabled controls need review. | Announce meaningful state changes and preserve sensible focus without moving focus to new results. |

The timestamp figure is a calculation from CSS, not a rendered conformance test. Small type alone
does not prove a WCAG failure. Clipping, focus behavior and screen-reader delivery need browser and
assistive-technology verification. Native modal behavior is a useful base, not a substitute for
checking focus on open/close and announcements while a dialog is active.

### Motion and display preferences

Proposed control: **Use device setting / Reduce motion / Full animation**. Default to the device
preference; save an explicit choice in the site's browser preferences. The library accepts the
resolved setting and supports changes during a session. Apply it before the first animated frame.

Reduced motion uses static dice and removes automatic spinning, inertia and result scale effects.
It applies to other participants' rolls on the local screen too. Manual inspection, if available,
remains deliberate. Offer an independent optional **Hide 3D dice** setting; it should avoid loading
or warming the renderer/physics solely for that viewer. Do not infer screen-reader use or conflate
it with a motion preference. Location and visual treatment of the preference controls should fit
the existing menus rather than expand the main toolbar by default.

### Optional high-contrast mode

Proposed opt-in changes, to be visually reviewed against the current UI:

- Strong text, control and focus contrast; remove opacity-based de-emphasis that harms readability.
- Solid/simple dice surfaces and readable number ink when needed, retaining color-independent
  attribution and the full HTML result. Preserve the user's stored decorative style for restoring
  normal mode; local accessibility rendering must not broadcast replacement colors to everyone.
- Clear boundaries and states without relying on subtle shadows, gradients or color alone.
- More readable text treatment where required, within the existing layout and information hierarchy.
- Respect browser forced-colors behavior for HTML controls and results; canvas colors do not
  automatically gain that support.

This is not approval for a new default palette, larger default log, relocated controls, alternate
navigation or replacement visual design. Theme tokens and accessibility settings should make the
current appearance reusable. Keep normal-theme contrast limitations visible in release assessment;
an optional mode alone does not justify declaring the default interface WCAG-conformant.

### Text results, announcements and operation

- Export structured results plus a reusable formatter for concise and detailed descriptions.
  Example: “Morgan rolled 17, tier 3, with an edge.” Details: dice 7 and 8, natural total 15,
  edge +2, final total 17. Keep/drop, percentile and save descriptions explain their own semantics.
- Keep complete results in navigable HTML; a one-second visual overlay is supplementary.
- Use an accessible list/region and a controlled status announcer. Avoid making every historical
  row live, duplicating host announcements or adding automatic speech synthesis.
- Proposed announcement preferences: all rolls / my rolls / off. Turning announcements off keeps
  the complete log available. Host integrations may use their own game-log announcer.
- Preserve reading position while new rolls arrive. Do not steal focus or force scroll to latest;
  add a way to reach latest results only where needed by the chosen log behavior.
- Keep essential actions on native, labelled controls. Ensure errors identify the relevant input;
  connection, waiting and expiry states explain why an operation is unavailable.
- Keep controls usable with keyboard, touch, voice/switch navigation and enlarged text. Any
  convenience shortcut must be documented, optional and must not intercept typing into fields.

Use WCAG 2.2 AA as a proposed verification target, with reduced-motion behavior adopted explicitly
even where the specific interaction-animation criterion is AAA. Do not claim conformance from source
inspection or automated checks alone. References: [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[motion](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html),
[contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
[target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and
[modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 7. Standalone site and browser cache

The site consumes public package exports, with no privileged imports of library internals. It owns
branding, default names, site navigation, sharing links and the browser cache. It uses the current
UI as its baseline and introduces only the necessary standalone/accessibility controls.

| Data | Recommended site-owned storage/behavior |
| --- | --- |
| Username and selected dice customization | Versioned `localStorage` preferences. |
| Motion, display and optional contrast/announcement choices | Same preference module; restore before presentation begins. |
| Current table | Saved locally; an explicit invite URL takes precedence. Validate that the table still exists and is joinable. |
| Observed roll history | IndexedDB, partitioned by backend/table and deduplicated by roll ID. Store compact accepted results and attribution, not trajectories. |
| Active browser session | Session-scoped identity/credential handling so separate tabs do not accidentally impersonate one another. Shared preferences are distinct from live session identity. |

Use bounded retention and versioned records, handle malformed/stale data, provide reset/export where
useful, and fall back to memory if storage is unavailable. Local history contains what that browser
observed: it cannot recreate all rolls missed while closed from the current latest-track backend.
Full shared history and replay of missed events would be an explicit later backend capability.
Reloading should restore preferences and cached history, then reconcile current table state without
re-announcing every historical result or resubmitting an old roll.

Browser persistence is origin-specific and may be evicted; changing the site's domain does not
automatically transfer saved preferences/history. See [browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### Hosting and account ownership

- Deploy only static site assets to GitHub Pages; realtime calls go directly to Convex.
- Set the asset base for `/powerroller/` on a project site or `/` on a custom domain. Keep query-based
  room links; ensure worker URLs, navigation and refresh work under either base.
- Build with GitHub Actions and publish artifacts rather than committing generated output.
- Give the community site a dedicated Powerroller Convex project/deployment in the owner's account,
  separate from Salient development data and lifecycle. Choose the target explicitly at setup.
- Library users supply their own Convex deployment/configuration. Do not ship the owner's endpoint
  as an automatic fallback or any deployment credential in the package or frontend bundle.
- Authentication, if added, must accept the actual frontend origin. Current guest operation does
  not require importing Salient's account system.
- Keep Cloudflare-specific scripts out of the package. An optional example deployment adapter is
  acceptable, but it is not a prerequisite to build or operate the site.

Official references: [Convex custom hosting](https://docs.convex.dev/production/hosting/custom),
[Vite on Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https),
and [Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
The free community-tool direction fits the proposed deployment; a later commercial SaaS direction
requires reconsidering Pages' usage restrictions and traffic limits.

## 8. Salient integration, licensing and scope

Recommend a versioned dependency for shared maintenance. Salient supplies its own actor identity,
permissions, action context, name provider and accepted gameplay results. It retains its rules engine
and event history; Powerroller presents/interprets only what its public contract owns. In particular,
do not replace Salient's campaign dice operations with the public demo's supplied-face submission.

An independent fork remains possible, but divergence means manually carrying fixes in both
repositories. Decide that integration path after proving the standalone package; it need not delay
the independent site. Coordinate extraction from a named commit with the UI thread: V270 palette
authoring is separate ongoing work and was not part of the inspected runtime baseline. Later accepted
visual improvements can be ported deliberately without treating this plan as permission to redesign.

The user intends MIT for Powerroller-owned code. Salient currently declares `GPL-3.0-only`;
confirm ownership/relicensing authority for extracted source and inventory copied code, dependencies,
font assets and their notices before assigning the new license. Ownership clarification is recorded
in [Q-V273-1](rules-questions-for-user.md#q-v273-1--powerroller-relicensing-authority-resolved-2026-10-01).
Copyright holders can offer their code under another license; a recipient cannot simply remove
other holders' GPL obligations. See the [GNU licensing FAQ](https://www.gnu.org/licenses/gpl-faq.html#ReleaseUnderGPLAndNF).
Resolve incompatible inherited code through permission, exclusion or a suitable replacement.
Do not blanket-relabel third-party fonts or dependencies as MIT. This planning update changes no
existing license file. The user reported uncertainty about ownership and requested an audit.
The [source provenance audit](research/powerroller-license-audit.md) inspected baseline `9adc4753`,
including V272: dependencies are permissively licensed, four OFL fonts and notices match upstream,
and no declared external GPL roller implementation was identified. The user subsequently confirmed
ownership of all roller code, resolving Q-V273-1. Original demo notes explicitly record no copied
Owlbear source, models or artwork; the audit records that research-only boundary. The final
extracted distribution must retain third-party notices.

Do not copy pinned submodules, game artwork or catalog data into distributed assets. The user
explicitly excludes Draw Steel monster names from the MIT grant. Remove the catalog-backed name
lookup and supply an independent default name list; consumers can provide another dataset under
its own applicable rights/terms. Preserve source citations for
implemented mechanics without bundling the reference corpus.

First-release boundaries: supported dice, presets, reusable UI/presentation and collaborative rooms.
Full character/monster automation, shared campaign history, payments/accounts, arbitrary backend
implementations and arbitrary procedural 3D model generation are not prerequisites.

## 9. Implementation sequence and acceptance evidence

These are proposed Powerroller phases, not allocated Salient build slices. Each phase should produce
usable behavior and focused evidence; subsequent work must distinguish implementation from proof.

| Phase | Deliverable | Acceptance evidence |
| --- | --- | --- |
| P1: extract the baseline | Repository, explicit package boundaries and example site preserving existing 2d10 UI. Remove catalog/Salient deployment dependencies. | Clean checkout builds without Salient or reference corpora; separate consumer imports public exports; default UI comparison retains accepted layout. |
| P2: separate authority and presentation | Stable requests/accepted records, supplied-result path, independent availability events, guest/host identity policies. | Headless API request followed by persisted readback; retry, changed-input rejection and clear/reconnect behavior; rolling succeeds with no renderer/physics. |
| P3: general dice and presets | Mixed groups, modifiers, keep/drop, percentile semantics, cited Draw Steel modes, animated models for every advertised launch die and versioned presentation. | Source-derived rules cases; result/presentation agreement; all launch dice animate; graphics failure and non-stock models preserve usable text; bounded requests and payloads. |
| P4: accessibility and reusable UI | Complete summaries, reliable announcements, local motion control, optional high contrast and scoped styling. | Keyboard and actual screen-reader journeys; repeated/concurrent results; no lost focus; enlarged/reflow and no-WebGL operation; default appearance retained. |
| P5: site cache and Pages build | Site-owned preference/history module, reload reconciliation, standalone branding and hosting configuration. | Saved name/style/table/preferences survive reload; history deduplicates; expired table recovery; blocked/quota-limited storage fallback; correct project/custom-domain paths. |
| P6: independent deployment and release | User-created repository, dedicated Convex target in the user's account and standard Pages publication; README setup/adaptation guide and integration examples. npm publication deferred. | Fresh checkout and separate consumer use public exports and own component without copying internals; non-React example uses controller and imperative tray; two clients observe the same persisted result around shared resolution; package contents/dependency boundary and license provenance checked; publication commands recorded. |

Apply accessibility event boundaries during P2, not as a retrofit in P4. Keep the current UI usable
through every phase. The first extraction can retain 2d10 while the generic model is developed;
that milestone is not completion of the broader capability list.

Focused proof should catch these specific failures:

1. Result generation or delivery depends on a canvas, physics path or animation callback.
2. A retry generates twice, a supplied result is mislabelled as generated, or clearing removes retry
   protection within its supported window.
3. One room/participant can mutate another outside the chosen policy; public guest IDs act as secrets.
4. Mixed dice, kept/discarded results or percentiles produce misleading totals or explanations.
5. The same roller gets the same total twice and only one announcement is delivered; concurrent
   announcements overwrite each other; reconnect/cache restoration repeats old announcements.
6. Motion is visible before preferences load, another participant's roll ignores the local preference,
   or selecting text-only still makes graphics readiness a requirement.
7. Keyboard operation loses focus when clearing/resetting controls or closing menus; modal state
   makes essential status inaccessible.
8. At 200% text enlargement, 400% browser zoom or a short viewport, controls/results are unreachable.
   Check high contrast and forced colors as well as the normal theme.
9. A custom color obscures essential information, or a transient tray label is the only readable result.
10. Two mounted rollers interfere, leak a worker/listener/context, restyle the host page or hijack URLs.
11. Reload loses saved settings, restores the wrong table, duplicates history or fails when storage
    throws. A table-specific cache must not mix unrelated deployments/tables.
12. A fresh package consumer fails because an import secretly requires Salient files, generated content,
    a private endpoint or an undeclared frontend build assumption.

VoiceOver and NVDA checks require actual assistive technology, including sequential identical and
simultaneous rolls. Automated accessibility checks and DOM assertions supplement that evidence; they
cannot establish spoken delivery or practical usability. Rendering/motion/performance claims need
appropriate device evidence. No conformance or cross-device synchronization guarantee is assumed.

While work remains in Salient, use [the testing process](../testing-process.md): implementers run
authoring checks, the assigned coordinator runs broader jobs, and QC reviews the candidate. Focused
standalone browser checks are distinct from the table-testing moratorium. Reuse accepted tests for
publication; do not add deployment smoke runs solely because the environment changed. Establish an
explicit equivalent workflow in Powerroller when the repository is created.

Pin shared tools to the current Presidium baseline when implementation starts: Node 24.18.0,
pnpm 11.5.3, and Playwright 1.63.0 if browser tooling is included. Recheck the canonical baseline at
that time rather than silently introducing new tool versions.

## 10. Decisions to settle during implementation

The following do not block this plan and should be resolved only when their phase needs them:

- Verify access to `illos/powerroller` using the next session's updated token, and select the exact
  Powerroller Convex project/target in the existing account. Standard Pages hosting is settled;
  npm naming/publication can wait beyond this release.
- Carry the confirmed MIT authorization into the extracted source inventory and retain all required
  third-party notices; do not import previously proposed Owlbear GPL assets/code.
- Exact component exports and guest-session credential flow; shared-clear behavior if exposed.
  Equal participant roles are settled for the standalone site.
- Exact advertised stock model set and practical animated-pool limit, distinct from valid logical
  dice. Every advertised launch die needs animation; generic fallback is retained for other cases.
- Tune the shared reveal timestamp around roll resolution and avoid preference-dependent early
  disclosure; immediate availability is a host integration option, not the standalone site's default.
- High-contrast visual treatment, normal-theme contrast remediation and location of new preferences,
  reviewed while preserving the accepted default UI.
- Retention limits for request receipts, room cleanup and local history; a full shared archive remains
  optional rather than implied by browser persistence.
- Salient dependency versus maintained fork after the independent consumer proves the boundary.

No unresolved rules interpretation is introduced by this planning slice. Future mechanics questions
follow the project's source-and-question process. No runtime, browser or assistive-technology tests
were run for the two source surveys; this plan describes required evidence rather than asserting it.
