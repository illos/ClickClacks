# Automatic solo rolls

The owner confirmed automatic switching, with lightweight room presence retained,
an immediate switch when another participant joins, and ten continuous minutes
alone before returning from shared rolls to local rolls. Transition history can
be discarded; a short transition/loading state is acceptable.

The standalone site opts into `createAutomaticSession` and passes its instance to
the main roller and Document PiP tray. Reusable React consumers keep their existing
shared behavior unless they explicitly pass an `automaticSession`. Headless callers
can use the same session with `createController` and its `localTransport` method.

An initial room waits for live own membership, then selects local rolls if no other
participant is present. An unready newcomer still selects shared mode immediately.
Presence expiry uses the existing thirty-second lifetime. In shared mode, another
live participant resets the ten-minute delay. Unknown membership, a disconnected
socket or an expired own heartbeat clears the delay; fresh confirmed solo presence
starts a new full delay. Mode state belongs to the current browser session; a fresh
page load classifies the room again from current membership.

Solo play retains the existing ten-second membership heartbeat and room-view
subscription, plus explicit profile edits. It performs no server face sampling,
roll acceptance, motion upload/download, accepted-event history fetch, playback
receipt, server-clock sampling, or shared tray-clear mutation. Local roll history
stays in the session's memory. The original secure dice generator, Draw Steel
preset, generic/percentile arithmetic, recorded motion validator, reveal timing,
tray, audio and accessibility presentation are reused.

A mode revision invalidates the old local transport and its prepared requests.
The UI drops its old tray, log and announcements, retires delivery listeners and
resets the submission queue. A pending local preparation cannot submit to the
shared backend. Shared mode resamples the server clock and waits for delivery
readiness before enabling Roll. The same local transport lets PiP observe rolls
and clear the tray without joining a second participant or issuing roll RPCs.
Closing PiP leaves the opener's local transport usable. Local motion is retained
only while visible; request fingerprints and semantic retry results are bounded
and expire after one hour.

Authoring checks: the focused `tests/automatic-session.test.ts` run passed 11/11
tests, and `pnpm typecheck` exited 0 after copying the unchanged generated bindings
from main into the ignored worktree directories. No backend code/schema change,
deployment or external publication is part of this preparation.

Coordinator acceptance requested: the complete focused controller/cooldown suite,
site build, installed public API check if applicable, and the isolated-backend
`tests/browser-automatic-session.mjs` journey. That journey traces outbound RPC
names and reads server events back: local text/3D/clear must issue zero roll or
clock/delivery RPCs and leave zero accepted records; a second browser must switch
both to shared, produce matching persisted results, and return to local at the
full ten-minute deadline. Its fixture advances the delay clock without changing
server presence time. Actual Document PiP session sharing also needs coordinator
browser coverage. Accepted results and any limitations will be recorded here.
