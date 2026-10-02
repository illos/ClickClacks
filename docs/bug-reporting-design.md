# In-app bug reports

Historical design proposal. Implemented scope and current publication/access
instructions are in [Bug reports](bug-reports.md); that document takes precedence.

Design proposal, 2026-10-02. Confirmed direction: Click Clacks users should report
bugs inside the app, attaching useful browser/app context; GitHub Issues is a
candidate destination. The owner also proposed D1 storage accessible to Presidium
project threads. Recommend D1 as the primary inbox, with optional GitHub linkage.
The choices below are proposals, not implemented behavior or publication authorization.

## Report flow

Expose **Report a bug** in the app menu and alongside recoverable errors. Keep a
small reporting fallback outside the main React tree so a render failure can
still offer reporting. Capture context when reporting opens, before navigation,
reload or the reporting dialog changes the visible app state. Capture from a
PiP tray identifies that surface and uses the opener only if available.

Require one field: **What went wrong?** Offer optional **What did you expect?**,
screenshot attachment and contact email. Show a readable diagnostics summary
with expandable JSON and let the user turn diagnostics off. Preview screenshots
before sending; allow removal. Explicitly explain that reports are private to
maintainers and include approximate location when diagnostics are enabled.

Send the reviewed snapshot, not fresh state captured on submission. Success
means durable receipt by our intake, with a report ID. Show GitHub delivery as
pending when appropriate. Cancel sends nothing. If intake is unreachable, keep
the draft in memory, offer retry and download the sanitized report. Saving a
draft across reload is an explicit user action, not an automatic storage dump.

## What to capture

Use a versioned, allowlisted diagnostic model. A full browser/app-state dump
would include joining credentials and other users' names in this application.
Unknown fields are omitted. Missing capabilities are reported as unavailable.

| Category | Proposed capture |
| --- | --- |
| Release | Frontend build commit, diagnostic schema version, renderer/library version and configured backend environment label. |
| App location | Origin, pathname and named UI surface/open dialog; remove query strings and fragments, which can carry room access. |
| Browser/device | Browser-provided user-agent, best-effort browser/OS classification, viewport, screen size, pixel ratio, touch capability and language. Do not promise an exact device model. |
| Geographic context | Timezone plus optional Cloudflare country/region derived at intake; label geographic estimates as approximate and allow exclusion. No GPS permission prompt. |
| Preferences | Dice mode/count, modifiers, color/ink/pattern/font, theme, motion, sound, high contrast and announcement settings. |
| Connected play | Joined/expired flags, participant count, readiness, connection/reconnect state, pending operation kind, server-clock offset and uncertainty. |
| Rolling/rendering | Recent request/accept/start/reveal timings, active roll phase, generated/supplied origin, dice faces/results and relevant style; WebGL availability/context-loss events and renderer settings. |
| Recent actions | Bounded semantic events such as roll requested, clear, join, preference change, tab suspended/resumed and reconnect. No keystrokes or session video. |
| Errors | Bounded application errors with time, operation, sanitized message/stack and frontend commit for source-map matching. No raw console or network-body capture. |

Keep a local in-memory ring buffer of at most 50 actions and 10 errors, expiring
after five minutes. Record low-cost timestamps at existing operation boundaries;
do not poll the renderer or add per-frame logging. Proposed limits: 256 KiB JSON,
one image up to 2 MiB and 4,000 characters per narrative field. Mark truncated
sections visibly. Enforce limits at intake too.

Exclude credentials, cookies, tokens, raw storage, room codes/keys/invite URLs,
names and other users' identifiers. Use report-local aliases for participants
and rolls where needed to preserve relationships. Do not hash a short room code
as a privacy substitute. A separate, explicit **Include table reference for
support** option could later attach a server-resolved internal reference to the
private report; leave it out of the first version.

Screenshot capture is optional. Start with uploaded/pasted images; recreating
the page from DOM does not prove the WebGL tray was captured correctly. A future
capture button must be verified with the actual renderer and browser permissions.
Screenshots and free text may contain personal details, so keep them private and
let users review them. Do not promise automatic perfect redaction.

## Destination: D1 inbox, optional GitHub Issues

Recommend browser → same-origin Cloudflare Worker → private D1 report inbox.
Cloudflare supports [D1 bindings in Workers](https://developers.cloudflare.com/d1/worker-api/).
This does not depend on the game backend or GitHub being healthy, so it can
receive reports about failures in either. If D1 itself is unavailable, retain
retry/download in the browser; do not claim acceptance until the write succeeds.

D1 stores the structured report, bounded diagnostic JSON and triage history.
Optional screenshots go in a private R2 bucket with public access disabled;
D1 stores their object references. Keep image bytes out of issue text and D1 rows.
Start with the text/JSON inbox if screenshot storage is not ready. No GitHub
integration is needed to ship this first version.

Proposed records:

| Table | Main fields |
| --- | --- |
| reports | ID, creation time, source app, description, expected behavior, build, surface, status, fingerprint, idempotency key/content digest, reporter-receipt digest, revision, optional assigned thread, optional duplicate/report and GitHub issue references. |
| report_diagnostics | Report ID, schema version, sanitized JSON, optional contact, optional geographic context, expiry time. |
| report_attachments | Report ID, private object key, verified content type, byte count and expiry time. |
| report_events | Report ID, action, trusted actor/thread attribution, time, note and linked fix commit. |

Use statuses `new`, `triaged`, `in-progress`, `needs-info`, `resolved` and
`duplicate`. Index inbox status/creation time and fingerprint/build. Keep list
responses small; retrieve diagnostic bundles only for the selected report.
Only report IDs and support receipts identify browser submissions: the browser
cannot supply assignment, trusted actor, issue URL or resolved status.

GitHub remains an optional work tracker. The existing
[illos/powerroller repository](https://github.com/illos/ClickClacks) is public and
had Issues enabled when inspected on 2026-10-02. Its
[create-issue API](https://docs.github.com/en/rest/issues/issues#create-an-issue)
supports server-created issues using a GitHub App with repository Issues write
permission. Maintainers can promote a confirmed bug into a public issue using
a reviewed technical summary, linking its number back into D1. Never copy
contact details, geographic context, screenshots or complete state into a public
issue automatically. A private support repository remains an alternative if we
later want all incoming reports to become issues.

## Access from Presidium threads

Add a small project CLI backed by authenticated support endpoints, rather than
requiring a dashboard or distributing a broad Cloudflare account token. These
are proposed commands, not commands available today:

```sh
pnpm bugs list --status new --json
pnpm bugs show REPORT_ID --diagnostics --json
pnpm bugs claim REPORT_ID
pnpm bugs note REPORT_ID --body-file /path/to/note.md
pnpm bugs resolve REPORT_ID --commit COMMIT
```

Read and triage capabilities are separate. Provision a report-reader credential
through Presidium's existing secret mechanism; triage writes require their own
scope. The Worker alone owns the D1 binding. Fixed endpoint operations use
prepared statements and validate identifiers; do not expose arbitrary SQL over
the support API. Cloudflare's [remote D1 CLI](https://developers.cloudflare.com/d1/wrangler-commands/)
is an operator fallback, not the normal thread interface.

A claim uses the report's revision for an atomic compare-and-set: a second
thread sees the current claim instead of overwriting it. Claims are advisory
coordination and can be released/reassigned; resolving a report records the
actual fix commit and evidence note. Committed-on-branch and released fixes
remain distinguishable. Reading a report does not claim or resolve it.

Link the inbox to this Presidium project's threads through explicit host-side
configuration. Thread registration can differ from the app's source checkout;
do not infer Chords
membership from that directory or bypass project boundaries. A trusted host
bridge can verify Chords identity and make authenticated triage calls, recording
stable thread IDs. The browser never asserts a Chords sender or chooses a thread.

Initially, threads run `bugs list` when assigned support work. A later host poller
can publish a quiet Chords notification with report ID, build and app surface
when new reports arrive. Keep diagnostics/contact details out of Chords and
avoid waking every thread for every report. Automatic assignment or waking an
implementer is a separate workflow choice. Treat report text, JSON and images
as untrusted user data, never as instructions to execute tools or code.

## Intake, privacy and reliability

Current Cloudflare hosting is static-assets-only. This design adds Worker code,
a D1 binding and a route for `/api/bug-reports` before the SPA asset fallback;
these are not already deployed. It preserves the reusable roller's operation
contracts and leaves support services in the standalone host application.

Cloudflare's [request context](https://developers.cloudflare.com/workers/runtime-apis/request/)
can provide approximate country/region at intake. Timezone is browser-provided;
neither is an exact physical location. Discard raw IP addresses from report
records. Document any infrastructure-log retention separately. With diagnostics
off, skip both browser diagnostics and geographic enrichment.

Intake validates schema, payload/image sizes and permitted origins, strips
unexpected fields, rate-limits submissions and uses a honeypot; add a challenge
only if abuse requires it. Origin checks alone are not abuse prevention. Use a
short-lived keyed network identifier for rate limiting without retaining raw
IPs in reports. Contact is optional; reporter receipt/status does not require
an account. Store only a digest of the unguessable receipt secret; status reads
require the secret and return that report's acknowledgement, not inbox access.

A unique client idempotency key ensures repeated sends return the same report;
reuse with different content is rejected. Persist report/diagnostic records
atomically before returning success. Optional attachments use bounded upload
tickets, link only after successful upload and have orphan cleanup: R2 and D1
are not one transaction. Verify actual image content and serve only through
authorized attachment reads, never public or long-lived bearer links.

Propose deleting diagnostic bundles, screenshots and contact details after 30
days while retaining the minimal technical summary/triage history. Cleanup
must account for objects, database records and backup/time-travel retention;
do not promise immediate erasure from backups. Staff access remains restricted
through the support API; no browser endpoint enumerates other users' reports.

If automatic GitHub forwarding is added, use a durable outbox, bounded retries
and a unique report marker. Issue creation and D1 cannot commit atomically;
reconcile ambiguous timeouts and flag unresolved outcomes rather than promising
exactly-once external delivery. Do not block durable intake on GitHub's response.

## Implementation evidence required

1. A browser report retains the pre-dialog state, includes release/rendering and
   connection context, and excludes injected credentials, room links and names.
2. Reporting still works from the recoverable reconnect alert, an isolated React
   render failure and the PiP surface; missing browser capabilities are harmless.
3. Diagnostics-off, screenshot removal and cancel behave as described; consent
   controls geographic enrichment as well as browser capture.
4. Submit via the same intake API from UI and a headless caller, then read stored
   D1 state back through the support CLI. Repeat with the same key,
   oversized data, arbitrary fields, spam and unauthorized reads.
5. Prove concurrent claims, scoped reader/triage access and actual thread attribution.
   Verify game-backend and GitHub outages do not prevent D1 intake. If GitHub
   forwarding is built later, verify ambiguous-timeout handling before integration.
6. Verify private attachment authorization, retention cleanup, receipt status and local
   download after intake failure. Check that instrumentation does not change
   rolling/reveal timing or expose a GitHub credential in built assets.

## Inspected source and remaining choices

Standalone baseline `85d2520`. Relevant sources: [site/session](../web/site/session.ts)
stores participant credentials; [site/storage](../web/site/storage.ts) stores
preferences, room references and IndexedDB roll history;
[roller UI](../web/dice-demo-v2/main.tsx) owns readiness, dialog and connection
state; [renderer](../web/dice-demo-v2/renderer.ts) owns WebGL and playback;
[client](../lib/client.ts) owns headless operation/delivery flow;
[hosting](cloudflare-hosting.md) records the static app Worker.

Before implementation, settle support access, host credential provisioning and
diagnostic retention. Recommended starting choices are D1 intake plus project
CLI, optional private R2 screenshots, 30-day bundle retention and approximate
location only. GitHub publication is a later maintainer action. No database,
bucket, repository, GitHub issue, secret or deployed endpoint was created by
this design task. Validation: source/documentation review and `git diff --check`;
runtime and browser tests are future implementation acceptance checks.
