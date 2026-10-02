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

Authoring checks: `tests/membership-log.test.ts` passed 4/4 and typecheck passed.
Focused coordinator acceptance covers real membership loss/heartbeat recovery,
unrelated-error preservation, two-client join notices and persisted dice readback,
mode-transition notices, and a compact-tray visual check. No broad suite repeat
is required for this change.
