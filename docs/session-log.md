# Session log and reconnect recovery

The owner confirmed that join notices are session-only. Newly observed live
participants produce a separate `[display name] joined` entry alongside dice
results, in the main log and compact tray history. An initial snapshot establishes
existing participants without announcing them as newcomers. A fresh room's own
first membership is an arrival. Heartbeats and profile edits do not add notices;
observed departure and rejoin do. The name is captured at arrival.

The log keeps up to 100 displayed entries. Notices remain in browser memory,
without backend writes, dice-result callbacks, receipts or disk history. Room
changes/reloads start a new session. Local/shared mode revisions clear notices,
while preserving a newcomer that caused the transition. The existing `historySince`
presentation boundary applies to all entry types; `Infinity` hides the entire log.
The demo can await `.join-log-entry[data-participant="<viewer>"]` before rolling.
Each mounted view establishes its own membership baseline. Opening PiP does not
copy notices that appeared before it opened; subsequent arrivals appear in both views.

A successful room heartbeat also dismisses the exact stale membership error
`Reconnect to this room before throwing.` Other errors retain their own recovery
requirements, including invalid private credentials.

Focused coordinator acceptance at runtime `40b8512`: membership tests 4/4,
typecheck/build exit 0, join-log browser PASS, and a 360px mixed-tray check PASS.
Recovery runner `ed42d21` preserved the session through 32.5 seconds of real
membership expiry, proved backend refusal, then read back recovered membership
and two persisted rolls. The reconnect alert disappeared; the unrelated credential
error remained after another successful heartbeat. The normal automatic-mode
journey passed with local zero-RPC rolls, shared persisted results and the full
ten-minute solo return. QC accepted these results and carried them to `6d07e55`.
Full evidence is retained outside Git at `test-artifacts/join-log-40b8512/RESULT.md`.

Earlier automatic-mode runs intermittently accepted logical results without
cosmetic motion after a canvas became visible. This remains a separate preparation
or readiness investigation. A warmed baseline passing does not prove the identical
failure predated this change, and a warmup is not a fix.

Published app source `6d07e55` on 2026-10-02, Worker
`d7810618-1639-4ec2-9d54-81b23f9911f1`, at `https://dice.clickclacks.app/`.
The required Cloudflare build and deployment both exited 0; accepted coordinator
results were reused. No backend deployment, broad suite or post-release test ran.
