# Power Roller

The original Salient Power Roller, copied into its own repository.

[Live site](https://illos.github.io/powerroller/)

The UI, recorded physics, shared tray, customization preview, menus, modifiers,
room sharing, reconnect behavior and error handling come directly from Salient
commit `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b` (V272).
The abandoned replacement implementation has been removed.

## Run locally

Use Node24.18.0 and pnpm11.5.3:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set VITE_CONVEX_URL to your Convex deployment URL.
pnpm dev
```

Open http://localhost:9591/powerroller/.

For your own backend, run `pnpm exec convex dev` to select a project, generate
ignored bindings and deploy the functions under `convex/`. Use only the intended
project's deployment credentials. The community site uses the dedicated
`nautical-partridge-636` development deployment.

```sh
pnpm typecheck
pnpm test
pnpm build
```

The copied tests use a small standalone Convex fixture. Generated Convex bindings
are needed for typechecking and backend tests; the frontend build needs only the
public deployment URL.

## Deployment

GitHub Pages uses GitHub Actions. Repository variable `VITE_CONVEX_URL` supplies
the public backend URL. `main` builds to `dist/` and publishes at `/powerroller/`.
Deploy backend changes to the dedicated Convex project before using new endpoints.
Backend deployment keys never belong in frontend configuration.

## Source and license

See [the extraction record](docs/extraction.md) for the copied paths and the small
standalone adaptations. Powerroller-owned code is MIT with the copyright owner's
permission. The original Eczar, Sora, Caesar Dressing and New Rocker font subsets
retain their OFL notices in `web/dice-demo/fonts/`; the build ships
`dice-font-licenses.txt`. No Salient catalog or external reference corpus is included.

Actual VoiceOver/NVDA and real-device animation checks remain pending as previously
approved. This release preserves the existing implementation; it makes no new
accessibility-conformance claim.
