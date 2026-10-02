# Click Clacks hosting migration

Current canonical roller: **https://dice.clickclacks.app/**. The owner corrected
the hostname on 2026-10-02. `app.clickclacks.app` now remains a legacy entry
point; navigation redirects preserve room queries. Current publication uses
`wrangler.bugs.jsonc` for the app and `wrangler.landing.jsonc` for the landing
page. See [the audit fixes](site-audit-fixes.md). Earlier sections below record
the original migration and its former hostname.

The subsequent [bug-reporting release](bug-reports.md#publication-result--2026-10-02)
adds a Worker API and D1 inbox. Current app publication uses
`wrangler.bugs.jsonc`; the static-only `wrangler.jsonc` below records the initial
hosting migration and would disable reporting if redeployed.

Prepared from standalone main `6c15c17` on 2026-10-02. The owner confirmed the
app hostname and active domain in Blackgate Studio. Frontend publication now
uses the current dedicated backend; Convex team transfer and production backend
selection follow separately. Publication results are recorded below.

## Target architecture

Serve the existing Vite build with Cloudflare Workers Static Assets. There is no
Worker JavaScript or API proxy: the browser continues connecting directly to
the selected Convex deployment. [Static-asset requests are free and unlimited](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
This gives control over browser caching and delivery; hosting alone does not
reduce physics/rendering work or the roll's sequential Convex requests. Measure
matched startup and roll timing before claiming an improvement over Pages.

The owner confirmed on 2026-10-02 that `clickclacks.app` is reserved for the
landing page and `app.clickclacks.app` is the roller's canonical hostname.
The landing demo remains a separate branch and is not included in this migration.

## Prepared frontend configuration

- `pnpm build:cloudflare` runs the existing shared main/PiP build with base `/`.
  The ordinary Pages build keeps its `/powerroller/` default.
- `wrangler.jsonc` names an independent `clickclacks-app` Worker and serves
  `dist/`. It selects the accessible Blackgate Studio account and binds only
  the approved `app.clickclacks.app` hostname.
- HTML handling is disabled to preserve the explicit tray `.html` URLs;
  navigation fallback serves the app shell. Room links use query parameters.
- `public/_headers` gives fingerprinted `/assets/*` a one-year immutable
  browser cache. HTML and the unversioned font-license notice retain Cloudflare's
  default revalidation. See [header behavior](https://developers.cloudflare.com/workers/static-assets/headers/).
- The main site, PiP tray and old tray alias keep the shared asset graph.
  Deploy the complete `dist/` directory, including font notices.

Use the host's existing Wrangler version `4.134.0`, rather than adding a second
Wrangler installation to this project. Build with the chosen public
`VITE_CONVEX_URL`; deployment credentials must never be `VITE_*` values.

```sh
pnpm install --frozen-lockfile
VITE_CONVEX_URL=https://CHOSEN-DEPLOYMENT.convex.cloud pnpm build:cloudflare
pnpm dlx wrangler@4.134.0 deploy --dry-run --config wrangler.jsonc
```

The deployment URL above is a placeholder. The currently published frontend
uses dedicated **dev** deployment `nautical-partridge-636`.
A production deployment should be selected and published separately
before the public V1 frontend switches to it.

## Separate Convex allowance

Convex's [resource limits are per team unless specified otherwise](https://docs.convex.dev/production/state/limits).
A second project in the same team would still share that allowance. A separate
Click Clacks team under the existing login is the documented organizational
mechanism; a second login is unnecessary. Confirm the destination team's Free
plan and usage in the dashboard before relying on its allowance.

[Project transfer](https://docs.convex.dev/dashboard/projects#transferring-a-project-to-another-team)
preserves the project's deployments, data, environment variables and deploy
keys. Both source and destination require admin/transfer permissions. Prefer
transferring the existing standalone project over recreating its backend;
check access for existing team members afterward. Transfer changes ownership,
and does not promote the dev deployment into production.

Current base Free limits include one million function calls per month, 0.5 GB
database storage, 1 GB monthly database I/O and 1 GB monthly data egress.
Dev and production usage in the same team share its allowance. Use the current
[limits](https://docs.convex.dev/production/state/limits) and
[pricing](https://www.convex.dev/pricing) when executing the migration. Free
has hard caps; Starter is an optional pay-as-you-go upgrade, not part of this
preparation.

## Preparation validation

The assigned Test coordinator accepted runtime configuration `f4aaece`:

- Offline frozen install and root-path build passed; 39 static files include
  both tray URLs, fonts, worker and notices.
- Pinned Wrangler `4.134.0` dry-run passed. The original compatibility date
  `2026-10-02` exceeded its bundled local runtime; `f4aaece` corrects it to
  supported date `2026-09-24` without a tooling upgrade.
- Nine local route/MIME/cache probes passed. HTML/notices revalidate and
  fingerprinted assets carry the one-year immutable header.
- Chromium root and PiP loaded with controls visible and no page errors or
  failed requests. The initial PiP probe's harness event wait was corrected
  to inspect existing context pages; the corrected probe passed.
- Independent read-only review found no concrete issues. All test-owned
  servers and the fixture worktree were removed.

Evidence is outside Git at `test-artifacts/cloudflare-hosting-4062d5c/RESULT.md`.
These are local routing/load checks, not measured hosting speed gains or proof
of a Cloudflare/DNS/production-backend cutover.

On 2026-10-02 at 04:36 UTC, the token's zone lookup confirmed active
`clickclacks.app` in Blackgate Studio. The Workers domain lookup found no
existing `app.clickclacks.app` binding. DNS-record reads return 403 with this
token; Wrangler's custom-domain operation must report successful binding before
claiming publication. The destination Convex team and production backend remain
unselected. Initial frontend publication uses the existing dedicated dev backend
`https://nautical-partridge-636.convex.cloud`.

`.github/workflows/cloudflare.yml` builds at `/` and publishes the approved app
Worker on manual dispatch. Its public backend URL comes from
repository variable `VITE_CONVEX_URL`; its server-only Cloudflare token comes
from the repository Actions secret. No Convex deploy key is used by this job.
The original Pages workflow remains available during the transition. The
current GitHub credential receives 403 from the repository Actions secrets
API; it cannot configure this workflow's secret. Until an owner sets the
repository secret, publication runs from the host's existing Cloudflare
credential. Automatic main-push publication is deferred until that setup is
complete, avoiding a failing deploy job on ordinary pushes.

## Cutover sequence

1. Verify ownership/access to the `clickclacks.app` zone in the selected
   Cloudflare account. The app hostname is approved as `app.clickclacks.app`.
   Keep the existing Pages URL live during preparation.
2. Supply the current dedicated public backend URL to the root-path build.
   Reuse the accepted Test coordinator checks of root links, assets and PiP;
   request targeted checks for new failures or changed behavior. Compare
   matched delivery timing if claiming a hosting speed improvement.
3. Confirm the prepared Cloudflare account ID and app-domain binding in Wrangler;
   commit and push the completed configuration. Publish from pushed main, record
   the Worker version and canonical URL, then update the landing link/embed.
4. Configure the app's ongoing build/publication workflow with its Actions secret.
   Decide how to redirect the old Pages URL after the new app is accepted.
5. Confirm or create the Click Clacks Convex team, confirm its plan, and transfer
   only the standalone project. Verify its existing deployment addresses and
   permissions in the dashboard.
6. Select a dedicated production deployment for real users. Publish the accepted
   backend there, with any unrelated ambient `CONVEX_DEPLOY_KEY` unset, then
   update the frontend's public backend variable and publish. Keep unrelated
   applications and their deployments out of the cutover.

Browser storage is scoped to an origin, and session identity is additionally
keyed by backend URL. Moving from `illos.github.io` to a new app domain gives
existing visitors fresh local preferences/history and identity; a project
transfer alone does not change backend addresses. Do not promise automatic
cross-domain browser-storage migration or participant ownership continuity.
If the backend also changes from dev to production, existing room links do not
automatically identify rooms in the new deployment.

Rollback keeps the accepted Pages build and old backend available until the
new target is accepted. Restore the previous frontend/hostname routing if
needed; do not delete the old backend or reset user data as a rollback step.

## App publication result — 2026-10-02

Source `3e15819` was fast-forwarded into standalone main and pushed to GitHub.
Its root-path build completed successfully with explicit public backend URL
`https://nautical-partridge-636.convex.cloud`. Pinned Wrangler `4.134.0`
published the 39-file static build successfully and reported the attached
`app.clickclacks.app` custom domain.

- Canonical roller: <https://app.clickclacks.app>
- Worker: `clickclacks-app`, Blackgate Studio account
- Version: `69552e9a-d72f-4a8f-b9b5-78b3869646eb`
- Compatible backend: existing dedicated dev `nautical-partridge-636`
- Original Pages workflow also passed, run `36965713007`; the old site remains
  available during transition.

Accepted local Test/review results were reused; no suite or live browser checks
were repeated solely for publication. No Convex team, backend code or deployment
was changed. The Actions secret remains unconfigured because the available
GitHub credential cannot manage repository secrets. Main-ref and required-setting
guards are present in the manual publication workflow. The merged hosting
worktree and branch were removed without forcing.

The separately accepted landing `a79ee92` was then merged and pushed into main
for its owning thread to publish the apex Worker. Its publication is independent
of this app Worker and does not change the roller's asset graph.

## Landing publication result — 2026-10-02

The owning landing thread merged and pushed final source `6ede6b0`, including
the owner-requested hero and explanation of table codes and share links.
It reported successful required build and Wrangler publication to
<https://clickclacks.app>, Worker `clickclacks-landing`, version
`257bf6b8-a35e-41c7-8eb4-b4dc3f47cfe3`.

Focused visual checks at 1440, 430 and 320 pixels passed without page errors or
overflow. Previously accepted gameplay and static-routing checks were reused;
publication did not introduce repeated suites or live browser checks. The
owning thread stopped its preview and retired its worktrees and branches.
The app Worker and dedicated backend are unchanged. Both frontend domains are
now published; Convex team separation and Actions secret setup remain pending.
