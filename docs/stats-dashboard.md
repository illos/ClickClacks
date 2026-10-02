# Activity dashboard

`stats.clickclacks.app` shows anonymous website/app traffic and multiplayer
activity. Convex Auth provides email/password sign-in for existing accounts. New account
creation is disabled in the backend and absent from the UI. Any signed-in account
can read the summaries. There are no roles,
invitations, verification emails or player login changes.

## Definitions

- **Visitors:** distinct browser cookies in the selected UTC day, month or all
  time. Website and app totals are separate. A browser returning on several days
  counts once for the month/all-time windows; monthly totals are not sums of daily
  visitors. New devices or cleared cookies count again.
- **Visits:** a browser entry in a fixed 30-minute UTC window, deduplicated across
  refreshes and tabs. This is our definition, distinct from Cloudflare Web
  Analytics' referrer-based definition. It does not count static asset requests.
- **Country:** Cloudflare's connection country for the visit. VPNs can affect it;
  unavailable countries appear as Unknown. Country charts show visits.
- **Multiplayer tables:** distinct room capabilities with at least two connected
  participants during the selected period. A table crossing midnight counts in
  each active day, once in its month and once all time.
- **Session:** an uninterrupted period with two or more connected participants.
  Falling below two ends it. Joining again starts another session at the same
  table. Average duration uses sessions completed in the selected period, including
  their full duration if they began earlier. Duration totals split at UTC boundaries.
- **Player arrivals:** players present when a multiplayer session starts, plus
  arrivals while it remains multiplayer. Refreshes, heartbeats and PiP sharing the
  same identity add no arrivals. This is not unique people.
- **Table size:** peak connected participants; average size is participant time
  divided by multiplayer table time.

The existing server-clock 30-second presence lease defines connection time.
Closing a tab can add up to 30 seconds; idle connected tabs count as connected.
Storage expiry is not play duration. Demo rooms use the reserved `de000000-`
UUID prefix and do not contribute gameplay stats. Demo iframes and popouts do not
contribute traffic. Initial pre-publication demo documents may be observed until
their old page is replaced. Summaries begin with publication, with no historical
backfill. Browser blocking/opt-outs and rejected requests can reduce traffic counts.

## Storage and cost

Traffic capture lives in the existing Cloudflare Workers and D1 database, in
separate `metrics_*` tables. The browser sends one small same-origin request on
page entry. Only hashes of random browser cookies, UTC periods and country counts
are stored; no IP, player name, URL, room code or roll content is recorded. The
HttpOnly cookie is shared between the website and app, expires after a year and is
renewed on entry. Do Not Track and Global Privacy Control are respected.

The atomic D1 batch and session INSERT trigger deduplicate refreshes. Daily country
totals survive indefinitely. Session deduplication rows expire after two days,
daily visitor markers after 90 days and monthly markers after two years. All-time
browser hashes remain for distinct-count deduplication.

Gameplay fields ride the existing room presence writes. Unchanged heartbeats do
not read or write counter rows. Membership changes, UTC boundaries and five-minute
flushes update 16 room-derived counter shards. A bounded minute cron handles
expired leases; room cleanup flushes before deletion. Summaries contain no room
or participant identifiers. Solo/local dice rolls add no analytics RPCs.

Dashboard refresh performs one authenticated Convex summary query (at most 16
shards) and indexed D1 summary reads. It does not poll. Counter durations can lag
up to five minutes plus the minute cron cadence.

## Publication

Use only Click Clacks' dedicated dev deployment `nautical-partridge-636`, never
the ambient Salient deployment/key. Set JWT_PRIVATE_KEY/JWKS using headless `jose`
key generation, with no keys in Git. Auth uses the deployment's .site issuer.

Apply additive `worker/migrations/0003_metrics.sql` to the existing
`clickclacks-bug-reports` database. Existing support records/tables are unchanged.
Both app and landing Workers bind it as METRICS; the stats Worker reads it after
Convex verifies the user's token. Build/publish app, landing and stats from pushed
main with `VITE_CONVEX_URL=https://nautical-partridge-636.convex.cloud`. Stats build:
`pnpm build:stats`; Worker config: `wrangler.stats.jsonc`.

## Acceptance

Accepted candidate `0d0e851` on 2026-10-02; final QC PASS. The coordinator ran a
detached private backend and three local Workers sharing disposable D1:

- Focused stats: **9/9 passed**, 363 ms. Changed Worker/schema regressions:
  **13/13 passed**, 427 ms (bug reports, canonical pages and V2 dice backend).
- Typecheck, private auth configuration/codegen and all three builds: **exit 0**.
- Exact `tests/browser-stats.mjs`: **exit 0**. Real account creation, password
  sign-in, incorrect-password refusal, anonymous API 401 and reload persistence;
  actual entry beacons, cookie refresh deduplication, country US, persisted
  multiplayer summaries, demo exclusion and unclipped 1280/360px screenshots.
- Natural presence expiry: **exit 0**, persisted session duration **29,906 ms**
  (observed closed after 40,052 ms). Backend and authenticated Worker summaries
  agree. An earlier diagnostic used a nonexistent field; its corrected targeted
  rerun supplies this evidence.

UTC day/month rollover and distinct browser period counts were proven against
persisted convex-test/SQLite state. Real wall-clock midnight and live-site
acceptance were not run. Artifacts are outside Git in
`powerroller/test-artifacts/stats-0d0e851/RESULT.md`; private services were stopped.
Publication reuses these results and requires only builds/deployment records.

## Publication result — 2026-10-02

Published from pushed main `b383599`, with runtime identical to accepted `0d0e851`:

- Dedicated **dev** `nautical-partridge-636`: headless auth configuration and
  `convex dev --once --env-file` both **exit 0**, unrelated ambient deployment key
  removed. Auth keys were not printed or committed. Backend ready at 20:48:45 UTC.
- Existing D1 `clickclacks-bug-reports`: only pending additive migration
  `0003_metrics.sql` applied, **exit 0** (eight SQL commands, 1.88 ms).
- Required app/landing/stats build sequence: **exit 0**, Vite phases
  343/282/92 ms. Landing retained the previously reviewed mixed-import warning.
- App Worker: **exit 0**, version `497eefb6-cb0e-4cff-a305-d2887d09b067`.
- Landing Worker: **exit 0**, version `25516ab2-5dda-404b-b41e-ca66038540dd`.
- Stats Worker: **exit 0**, version `90de77b7-a599-4201-b67d-b76ed98b34e1`;
  Wrangler confirmed `stats.clickclacks.app` as its custom domain.

The dashboard is at <https://stats.clickclacks.app>. Sign in with an existing email/password account; new registration is closed. Collection begins with this publication; test
records stayed in the isolated backend/D1. No live acceptance or post-publication
suite was run. Publication logs are outside Git in
`powerroller/test-artifacts/stats-publication-b383599/`.

## Registration closed — 2026-10-02

Owner requested closure after creating their account. Candidate `239d310`
restricts the password provider to sign-in and removes account creation from the
form. Existing users, credentials, sessions and auth keys are retained.

Focused coordinator acceptance and final QC passed: two persisted auth checks,
typecheck and stats build exit 0; same private backend/origin with a real account
and session seeded on the preceding version. The exact browser runner confirmed
new-email and existing-email registration refusal, retained prior session,
wrong-password refusal, original-password sign-in, reload and dashboard readback.
No live verification or broad suite was run. Evidence is outside Git in
`powerroller/test-artifacts/stats-signin-239d310/RESULT.md`.

Registration closure published from pushed main `4ccbe4e`, runtime identical to
accepted `239d310`. Dedicated dev backend deployment, stats build and stats Worker
publication all completed with exit 0 (fail-fast release sequence); backend ready
at 23:32:40 UTC and Vite build 95 ms. Stats Worker version
`4942fc2f-aeec-459c-a3e6-f93dc6148d9d` serves `stats.clickclacks.app` with the
sign-in-only form. Accepted coordinator/QC results were reused; no live checks or
suite reruns. Publication logs are outside Git in
`powerroller/test-artifacts/stats-signin-publication-4ccbe4e/`.
