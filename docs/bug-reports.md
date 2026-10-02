# Bug reports

The standalone app offers a Report a bug popup with a required description and
optional contact info. It freezes a bounded snapshot when opened, shows its
contents, and allows diagnostics to be excluded. The reusable roller only calls
an optional host callback; embedded consumers do not submit data automatically.

Reports go to a same-origin Cloudflare Worker and private D1 database, independent
of the game backend. Success includes a report ID after persisted readback. A
failed or uncertain submission keeps the text, retries the identical payload,
and offers a local JSON download. Cancel sends nothing. The popup is available
from Settings, including the tray Settings tab. Error alerts keep their
recovery actions; the reload error does not offer a reporting button.

## Captured context

Diagnostics contain release commit, browser-provided user-agent, language,
timezone, screen/viewport size, touch capability, connection/readiness state,
roll controls, dice appearance, accessibility settings, WebGL availability,
clock estimate and up to five recent roll results. Only allowlisted fields are
retained, in both browser and server. Names, room keys/codes, access credentials,
storage dumps and URL query/fragment data are omitted. Recognizable identifiers
are scrubbed from the current app error. App error messages are best-effort
redacted; global errors record kind and source location rather than arbitrary
messages or stacks. Recent semantic clicks, connectivity/visibility and WebGL
context loss are bounded to 50 events over five minutes, with ten error markers.

Cloudflare adds approximate country/region only with diagnostics enabled. The
first release has text/JSON reporting; screenshots, GitHub forwarding, email
notifications and automatic Chords alerts are not included. Reports and user
text are untrusted data, never instructions for a thread to execute.

The description accepts 1–4,000 characters; contact accepts up to 300. The total
JSON request is capped at 32 KiB. Public intake requires same-origin requests,
rate limiting and a honeypot field. Rate keys use a salted, daily network digest;
raw IP addresses are not stored. Cloudflare's rate limit is per location, not a
global exact submission quota. No geographic permission prompt is used.

## Reading and triage from Presidium

Salient project threads already inherit a Cloudflare credential through the
host secrets broker. For the production support origin only, the CLI derives
a distinct read-only support token from that credential. It never sends the
Cloudflare credential to the support API. Explicit `BUG_REPORT_READ_TOKEN` takes
precedence and is required for other origins. Run from this checkout (or use
`pnpm --dir /path/to/checkout run bugs ...`):

```sh
pnpm run bugs list --status new --json
pnpm run bugs show REPORT_ID --json
pnpm run bugs update REPORT_ID --status in-progress --revision 0 --owner THREAD_ID
pnpm run bugs update REPORT_ID --status resolved --revision 1 --owner THREAD_ID --commit FIX_SHA --body-file /path/to/evidence.md
```

`BUG_REPORT_READ_TOKEN` permits list/show; `BUG_REPORT_WRITE_TOKEN` permits
headless submission and triage. Tokens must be at least 32 characters and must
never be Vite build variables or command-line arguments. The endpoint defaults
to `https://dice.clickclacks.app`; `--url` or `CLICKCLACKS_SUPPORT_URL` selects a
local or staged service. Output is JSON; failed requests exit nonzero. The inbox
lists the newest 50 reports for the requested status without contact/diagnostics.
Show returns private details only to authorized support readers.

Use the current report revision for triage: simultaneous updates conflict
instead of silently overwriting. Owner is an advisory label supplied by an
authenticated staff caller; it is not proof of Chords identity. Use the stable
thread ID reported by Chords, and coordinate claims there. Updates replace the
owner/note/fix fields; include values that should remain. There is no automatic
thread assignment or wake bridge. Actual project membership stays governed by
Chords; the browser cannot claim staff permissions or assert a sender.

Contact, diagnostics and geographic data expire after 30 days. Staff reads mask
expired private data immediately; the daily cleanup physically clears those
columns. The narrative and triage summary remain. Avoid putting private contact
info in triage notes. D1 backup/time-travel retention may outlive this cleanup.

## Local setup

Use host baseline Node 24.18.0, pnpm 11.5.3 and Wrangler 4.134.0. Install an
independent node_modules in each worktree. Existing ignored Convex-generated
types are needed for the project's full typecheck; this feature does not change
or publish Convex code.

`wrangler.bugs.jsonc` is the app-with-intake publication config. It preserves
the app hostname/assets and routes `/api/*` before SPA fallback. The configured
D1 database is `9eddbb4b-5dbd-4093-99c3-c533605fab18`. The publication workflow
applies migrations and deploys this config. `wrangler.jsonc` is the historical
static-only config; deploying it would disable reporting.

Create an ignored `.dev.vars` with local fixture values for
`BUG_REPORT_READ_TOKEN`, `BUG_REPORT_WRITE_TOKEN` and `BUG_REPORT_RATE_SALT`.
Use distinct read/write tokens. Then:

```sh
VITE_CONVEX_URL=https://nautical-partridge-636.convex.cloud pnpm build:cloudflare
pnpm dlx wrangler@4.134.0 d1 migrations apply clickclacks-bug-reports --local --config wrangler.bugs.jsonc
pnpm dlx wrangler@4.134.0 dev --local --config wrangler.bugs.jsonc --port 9695
```

The test coordinator runs `tests/browser-bug-reports.mjs` against the isolated
local Worker. It blocks all game-backend connections and verifies desktop/mobile
form behavior, Escape/focus, optional contact, diagnostics opt-out, lost-response
retry, download and authorized persisted readback. It requires matching local
fixture tokens. Focused worker tests use real SQLite with the actual migration.

## Publication setup

The owner approved publication on 2026-10-02. The database
`clickclacks-bug-reports` is in app account
`462b5ee1e395c11b8523d6c38de0577a`. Apply its migration remotely before deployment.

Worker read/write tokens and rate salt are HMAC-SHA256 derivatives of the
canonical broker-provided Cloudflare API token, with distinct versioned
`clickclacks-app:bug-reports:v1:ROLE` labels. The server receives only derived
values. Provision all three through Worker secrets using
`scripts/bug-report-auth.ts`; never print them, pass them as command arguments,
or include them in Vite environment variables. Rotating the canonical
Cloudflare credential requires reprovisioning the Worker derivatives. The
canonical value remains in the host broker; no separate broker-admin grant is
needed. Local fixture tokens are independent of production.

The CLI automatically derives only the reader for the fixed production origin.
Write commands continue to require an explicit `BUG_REPORT_WRITE_TOKEN` supplied
through a trusted staff environment. A Cloudflare operator can derive that
token with the helper for triage without putting its value in arguments/logs.

Publish the complete app build with `wrangler.bugs.jsonc` from pushed main and
record the Worker version. Reuse accepted tests; only CLI credential routing
changed during provisioning and receives a focused check. The landing Worker
is separate. Public intake fails closed without its rate limiter/salt.

## Accepted validation

On 2026-10-02, the assigned Test coordinator accepted runtime `fbd3982`:
172 tests across 38 files, root build, actual local D1 migration, popup checks at
1440/430/320 pixels and the 480-pixel tray, lost-response → 429 → identical retry,
download, focus/Escape, opt-out and persisted support-CLI readback. Unauthorized
reads were refused. The game backend was blocked throughout browser checks.

`b25f1f0` corrects only command/help wording to `pnpm run bugs`; the coordinator
and QC reused the accepted evidence. Final QC PASS closed the retry and command
findings. Evidence is outside Git at
`/srv/presidium/home/projects/powerroller/test-artifacts/bug-reports-fbd3982/RESULT.md`.
Phone popup screenshots were visually inspected. All test-owned services and
checkouts were removed. Local authoring typecheck and Worker dry-run also passed.

The release credential-routing delta `99f1713` received source QC PASS and
Test coordinator PASS: three focused CLI authentication tests and typecheck,
both exit 0. The prior runtime and browser evidence was reused. Logs are at
`/srv/presidium/home/projects/powerroller/test-artifacts/bug-auth-99f1713-{focused,typecheck}.log`.

## Publication result — 2026-10-02

Source `ff553a3` was merged into standalone main and pushed to GitHub before
publication. The root-path build completed with the existing dedicated public
backend `https://nautical-partridge-636.convex.cloud`. Wrangler 4.134.0 applied
`0001_bug_reports.sql` to the remote D1 database, provisioned all three Worker
secrets, and published the complete 39-file app asset build plus intake Worker.
Each required operation exited 0.

- App: <https://app.clickclacks.app>
- Worker: `clickclacks-app`
- Version: `cbace644-c81e-49d5-923f-f71367e76568`
- D1: `clickclacks-bug-reports`, `9eddbb4b-5dbd-4093-99c3-c533605fab18`
- Report limiter: five requests per 60 seconds per Cloudflare location
- Private-field cleanup: daily at 03:17 UTC

The deployment reported the D1, rate-limiter and assets bindings, custom domain
and cleanup schedule. Accepted Test/QC evidence was reused; no live probe or
suite was repeated solely for promotion. No credentials were printed or
committed. Project readers use the CLI with their existing broker-granted
Cloudflare credential. The dedicated game backend and separate landing Worker
were not republished by this release.

The manual GitHub publication workflow now applies the D1 migration and uses
`wrangler.bugs.jsonc`. Its repository Actions secret remains an operator setup
item inherited from the hosting release: the available GitHub credential cannot
manage repository secrets. This publication used the host's broker credential.

## Settings consolidation and mobile form sizing

The header keeps Dice customization and Sharing, with one Settings cog for
appearance, accessibility and reporting. Light/Dark/System choices and
accessibility controls are removed from Dice customization. Reload errors do
not include a Report a bug button. The tray keeps its
single cog with Sharing, Dice and Settings tabs. Existing preference persistence
and synchronization are reused. Reporting snapshots Settings before it closes
and returns focus to the visible Settings trigger after dismissal.

Bug-report text/contact fields explicitly use 16px fonts, with a 16px dialog
base. Settings selects retain their existing 16px sizing. Font-only `29a7a1b`
passed Chromium computed-size/overflow checks at 430 and 320 pixels; WebKit was
unavailable due to host libraries, so physical Safari behavior was not tested.
The expanded menu proof is `tests/browser-app-settings.mjs`; reporting's browser
proof uses the updated Settings entry path.

Expanded runtime `c0048d9` received Test and final QC PASS. Both local browser
scripts exited 0 at 1440/430/320 pixels and the 480-pixel tray, proving Settings
placement, theme/accessibility persistence after reload, tab keyboard wrap,
report handoff/focus and 16px fields. The reporting script repeated lost-save
response → 429 → identical retry/download and read back four distinct saved
reports from isolated local D1. Backend HTTP and WebSockets were blocked.
Evidence: `/srv/presidium/home/projects/powerroller/test-artifacts/settings-037a5ee/RESULT.md`.
Prior 172-test runtime and CLI authorization results were reused; temporary
Test services/worktree were removed. Mobile Settings screenshot was inspected.

Settings/mobile follow-up source `0411959` was merged/pushed into standalone
main and published to <https://app.clickclacks.app> on 2026-10-02. Root-path
build and pinned Wrangler deployment exited 0. Worker version:
`f5d188fc-da99-4428-afa0-7f0989b21063`. The deployment reported the existing D1,
rate limiter, assets and daily cleanup schedule. Accepted tests were reused;
publication did not repeat live checks or change database/secret provisioning.
