# Tray dice size and collision investigation

The owner requested dice approximately 15% larger and investigation of solid
collisions between every visible die, including concurrent rolls from one player.

## Size and immediate correction

The tray's previous model and local collision scale was 0.65. Throws of up to
six dice now use `0.65 * 1.15`, along with proportionally larger shadows. Above
six dice, the scale decreases by the square root of `6 / count`, with a minimum
scale of 0.5. The bonus d4 counts toward that total. This limits the pool's
footprint while keeping individual small throws larger. The shared sizing function in
`web/dice-demo-v2/dice-size.ts` also supplies initial and subsequent planner
warmups. Model geometry, fonts, textures, camera and authoritative results are
preserved. The customization preview retains its existing size. Each roll retains
its scale
when later rolls enter the tray; fixed obstacles carry their original roll's
scale so a smaller new pool still collides with larger previous dice. The solver
iterations and eight-second settling bound are unchanged.

`web/dice-demo-v2/resting-scene.ts` explicitly skipped the viewer's own previous
rolls. That exclusion is removed. Every completed, visible roll belonging to a
present participant can now contribute fixed collision hulls to a subsequent
throw, including multiple previous rolls from the same player. Cleared, expired,
missing-motion and absent-participant rolls remain excluded.

This corrects collisions with settled dice. It does not implement reciprocal
collisions between independently moving throws. A scene is captured when the
new throw is prepared; its obstacles remain fixed throughout that preparation.

## Why moving throws can intersect

The thrower's worker runs Cannon and records a complete path before submitting
the roll. `web/dice-demo-v2/renderer.ts` then replays an independent immutable
path for each player/roll ID. Concurrent recordings have no shared live world.
`restingScene` excludes unfinished rolls, and `web/dice-demo/physics.ts` creates
only static obstacle bodies for completed rolls.

Rendering overlapping rolls does not make their simulations interact. Adding
other recordings as kinematic bodies would produce one-way collisions: newer
dice could bounce, but the earlier dice would keep their original paths. That
would still fall short of reciprocal solid-body collisions.

## Proposed implementation for moving-roll collisions

Keep the existing Cannon solver and recorded playback, but coordinate complete
room scenes rather than independent roll recordings:

1. Track a canonical room scene revision containing all visible dice and their
   states, independent of the player who rolled them.
2. Reserve a common future cutover time before planning. Today the server assigns
   `startsAt` only after the worker has finished, so another moving path cannot
   be precisely aligned at preparation time.
3. Resume affected moving bodies from that scene, add the new throw and record
   their joint motion. Publish replacement future paths at the reserved cutover.
4. Accept the publication atomically against its expected scene revision.
   Simultaneous players must retry stale scene preparations instead of committing
   incompatible recordings.
5. Retain roll IDs, authoritative results, reveal receipts and the two-second
   follow-up gate. All viewers replay the accepted revision.

The final-face presentation requires an explicit design decision. Current
numbering offsets are chosen from a recording's final orientation. Replanning
an existing die can change its upper face: recomputing that offset during
playback could visibly change the printed numbers, while moving a revealed die
could leave its upper face inconsistent with its accepted result. A coordinated
implementation must preserve both printed labels and accepted results rather
than silently renumbering a die. This protocol work is not included in the
immediate size/settled-collision correction.

## Verification

- Typecheck and both production entry builds passed.
- Nine focused tests passed across resting-scene, bonus-d4 graphics and mixed-scale
  collisions. The collision regression checks exact cube separation through an
  entire recorded throw; deliberately shrinking the obstacle reproduces clipping.
- A Chromium fixture at a 430×932 viewport rendered the actual tray models for
  Power Roll, d20, d12, d8, d6 and d4. Vertex measurements confirmed enlarged
  scale, floor contact and containment. Six-, ten- and twenty-d20 pools retained
  every die inside the phone-sized tray at their respective scales.
- A Chromium app journey against the dedicated backend rolled 1d20 followed by
  20d20 after completion. Worker messages confirmed scales 0.7475 and 0.5, with
  the prior owner's larger obstacle retained. Persisted track readback included
  motion for both rolls and twenty faces for the second; both reached history
  with no page errors.

These browser checks used Chromium on the host, not a physical iPhone. The
performance investigation thread was updated with the count-based scaler and
its collision scope so earlier baseline measurements remain distinguishable.
