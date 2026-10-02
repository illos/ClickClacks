# Cosmetic motion settling

The isolated diagnostic at `45e390e` reproduced a worker's face-bearing request
failing with `This throw did not settle. Try another throw.` Its immediate local
history readback contained the logical roll without motion. This establishes a
physics preparation failure for that case, independently of canvas readiness.
Evidence remains outside Git at `test-artifacts/motion-diagnostic-45e390e/RESULT.md`.
The earlier inspection after a 20-second timeout was inconclusive because local
history discards motion after its active tray deadline.

Motion preparation now makes at most three total attempts, using a fresh cosmetic
seed only after the typed nonsettling error. Each attempt keeps the same dice pool
and obstacles. Supplied faces are mapped once onto the successful motion; no new
authority sample or accepted roll is requested. Warm paths retain the same retry
bound and cache behavior. Other failures keep their original cause. Disposal and
the existing worker deadline still terminate pending work.

If preparation fails entirely, logical acceptance remains available. The UI reports
`3D motion could not be prepared. Your roll was saved as text.` after acceptance,
with the roll still appearing in the log. A later roll can try motion again.

Authoring: the actual worker's deterministic regression passed 3/3. Cosmetic seed
10 reproduces nonsettling at the current power-pair tray scale; seed 1 recovers.
The regression checks original supplied faces `[2, 9]`, warm-path reuse, exhaustion
after three attempts, later-job recovery and no retry for an unrelated failure.
Typecheck passed after restoring ignored generated client files in the worktree.
Coordinator browser and final QC acceptance are pending.
