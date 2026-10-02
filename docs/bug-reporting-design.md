# In-app bug reports

Design proposal, 2026-10-02. Confirmed direction: Click Clacks users should report
bugs inside the app, attaching useful browser/app context; GitHub Issues is a
candidate destination. The choices below are recommendations, not implemented
behavior or authorization to publish reports or create a repository.

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

## Destination: private GitHub Issues

The existing [illos/powerroller repository](https://github.com/illos/powerroller)
is public and had Issues enabled when inspected on 2026-10-02. GitHub provides
issue bodies, labels, comments, assignees and links to fixes; its
[create-issue API](https://docs.github.com/en/rest/issues/issues#create-an-issue)
supports a server-side GitHub App with repository Issues write permission.

Recommend a dedicated private support repository, with one issue per report and
labels `bug`, `user-report` and `needs-triage`. No GitHub account is required of
the reporter: our backend creates the issue through the App. Restrict installation
to the support repository and keep all credentials server-side.

The issue contains a concise title, report ID, user's description/expected
behavior, build, browser/OS, app surface and useful error/timing summary. Treat
user text as untrusted: escape Markdown/HTML and mentions so a report cannot
ping arbitrary accounts or inject instructions into automatic maintenance.
Do not automatically run tools, code or agents based on a report's contents.

Keep JSON, screenshot, contact details and geographic context in private
support storage. Link to an authenticated maintainer view using an opaque report
ID, never a public or bearer download URL. The private issue is the work queue;
support storage owns the diagnostic bundle. Maintainers can create a separately
written public issue in the code repository and link it from the private issue.
Ordinary issues should not be treated as having individual privacy controls;
the repository's [visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
sets the access boundary.

## Intake and delivery

Recommended path: browser → same-origin Cloudflare intake → dedicated Click
Clacks Convex support storage/outbox → GitHub App → private issue. Support
records belong in the standalone site's host backend, outside the reusable dice
component. Preserve the public library's existing rolling behavior.

Current Cloudflare hosting is static-assets-only. This design adds Worker code
and routes `/api/bug-reports` ahead of the SPA asset fallback; it is not an
already available endpoint. Cloudflare's
[request context](https://developers.cloudflare.com/workers/runtime-apis/request/)
can provide approximate country/region at intake. Timezone is browser-provided;
neither is an exact physical location. Discard raw IP addresses from report
records. Document any infrastructure-log retention separately. With diagnostics
off, skip both browser diagnostics and geographic enrichment.

Intake validates schema, payload/image sizes and permitted origins, strips
unexpected fields, rate-limits submissions and uses a honeypot; add a challenge
only if abuse requires it. Origin checks alone are not abuse prevention. Use a
short-lived keyed network identifier for rate limiting without retaining raw
IPs in reports. File upload tickets and status reads require an unguessable
reporter receipt; maintainer reads require authenticated staff authorization.

Persist the report and an outbox job atomically before returning a receipt.
Submit a stable client-generated idempotency key; repeated sends return the
same report, and reuse with different content is rejected. Save GitHub's issue
number/URL after creation. On rate limits, outages or credentials failure, retry
with bounded backoff and expose stalled delivery to maintainers.

GitHub issue creation is not an atomic transaction with our database. Put a
unique report marker in the issue and reconcile ambiguous timeouts before
creating another. If reconciliation cannot establish the outcome, flag it for
manual handling instead of promising exactly-once external delivery. Distinct
users' reports remain separate, but matching error fingerprints can be linked
as likely duplicates during triage.

If Convex is unavailable, the Worker cannot claim durable acceptance without a
separate durable queue. The first version returns failure and offers local
retry/download. GitHub downtime alone does not prevent intake acceptance.

Propose deleting diagnostic bundles, screenshots and contact details after 30
days; retain the issue's technical summary without geographic/contact data.
The intake record tracks expiry and delivery state. Public issue creation always
requires maintainer review. Reporter status initially needs only receipt and
delivery acknowledgement; email notifications and public status tracking can
follow later.

## Implementation evidence required

1. A browser report retains the pre-dialog state, includes release/rendering and
   connection context, and excludes injected credentials, room links and names.
2. Reporting still works from the recoverable reconnect alert, an isolated React
   render failure and the PiP surface; missing browser capabilities are harmless.
3. Diagnostics-off, screenshot removal and cancel behave as described; consent
   controls geographic enrichment as well as browser capture.
4. Submit via the same intake API from UI and a headless caller, then read stored
   report/outbox state back through an authorized route. Repeat with the same key,
   oversized data, arbitrary fields, spam and unauthorized reads.
5. Prove GitHub outage/rate-limit/ambiguous-timeout handling with a fake external
   adapter before an explicitly authorized private-repository integration run.
6. Verify upload authorization, retention cleanup, receipt status and local
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

Before implementation, settle support-repository ownership, maintainer access,
GitHub App installation and diagnostic retention. Recommended starting choices
are private intake/issues, 30-day bundle retention and approximate location only.
No repository, GitHub issue, secret or deployed endpoint was created by this
design task. Validation: source/documentation review and `git diff --check`;
runtime and browser tests are future implementation acceptance checks.
