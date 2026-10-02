# Standalone follow-up audit

This follows the clean literal extraction recorded in `extraction.md`. The source
implementation uses source revision `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b`.
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
stock-die picker, including the fixed percentile d100 pair and optional bonus d4.
Pure APIs cover mixed dice, keep/drop and cited
Draw Steel interpretations, and hosts can present already accepted results.
This is not completion of every proposed P3 collaborative capability.

Package publication to npm and future consumer integration are undecided.
Source consumption and the installable component are documented.
Normal-theme timestamp contrast debt
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

`a1055f6` merged and pushed to `main`. [Pages run 36821094341](https://github.com/illos/ClickClacks/actions/runs/36821094341)
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

Dice sound refinement: replaced the pitched 920/1760 Hz pair with short,
inharmonic 230/415/735 Hz body resonances and low noise. A stronger broadband
snap and higher filter cutoff sharpen the strike, while a shorter tail keeps
it dry. Peak normalization retains headroom. The three focused sound tests,
typecheck, and production build passed; subjective iPhone listening is pending.

Further clack tuning after owner listening: reduce the isolated treble tick and
sustain a broader midrange crack, with a 3ms secondary contact and more low-body
noise. The impact retains a fast attack, peak headroom and pool attenuation.
Three focused sound tests, typecheck and production build passed. Sound character
still relies on owner listening on the target device.

## Audio interruption recovery

Reported silence exposed an ignored browser state: unlock only resumed suspended
contexts, while iPhone Safari also uses interrupted after backgrounding or screen
locking. Unlock now resumes all non-running recoverable states and recreates a
closed context with a fresh buffer. Touch release also requests unlock, alongside
the Roll click and keyboard paths. MDN documents the Safari interrupted state:
https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state
This is a confirmed code gap; the owner's device-specific cause is not yet proven.

Four focused sound tests and typecheck passed. Expanded Chromium checks passed
real fresh-roll scheduling after preference reload, recovery from a real suspended
context with Safari's interrupted state simulated, finite non-silent waveform and
peak headroom, mute, historical silence, layout, and swatch checks. Production
build passed. Physical iPhone confirmation remains pending.

Owner clarified sound stayed enabled without leaving the page, so backgrounding
is not established as the trigger. A targeted path test passed landing detection
for d4/d6/d8/d10/d12/d20 across three seeds and an accepted 21-die bonus pool.
A dense d6 diagnostic seed did not settle (the planner's existing retry case);
no detector failure occurred on accepted paths. On-page silence remains
unreproduced; the recovery fix does not claim to establish its device cause.

## Wood reference and Safari tab-return recovery

Owner clarified silence occurs after Safari tab switching and survives reload,
requiring a new tab. WebKit reports matching tab-session failures:
https://bugs.webkit.org/show_bug.cgi?id=323104
Contexts now retire on visibility loss/pagehide and recreate on the next gesture.
On iOS Safari only, the owner-approved AudioSession workaround cycles ambient to
playback to refresh the browser's audio category. It restores the prior category
on backgrounding, mute, or disposal. Desktop Chrome/Safari/Firefox and other iOS
browsers receive no category override. Playback mode can pause other iOS device
music; this limitation was explained and the owner approved the scoped workaround.

The sound now follows measured Owlbear wood impacts, with four independent
synthesized variants. See dice-sound-reference.md for sources, method and values.
Wood is the current scope; wood/dice-on-dice mixing is queued.

Accepted checks: ten focused synthesis/session/lifecycle tests passed, including
wood energy-decay/headroom at 44.1/48 kHz, iOS Safari/iPad detection, desktop and
other-iOS-browser exclusion, category restoration/cancelled acquisition, and
background context retirement. Typecheck and production build passed. Expanded
Chromium verified fresh-context scheduling after simulated tab visibility return,
reload, interruption recovery, generated waveform, mute, historical silence and
existing tray/swatch behavior. Physical Safari recovery is not proven here.

## Dice-on-dice sound trial

Owner requested dice-on-dice instead of wood. Current impacts use an independent
synthesis informed by the already decoded Owlbear medium dice-collision clips:
sub-ms primary strike, smaller second contact at 8–12 ms, quiet residual body,
and treble-dominated spectrum near 6.4 kHz. Four variations and existing impact
volume/pool attenuation remain. The lowpass admits the new treble profile.
Reference measurements and provenance are in dice-sound-reference.md. No upstream
recording is shipped; wood remains source for a possible later combined design.

Six focused contact/lifecycle tests, typecheck and build passed. Chromium verified
live-roll scheduling, generated waveform, mute, reload, simulated tab return,
interruption recovery, historical silence and existing controls. Physical sound
character still needs the owner's listening check.

## Owner-supplied recorded clacks

Owner supplied a screen recording of Gliz Caldo's “Dice Roll Sound Effects”
(YouTube F4Kxnv3Hzmk), confirmed free use, and authorized clipping or synthesis.
The creator's description independently permits using the sounds without credit.
Four isolated initial contacts replace synthetic playback. Provenance and exact
cuts are in web/dice-demo-v2/audio/README.md; no full video is distributed.
Trimming, short boundary fades, DC removal and peak normalization preserve the
recorded sound. Each impact randomly chooses a clip with the existing small pitch
variation, gain and simultaneous-pool attenuation. Tonal filtering is removed.

Encoded clips cache across context recreation. Decode receives copies, preserving
bytes against browser input detachment; resampling overshoot is normalized to the
existing 0.9 source peak ceiling. Failed asset loads can retry. Playback waits for
buffers without marking a roll played prematurely; unlock rechecks current tracks.
The existing iOS Safari session recovery and recorded physics timing remain.

Accepted checks: typecheck, production build, 11 focused loader/session/impact
lifecycle tests and Chromium audio acceptance passed. Browser checks exercised
actual WAV decoding and a non-silent bounded waveform, saved toggle, mute,
historical silence, interrupted-context resume and fresh decoding after simulated
tab return. Physical iPhone playback and subjective listening remain user checks.

## Startup performance

Owner requested a faster visit-to-enabled-Roll time. Independent clock samples
now run concurrently, retaining all seven samples and the original fastest-three
estimator. Fonts download alongside renderer imports. The site supplies the
same classical name pool locally through the existing nameProvider extension,
removing the initial naming RPC. Initial membership publishes ready state in
one mutation; pending heartbeat readiness updates are queued. Roll waits for
acknowledged ready membership, and first-roll preparation reads the current tray
rather than a graphics flag captured before server requests completed.

Controlled compressed-build Chromium mobile comparison: median 2.789 → 2.064
seconds (26% improvement), three fresh contexts per build. Typecheck, production
build, three clock-sync tests and full/hidden-3D immediate-first-click journeys
passed. Persisted readback proved original animated motion on the first full-3D
roll and zero graphics imports for hidden 3D. Details, limits and reproduction
are in startup-performance.md. No physical-device performance claim is made.

## Critical results and small interaction refinements

Owner requested natural power 19/20 and single-d20 20 success labels, and double
ones / single-d20 1 failure labels. Modifiers and the bonus d4 do not determine
crits; multiple-d20 pools receive no crit treatment. The natural power success
reference is the canonical Compendium `en/books/heroes/md/rule/dice/natural-19-20.md`,
“Success With a Reward”. Failure and d20 labels are standalone owner display
policy. Existing totals, tiers and resolution remain; no extra actions are applied.
The pure `criticalResult` and `criticalLabel` helpers are exported by
`powerroller/format`. Tray flashes, saved history and accessible descriptions
derive labels from natural faces. Success/failure backgrounds, badges and totals
use the existing green/red palette. Short synthesized rising/falling result cues
play at reveal time alongside the recorded clacks, through the saved sound toggle
and existing cancellation/Safari lifecycle.

Both lightness sliders now capture taps and drags anywhere on the track, clamp
outside drags, release canceled pointers and retain native keyboard input. The
customization preview has a soft oval shadow beneath its transparent canvas.
The shadow does not capture pointer input or change geometry or materials.

Owner also requested follow-up rolls after two seconds. Frontend and component
share `rollCooldownMs`, measured from the previous throw's synchronized start;
animation duration no longer determines the lock. Pending submissions and
connection/readiness checks remain. A follow-up replaces that player's tray
presentation while retaining both history events and original retry receipts.
History now prefixes results with dice notation (`1d20 | 4` or
`2d10 | 3 + 9 = 12`), including an enabled bonus d4. Single unmodified dice do
not repeat their face as an equation. `rollDiceNotation` is exported by
`powerroller/format`; detailed accessible descriptions name the same pool.

Accepted checks: typecheck, production build and 17 focused unit/backend tests
passed. Chromium verified persisted cached crit labels, natural/modifier/bonus
exclusions, narrow history containment, actual planner/renderer success/failure
flashes, ordinary reset and four non-silent real AudioContext cues. Phone touch
checks verified both slider tracks, endpoints, cancellation and keyboard input.
The preview shadow was visually checked. Mock-clock backend readback proved
1,999ms rejection and exact 2,000ms acceptance during a five-second animation,
both history events, credential refusal and idempotent retries. Physical-device
audio, VoiceOver/NVDA and animation checks remain pending as previously agreed.
Chromium also observed Roll re-enabled 2,090ms after the persisted throw's start,
before its 3,633ms motion ended, and checked notation across power, d20, bonus
d4, multiple dice and a single unmodified d6 in cached history.

## Remember selected dice

Owner reversed the earlier decision to leave dice selection unsaved. The last
menu choice (Power roll or d4/d6/d8/d10/d12/d20) now uses existing browser
preferences and their memory fallback. The choice restores across reloads,
visits and table changes. Missing or invalid stored choices default to Power
roll. Dice count, bonus d4 and modifiers still reset as previously requested.
Typecheck, build and nine existing storage tests passed. Chromium verified d20
restoration on reload and in a new tab, restored Power selection and safe fallback
from a malformed stored choice.

## Tap-based cooldown, overlapping rolls and sound demo

Owner reported the earlier two-second lock took four seconds from pressing Roll.
It had begun at synchronized motion start, adding sampling/preparation first.
The UI now measures two seconds from the tap. A follow-up tapped while preparation
is still pending captures that tap's configuration and serializes its submission.
Server eligibility counts preparation using the previous immutable request's
creation time; a pruned receipt conservatively falls back to the old start time.

Owner clarified that subsequent rolls must play concurrently. Recorded paths now
have independent lanes per player/roll, using the original pose, materials,
shadows, reveal, hold and fade code. No-motion results do not clear older dice.
Clear and participant removal dispose every affected lane; normal fade disposes
expired geometry/textures/result elements. The client retains overlapping paths
for sound, rendering and obstacle preparation, pruning at their original expiry.

For reconnects and new observers, latest track readback also returns up to eight
compact active roll records. An optional `rollId` query retrieves one retained
path at a time, keeping large pools below the function result byte limit. The
indexed presentation creation boundary follows the current track's creation,
excluding cleared paths after a new throw. Compact history remains motion-free.

The owner requested a separate crit/fail listening demo. The static entry
`web/site/critical-sounds.html` alternates forced natural 19 and double ones, with
Crit/Crit fail mode buttons, mute and cue volume. It reuses the original planner,
renderer, recorded clacks and result cue scheduling. It reads saved die design
without writing preferences, joining rooms or recording history. The production
cue gain increased from 0.2 to 0.7; generated cue RMS is approximately 0.086, so
the previously quiet accent is now 3.5 times louder. Clack volume stays the same.

Accepted checks: typecheck and production build, 20 focused cooldown/audio/crit
tests plus 15 existing component/client contract tests passed. Chromium measured
2,019ms from tap to enabled Roll, before the recorded 4,500ms animation ended.
Renderer fixtures proved independent same-owner and peer animation/reveal, owner
clear/removal, normal fade disposal and no old-lane resurrection. Crit/history
fixtures and actual AudioContext cues passed with the updated renderer. Demo
checks exercised forced success/failure, volume, mute and unchanged preferences.
Backend persisted readback covered overlapping compact records, individual path
fetch, bounded results, clear/new-track boundaries, credentials and retries.
The complete delayed-preparation/second-tap/fresh-observer journey is authored in
`tests/browser-overlapping-rolls.mjs` for the updated backend. Physical iOS audio
and the previously agreed accessibility/device release checks remain pending.

## Private listening preview

Owner requested Tailscale hosting after the public sound demo failed to load.
The multiple-entry production build had emitted renderer/font helpers that
imported the main application entry. That entry tried to mount its React root
on the demo document, producing React error 299 before demo initialization.
Earlier demo checks had exercised the unbundled development server; they did
not catch this built-page dependency error.

The normal production build again has only its original site entry. The sound
demo builds independently with `examples/critical-sounds/vite.config.ts` into
ignored `.preview/critical-sounds`, outside the public artifact. It serves over
a dedicated Tailscale HTTPS endpoint backed by a loopback-only preview server.
No backend or roll behavior changed in this correction.

Typecheck, isolated demo build and normal site build passed. The actual built
Tailscale page loaded its canvas and enabled Roll without startup errors;
alternating forced natural success/failure played distinct non-silent buffers,
volume and mute worked, and preferences stayed unchanged. The regression journey
is `tests/browser-critical-sound-preview.mjs`. Production output was checked to
exclude the demo HTML.

## Approved result sounds

The owner approved the exact CPhT Fluke sword-draw recording and the original
dark-impact fail from the private audition for production on 2026-10-01.
Both are now WAV assets in the normal site's audio player; source/provenance is
recorded in `web/dice-demo-v2/audio/README.md`. The fail waveform matches the
approved synthesis within 16-bit PCM quantization. The separate result sounds
retain reveal timing, gain 0.7, mute, owned cancellation and no history playback.
Encoded bytes are cached, while each audio session decodes independent copies
to preserve Safari interruption recovery. A missing result clip leaves the
recorded landing clacks working and retries on a later activation.

Typecheck, normal site build and isolated listening build passed. Thirteen focused
audio/session/asset tests passed, including detaching decode buffers and fetch
retry. The built listening demo now exercises the default production player;
Chromium confirmed the actual .768s sword and 1.3s fail buffers at reveal, volume,
mute, unchanged preferences and no startup errors. No backend change is needed.

## Live floating tray and log movement

The owner requested promotion of peer PiP prototype f619cd2: a top-menu icon only
on supported desktop browsers, the original tray and controls, and the six most
recent revealed rolls behind the dice. There is no alternate popup fallback.
`web/site/popout.ts` opens Document Picture-in-Picture and boots the original site
inside the same-origin tray iframe. It shares the current table and participant
instead of claiming a second tab identity. Controls and the two-second roll gate
stay synchronized between windows in memory; counts, modifiers and bonus dice
are not persisted. Profile/preferences changes synchronize through browser storage.
The opener pauses its heartbeat/customization and audio while PiP is active, so
one player and one audio owner remain. Closing restores the normal player; table
departure closes the floating window. Startup failures retain a visible error and
support retry. The tested iframe-focus readiness fix from peer6319529 is included:
focusing an already-visible iframe refreshes clock samples without disabling Roll
between pointerdown and click. Background/disconnect still invalidate the clock.

The main log retains its existing history limit and row contents. New rows and
displaced rows slide down over 360ms; rows stay fully opaque, with a 48px bottom
viewport fade only when more scroll content remains. Reaching the bottom removes
that mask. Reduced motion and high contrast are respected by both log displays.
The production build has separate site and PiP entry graphs and publishes the
floating entry under `pip/`, keeping auxiliary startup out of the main entry.

Typecheck, both production entry builds and five clock tests passed. The built
headed Chromium journey in `tests/browser-live-popout.mjs` passed: seven real
rolls with persisted readback, one table member, synchronized controls/design/
cooldown, one audio owner, six overlay rows and all main rows, vertical containment,
slide movement and bottom-only fading, reduced-motion/high-contrast, close/reopen,
table departure, hidden icon on mobile/unsupported browsers and failed-module retry.


### Mini-player settings integration (2026-10-01)

Copied the approved `7a55112` cog, Sharing/Dice tabs and compact spacing into the
live PiP renderer. Applied `d1fe6d5` to keep the participant counter at its
original top-left position (`top:12px; left:14px`). The same menu handlers implement name/design/accessibility and
joining/leaving tables. The PiP session now forwards table changes to its opener
and builds invite links from the full site URL, preventing the floating player
from switching tables independently. Table changes close the current floating
window; reopening follows the main page. The standalone embed route remains a
private preview and is excluded from this production build.

Authoring checks: `pnpm typecheck` and both production builds passed.
`tests/browser-live-mini-settings.mjs` passed against the built native Document
PiP entry: tabs/keyboard/Escape/focus, canonical links, name/design/preferences
shared with the main page and persisted readback, 360×320 icon spacing and
scrollable settings, reopen defaults, and PiP-originated join/leave switching the
main table with old/new membership readback. No page errors. Reused the peer's
accepted iframe menu proof; no backend change or deployment.


### Profile synchronization feedback repair (2026-10-01)

User reported continuous color alternation after dragging the color wheel on
Helium, Zen and iOS Safari, with discrete clicks unaffected. `2b98d63` introduced
an incoming profile effect for PiP synchronization alongside the existing
outgoing effect that saved every profile state change. Received snapshots could
therefore be emitted back through the browser-storage/host pipeline.

`4e224b4` removes that outgoing effect. Only local design/name changes and generated
initial names notify the host; incoming host/storage/PiP snapshots update the
profile and its immediate ref without emitting a save. Pointer handlers read the
current ref so rapid moves retain the latest local value. No color-wheel layout,
color math or backend behavior changed.

Before the fix, a real external storage update caused an unwanted profile echo
(writer count 41→42). The exact sustained flicker was not reproduced on the local
Chromium host. After the fix, `tests/browser-profile-sync.mjs` passed against the
built combined release: real captured drag plus 100 queued moves settled at
`#4edc23`, 41 writes stayed at 41 after release; parent/PiP received external
name/color changes without extra writes; generated/local names persisted; one
local name edit emitted one write under StrictMode; reload restored final values.
Both builds and typecheck passed. The narrow native mini-settings journey passed
again with the repaired handlers and restored counter position.


### System / Light / Dark appearance (2026-10-02)

Owner requested a light theme and mode switcher defaulting to the device. Added
validated local preference `theme` (`system`, `light`, `dark`), with missing/invalid
values falling back to System without changing existing profiles/settings. The
header offers an icon menu; the customization and mini Dice settings offer native
radio controls. System follows `prefers-color-scheme` changes; explicit overrides
remain fixed. Preference/storage events sync the main page and PiP. The early head
bootstrap applies saved/device appearance before the app bundle paints, including
when storage is blocked. The popout shell and browser theme-color follow too.

Light mode uses warm off-white surfaces/graphite text and readable mint/coral
status colors. The existing dark palette is preserved. Menus/dialogs, controls,
history, crit labels/results, and high contrast have light variants. The logo
keeps its geometry/accents with a darker foreground. The WebGL tray clear color
updates in place; PiP retains alpha transparency. No physics, result generation,
roll timing, dice design, table or history behavior changes. `preferences.theme`
also exposes the choice through the existing React API.

Validation: `pnpm typecheck`, both production builds, and focused storage tests
(10 passed). Built headed Chromium `tests/browser-theme.mjs` passed: System/default
and live OS changes; explicit choices and reload before bundle execution; profile
retention; keyboard/focus; light dialogs/dice picker/high contrast; retained canvas;
changing theme during a real d6 roll preserves the final log result; native PiP
two-way theme sync and compact settings; header/menu fit at 1280×900, 430×932,
320×568 and 320×225; no page errors. Visual checks also inspected 320px menus/design
and 360×320 native PiP. Firefox/WebKit checks could not launch because host GUI/
media libraries are absent; these attempts are not browser passes. Physical
iOS/Safari and assistive-technology checks remain pending as previously approved.
