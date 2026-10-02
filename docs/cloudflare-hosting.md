# Click Clacks hosting migration

Prepared from standalone main `6c15c17` on 2026-10-02. The owner confirmed the
app hostname and active domain in Blackgate Studio. Frontend publication now
uses the current dedicated backend; Convex team transfer and production backend
selection follow separately. Publication results are recorded below once known.

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
uses dedicated **dev** deployment `nautical-partridge-636`, not Salient's
deployment. A production deployment should be selected and published separately
before the public V1 frontend switches to it.

## Separate Convex allowance

Convex's [resource limits are per team unless specified otherwise](https://docs.convex.dev/production/state/limits).
A second project in Salient's team would still share that allowance. A separate
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
   backend there, with the ambient Salient `CONVEX_DEPLOY_KEY` unset, then update
   the frontend's public backend variable and publish. Do not reset or redeploy
   the Salient app as part of this work.

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
