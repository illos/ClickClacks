# Roll response time

Owner reports a 3–4 second wait from tapping Roll to seeing dice, longer on a phone
than a MacBook. Investigation starts from published `d6cbaee` (runtime `847dbbf`).

## Live baseline

The Test coordinator measured eight rolls in a fresh Chromium context at the live
Pages URL, using device motion with no OS reduced-motion preference. Screenshot
frames showed first visible dice 1122–1427 ms after clicking; result/log reveal was
2162–5396 ms. This environment does not establish physical iPhone or MacBook timing.
The owner's longer observed delay remains a valid device-specific report.

Click-relative stage ranges: profile response 178–314 ms; sampling response
469–652 ms; worker round trip below 2 ms (planning 0–0.2 ms); acceptance response
681–1026 ms; metadata arrival 773–1033 ms; motion arrival 972–1222 ms. Sampling,
preparation and acceptance remain sequential; this baseline's warmed worker was
not the dominant delay. Separate reduced-motion behavior intentionally hides the
numbered dice until the recorded result reveal and must not be mistaken for full
animation start.

Artifacts: `test-artifacts/live-roll-latency-2026-10-02/summary.json`,
`visual-analysis.json`, screenshot frames and method/timestamp-only captures,
outside Git.

## Implemented changes

- Reuse the server's accepted recording in the existing bounded motion cache.
  Decode it once. If an earlier subscribed hydration is waiting on a download,
  renew only its latest still-current track revision. Clear, departure, epoch and
  subscription replacement guards prevent the response from restoring removed dice.
- Skip the profile write on ordinary taps only when the authoritative participant
  exactly matches the tap's full name/style, the current local profile still
  matches, and no debounce timer or profile mutation is pending. Editing and queued
  taps retain the explicit write. Secure sampling and server acceptance remain.

Shared startsAt, revealAt, secure faces, recorded physics, reduced motion,
collisions, cooldown, retry IDs and final results retain their existing behavior.
Compare candidate and baseline against the same backend and rendering environment
before attributing a speedup. No physical-phone FPS or latency claim is implied.

## Reconnect recovery follow-up

Implemented after the performance work: “Reconnect to this room before throwing.”
now includes an adjacent Reload button in the main alert and dialog alerts. It
reloads the button's own document, preserving the room URL and supporting an iframe
or pop-out tray. A 44-pixel minimum target supports touch. The recovery alert is
brought into view before painting inside long, scrollable dialogs without moving
keyboard focus.

Runtime `c791167` passed desktop main/social-dialog and mobile main recovery checks,
keyboard activation, and the unrelated-error negative check. The phone customizer
initially placed the action below its viewport. Targeted `1e1e1c9` checking then
proved initial visibility, unchanged color-wheel focus, same-room reload, recovered
Roll and a new result in the log; exit 0 and no page errors. TypeScript and
independent read-only review passed. Checks used an isolated browser event fixture
that passes coded errors through the existing displayError/state path; the fixture
was not included in the production source. Evidence is outside Git under
`test-artifacts/reconnect-reload-c791167/`, including `revised/` screenshots/JSON.

## Candidate acceptance

Runtime candidate `a4badba` passed TypeScript checking, 23 focused client tests
(including four new cache/clear/departure regressions) and independent read-only
review. The first authoring typecheck lacked ignored Convex bindings; copying the
unchanged generated bindings from main allowed the complete typecheck to pass.
No backend implementation changed.

The Test coordinator built baseline `d6cbaee` and candidate `a4badba` into separate
private static previews, both using the dedicated live backend. Each used a fresh
Chromium context, 1280×720 viewport, DPR 1, fixed solid/modern profile, device motion
and OS reduced motion off. First visible was approximated from screencast changes
in the dice region and checked against representative frames.

| Roll | Baseline first visible | Candidate first visible |
| --- | ---: | ---: |
| Power first | 1600 ms | 883 ms |
| Power warm | 1802 ms | 942 ms |
| d20 first | 1227 ms | 1310 ms |
| d20 warm | 1265 ms | 815 ms |

The combined four-roll median is 1432.5→912.5 ms (about 36% lower). This is a small
lab sample with network and throw variation; the first d20 was slightly slower,
and it does not establish physical-phone performance or a population estimate.
Ordinary unchanged profile saves fell from four of four taps to zero of four.
Both browser runs exited 0 with no page errors.

An immediate name edit plus bonus-d4 roll still sent its required profile write
before sampling. The accepted name, `1d20 + 1d4` configuration and final result
persisted across reload. Evidence and method are in
`test-artifacts/latency-compare-a4badba/RESULT.md`, with per-source JSON and frames,
outside Git. Accepted checks are reused for publication; the original one-hour
soak remains on its older frozen V1 runtime and is not evidence for this patch.
