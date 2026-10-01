# Standalone follow-up audit

This follows the clean literal extraction recorded in `extraction.md`. The source
implementation remains Salient V272, `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b`.
The owner's subsequent instructions authorize variable dice, classical names,
removal of the Source link, and collapsed accessibility controls. Default Power
Roll layout, models, material pipeline and recorded physics remain the baseline.

## Changes justified by the extraction plan

| Requirement | Adaptation |
| --- | --- |
| Independent module imports | Source entry points for pure dice, Draw Steel presets, client, optional Three, React, formatter and scoped CSS. No site initialization on import. |
| Independent authority | Component contains moved original functions; app wrappers preserve endpoint names. Generated faces bind to private session and stable request. Supplied results require a trusted host wrapper. |
| Retry and cleanup | Indexed retained request receipts survive shared clear/replacement. Meaningful input changes reject retries. Room/session/receipt cleanup is bounded and scheduled. |
| Text independent of animation | Shared availability time comes from the original recorded-path reveal calculation. Controller timers deliver results without canvas/worker callbacks. Hidden graphics skip renderer and physics imports. |
| Reusable lifecycle | Per-instance room/context/controller/planner. No import-time URL mutation, ambient endpoint, CSS side effects or worker allocation. Host supplies connection, identity, name/profile, room and callbacks. |
| Browser persistence outside library | `web/site/` owns URL routing, private tab identity, preferences and compact IndexedDB history partitioned by deployment/table. Invalid or blocked storage falls back safely. |
| Accessibility | Approved closed section; local device/reduced/full motion, hide 3D, contrast and announcement choice. Detailed HTML descriptions and serialized semantic announcements. Decorative profile remains unchanged. |
| Requested variable dice | Original physics generalized by die stride and hull; all stock models use original materials/fonts/patterns. Power roll uses the original logical d10; generic d10 is a trapezohedron. Count 1–20 is an animation/backend bound, distinct from the pure generator's 100-die limit. |
| Standalone names/title | Greek/Roman default pool; title only Power Roller. No catalog or reference corpus copied. |
| Hosting | Existing Actions Pages publication, explicit dedicated dev Convex target, original font licenses and project-base worker/asset paths. |

These are targeted extensions of the copied source. The default power-roll
solver branch retains its original parameters, entry path, random consumption,
camera, lighting, scales and recorded 60Hz playback. Larger recorded paths use a
Float64 transfer buffer; this changes transport representation, not frame rate.

## Scope and open questions

See `api-coverage.md` for exact API coverage. The plan's broader collaborative
mixed groups, alternate rulesets, context metadata and logical pools above 20
are queued by the owner for a later release; the current community UI follows the owner's requested
stock-die picker. Pure APIs cover mixed dice, keep/drop, percentiles and cited
Draw Steel interpretations, and hosts can present already accepted results.
This is not completion of every proposed P3 collaborative capability.

Package publication to npm and future Salient dependency versus fork are
undecided. Source consumption and the installable component are documented;
no Salient integration is changed here. Normal-theme timestamp contrast debt
remains; opt-in high contrast does not imply normal-theme conformance.

Actual VoiceOver/NVDA delivery and physical-device animation/performance remain
pending under the owner's publication waiver. Browser/DOM evidence cannot replace
those checks or establish WCAG conformance.

## Verification

Authoring typecheck passed. Initial combined suite: 10 files, 59 tests passed.
Backend component-focused checks: original/authority tests 8 passed and component
TypeScript passed. Production build with the explicit dedicated public endpoint
includes separately loaded renderer, preview, physics worker and all four fonts.
Final focused browser and consumer results will be recorded with the release.

Host asset overrides are explicit: `loadDiceFonts(customSources)` accepts per-font
URLs; `createThrowPlanner({workerFactory})` accepts a host-managed worker factory.
Defaults retain the copied bundled font/worker URLs. Vite's project-base setting
can be overridden for a custom-domain build without changing application source.

Focused Chromium acceptance on the dedicated dev backend passed: two contexts
observed the same persisted power faces/total, all six stock models accepted
recorded paths, seven cached log entries survived reload, and a motionless roll
reached a full-3D peer without errors. Fresh hidden-3D boot requested no graphics
or physics modules. Name/style/preferences restored; Arrow/Escape menu handling
and dialog focus return passed. Two mounted rollers retained host styling and
independent selections without duplicate IDs or graphics loading.

A 320×225 viewport exposes the copied layout's short-height clipping. The owner approved the concrete vertical-wrap preview; the short-height fix is now implemented.
Normal 390×844 and 640×450 layouts have no horizontal overflow and reachable Roll.
Real assistive technology and physical devices remain pending, not simulated.

The packed artifact was installed into an independent temporary consumer. Its
core/client build rejected React, Three, Cannon and CSS imports; its optional
Three build rejected React/CSS imports. Both built successfully. Installed
component source and the consumer typechecked. Generated component bindings are
included in artifacts, never committed. npm publication is not part of this release.

## Publication record

`a1055f6` merged and pushed to `main`. [Pages run 36821094341](https://github.com/illos/powerroller/actions/runs/36821094341)
completed successfully; the live HTML served its new built asset and Power Roller
title. The deployment coordinator applied the exact main commit to dedicated dev
`nautical-partridge-636`; Convex codegen, TypeScript and schema validation passed.
Only the disposable component request table was cleared (11 development records)
to apply the compact receipt schema, with empty persisted readback confirmed.
No other tables were reset. Accepted test results were reused for publication.

The separately installed package consumer's actual Convex codegen also passed,
without deploying that consumer. Both component installation and public package
entry imports are now proven independently of this repository's app fixture.
Broader collaborative modes remain queued by the owner. The owner subsequently approved the short-height visual fix; see the follow-up below.

Release closeout corrected saved-room recovery and quota fallback. Focused browser
readback proved an invalid saved code recovers a new joinable room, while an
explicit invite takes precedence; no visible errors. Controlled host preference
changes mounted/disposed the canvas as requested. Storage tests: 8 passed,
including quota-limited writes with readable storage. Typecheck and production
build passed. The site entry now consumes the public package exports directly.


## Approved short-height and picker treatment

The owner approved short-height scrolling and requested a slightly darker dice
selection segment with a small divider. At viewport heights up to 450px, the
existing page flows vertically with a 180px tray and wrapped controls. Taller
viewports retain the original grid arrangement. The selection segment has a 12%
black overlay and an inset 1px divider; Roll retains its chosen background.

Focused Chromium checks passed at 320×225 and 640×450: modifier, picker and dice
count controls are reachable by vertical scrolling, count changes work and no
horizontal page overflow occurs. At 390×844 and 1280×900 the original grid remains.
The picker styling was verified at all four sizes. Production build passed.


## Modifier cycles and icon follow-up

Per the owner's request, generic bonus/penalty controls now display signed zero
and cycle independently through 0, 2, 5 and back to zero. The existing 0–2 request
stages map to those magnitudes; the accepted modifier is bonus minus penalty.
Prior accepted receipts retain their original totals on retries. Power roll's
edge/bane arithmetic and controls are unchanged.

Power roll uses the d20 SVG. The d6 icon has five pips, the d12 has nested
pentagons joined at their vertices, and the d4 has three corner-to-center lines.
The picker divider now spans the button's full height. These are control icons;
the existing 3D material, numbering and physics pipelines are unchanged.

Focused backend tests passed (11), covering persisted 0/±2/±5, cancellation,
mixed bonus/penalty magnitudes and retained retry behavior. Focused Chromium
checks passed for both full cycles, focus retention, power controls, icon SVGs
and divider height. Typecheck and production build passed.

## Phone history and color wheel follow-up

Long (20-die) equations now wrap within the history panel; its scroll container
accepts vertical panning and pinch zoom, with horizontal overflow suppressed.
The short-height layout still scrolls the page to reach the history. Focused
Chromium checks passed at 430×932 (iPhone 15 Plus sized), 390×844, 320×225 and
1280×900, including long equations, no horizontal overflow and vertical scrolling.
WebKit could not launch because host browser libraries are missing; physical
Safari confirmation remains pending.

At the owner's request, a touch/keyboard color wheel replaces hue/saturation
sliders. One lightness slider preserves black/white and darker shades. Dice and
number colors retain separate values and the existing profile/preview pipeline.
The d6 icon is now a cube with three visible faces and pips. Focused Chromium
checks passed for touch selection, keyboard hue changes, separate color targets,
black/white endpoints and the cube icon. Typecheck and production build passed.

## Current designs in history avatars

History avatars now use the viewer's current local profile or the roller's
current room profile, falling back to the recorded design for absent members.
This updates avatar color, ink and font immediately without altering roll
receipts or results. A focused two-viewer Chromium journey passed: an existing
entry updates in settings and on the peer, retains its result, and shows the
current design after reloading cached history. Typecheck and build passed.

## Design swatches and menu close controls

Pattern and font dropdowns are replaced by selectable swatches. Pattern samples
reuse the unchanged original procedural decoration painter, with current dice
and ink colors. Font samples render SVG “01” with the existing fonts and colors;
fonts load when customization opens, including with hidden 3D. Both menu headers
stay visible while scrolling so their close buttons remain reachable.
Focused Chromium checks passed at 430×932, 390×844 and 320×225 for all selections,
live pattern colors, distinct samples, loaded fonts and close-button reachability.
The existing two-viewer history-avatar check also passed. Typecheck/build passed.

## Bonus d4, Power Roll icon and design tabs

Generic d20/d12/d10/d8/d6 controls now include a +1d4 toggle before the positive
modifier. It adds one d4 after the base pool (up to 20 base dice plus one d4),
using the current material/font and its own tetrahedral model, hull, numbering,
resting collisions and recorded motion. The extra face contributes to the
semantic total. Power roll and base d4 exclude the toggle. The flag is part of
stable request identity; absent/false normalize equivalently. CLI uses
`--bonus-d4 true`; formatted text identifies the two dice types.

Power Roll uses two outlined d20 icons marked “10”. Touch selection suppresses
the selector's persistent focus outline; keyboard focus stays visible. Dice
customization now has one divided pill: Die color, Text color, Design. Color
editing retains channel intent across tabs; Design contains the pattern/font
swatches. Tabs support arrow/Home/End keys and native selected-panel semantics.

Accepted checks: 28 backend/client/config tests; eight mixed-graphics checks
(including 2d20+1d4, 20d20+1d4, diamond d10+1d4 and 21-track binary roundtrip);
two original power physics checks; seven format/core checks. Root typecheck
and build passed. Focused Chromium controls passed at 430×932, 390×844,
320×225 and desktop, including toggle placement/exclusion and touch-vs-keyboard
focus. Updated swatch/color/history checks passed after the tabs change.
Dedicated-dev two-viewer acceptance passed animated d20+1d4 and d10+1d4,
text-only d6+1d4 with +2, toggled-off d6, persisted face bounds/totals/motion,
and four cached results after reload. No physical Safari claim is made.

## D4 numeral legibility

D4 corner numerals grow from 42px to 64px in the 256px face texture, with labels
inset further from the vertices. This applies to standalone and bonus d4 dice.
A focused Chromium raster check confirmed all numeral pixels fit inside every
triangular face for Original, Serif, Modern, Rune and Gothic. The texture sheet
and a 430×932 rendered phone roll were visually inspected. Production build
passed. Geometry, vertex result mapping and physical motion are unchanged.

## Leaving tables and mobile controls

The social menu has Leave table, which removes membership and the current dice
track through the existing leave API and opens a fresh solo table. Joining a
different table also removes old membership. Invalid/unavailable short codes
leave the current table intact. Started heartbeat/profile writes finish before
leaving, and new ones pause during the transition. Current profile and local
accessibility preferences carry across room remounts; dice selection remains
unsaved as requested.

Focused two-viewer browser verification passed old-room membership/track
readback, no reconnection after the 10-second heartbeat interval, isolated solo
history, saved new-room reload, retained name/design, and rejoining the original
table with archived history. The lightness slider now has a 44px-high touch area
and a wider, taller handle. Existing color-wheel checks passed; mobile layout
was visually inspected. Pressing Roll closes an open dice picker immediately.
Typecheck and production build passed.

## Optional dice sounds and Frosted preview

The tray's top-right sound toggle saves its opt-in state with local browser
preferences. The eraser sits immediately to its left. Web Audio generates short
plastic-on-wood clacks without a third-party recording. Landing/bounce impulses
are detected from the same recorded frame path the tray replays and scheduled
against its shared clock; quiet settling is ignored. Reduced/hidden motion uses
a single clack at result reveal. Audio unlocks on interaction, stays cosmetic if
unsupported, and cancels on mute, tray clear, backgrounding, or table unmount.
Historical/missed impacts are not replayed. Dense pools attenuate simultaneous
clacks. No backend or shared roll data changes are required.

Frosted's pattern swatch adds a linear preview of the existing shader's quadratic
rim glow, using its 0.85 mix toward linear-light 1.8. The original fine grain is
painted over that gradient; other swatches and actual dice rendering retain the
existing behavior.

Accepted checks: 12 focused sound/storage tests passed, including recorded bounce
frames, mixed-pool timing, shared-clock scheduling, deduplication, mute/background
cancellation, and saved-boolean validation. Typecheck and production build passed.
Focused Chromium on a 430×932 touch viewport verified real AudioContext scheduling
on live rolls, mute, preference reload, no history audio, separate right-aligned
tray actions, and Frosted-versus-Solid pixels with no page errors. Mobile screenshots
were inspected. Actual iPhone sound quality/autoplay behavior remains a device check.
