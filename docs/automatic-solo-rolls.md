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
receipt, periodic server-clock sampling, or shared tray-clear mutation. A trusted
clock batch is retained at startup and foreground/reconnection so skewed computer
clocks cannot invalidate server presence; local playback has a separate epoch
estimate. Local roll history
stays in the session's memory. The original secure dice generator, Draw Steel
preset, generic/percentile arithmetic, recorded motion validator, reveal timing,
tray, audio and accessibility presentation are reused.

A mode revision invalidates the old local transport and its prepared requests.
The UI drops its old tray, log and announcements, retires delivery listeners and
resets the submission queue. A pending local preparation cannot submit to the
shared backend. Shared mode resamples the server clock and waits for delivery
readiness before enabling Roll. The same local transport lets PiP observe rolls
and clear the tray without joining a second participant or issuing roll RPCs.
Closing PiP leaves the opener's local transport usable.
The tray also owns presence observation while open; the opener's suspended clock
cannot repeatedly reset the tray's ten-minute solo-return delay. Local motion is retained
only while visible; request fingerprints and semantic retry results are bounded
and expire after one hour.

Authoring checks: focused automatic-session, native-client and clock-sync runs passed 23/23
tests, and `pnpm typecheck` exited 0 after copying the unchanged generated bindings
from main into the ignored worktree directories. No backend behavior/schema change, deployment or external publication is part of
this preparation. The shared recorded-motion validator uses an explicit TypeScript
import and type-only validator dependency so native Node can load the public client.
A child-process test imports the real public client with Node’s built-in TypeScript
support and completes a local roll without a browser or backend connection.

The test coordinator accepted `f106934` on 2026-10-02, using a detached checkout
and a private anonymous Convex backend. The evidence is outside Git at
`test-artifacts/automatic-local-f106934/RESULT.md`.

- Native Node public-client/local-roll regression: 1/1 passed; typecheck and site
  build exited 0. The unchanged earlier controller suite passed 41 files/197 tests
  on `519dc59` and was reused after source review of the import-only repair.
- The unmodified browser journey passed with zero clock skew and with client clocks
  two minutes ahead and behind. Solo text/3D/clear produced zero roll/clock/delivery
  RPCs and zero accepted backend records. Another participant switched both clients
  to shared; the persisted shared result matched both logs. After departure, mode
  remained shared at 599000ms and switched local at 600000ms; transition history
  was discarded and solo rolls again produced zero roll RPCs.
- Actual headful Chromium Document PiP passed rolls, shared clear, completed
  name/color edits, close/reopen and one-participant checks. A hidden opener did
  not reset the active tray's delay: peer departure returned local at 600000ms.
  Closing PiP restored usable main controls. Local rolls left zero accepted backend
  records and zero roll/delivery RPCs; PiP's first focus used one expected clock
  calibration batch. No page errors were recorded.

The first cold Vite preview attempt reloaded during lazy dependency optimization.
The unchanged runner passed after the preview settled, as did both skew runs;
a diagnostic fixed-delay variant was excluded from acceptance evidence. The fixture
advances only the delay clock, keeping server presence time independent. The final
integration rebase includes current Sharing styling and repository links without
changing the accepted rolling implementation.

Run coordinator commands from the committed worktree or its disposable test copy:

- `pnpm test` and `pnpm typecheck` (including `tests/native-client.test.ts`).
- `pnpm build`, with the isolated deployment's `VITE_CONVEX_URL`.
- `URL=http://127.0.0.1:<port>/powerroller/ node tests/browser-automatic-session.mjs`.
- Repeat that browser journey with `CLOCK_SKEW_MS=120000` and `CLOCK_SKEW_MS=-120000`.
- Run a narrow actual-site PiP journey against the same isolated backend: local
  rolls/clear appear in opener and tray, reopening preserves session delivery,
  completed name/design edits affect accepted local records, exactly one participant
  remains, and outbound roll/clock/delivery RPCs and server accepted events stay zero
  between the one-time foreground clock batches. Existing cloud-hardcoded scripts
  must be adapted outside Git rather than run unchanged.

QC's initial R1–R3 findings are addressed in preparation: trusted presence time is
separate from local playback, every local tap updates its current profile, and
the transport binds modifiers across controllers. Retired submissions also have
a generation-specific pending count, and an idle timer releases local motion and
expired requests. Source review passed `f106934`; coordinator runtime evidence
above proves those repairs, including the hidden-opener case.


## Publication — 2026-10-02

The owner approved publication after final Test and QC acceptance. Source
`0c711b1` was merged into standalone main and pushed to `illos/ClickClacks`.
The complete app build used `pnpm build:cloudflare` with the dedicated public
backend `https://nautical-partridge-636.convex.cloud`; it exited 0 and includes
build commit `0c711b10212f`. Wrangler 4.134.0 deployed `wrangler.bugs.jsonc`
successfully, preserving the app's bug-reporting bindings.

- Canonical app: <https://dice.clickclacks.app/>.
- Worker version: `47f8ca1d-7efe-41c8-8475-6cbc22753a66`.
- Deployment also reported the legacy `app.clickclacks.app` binding.
- Build/deployment logs:
  `test-artifacts/automatic-publication-0c711b1/`.

Publication reused the accepted tests above and changed only the frontend;
the dedicated Convex deployment continues providing presence and shared play.
The feature worktree and local/remote branch were retired safely after main
was pushed. The independently approved README prose commit `4e88591` was also
merged and pushed; its changes are documentation only.
