# Live-site audit fixes — 2026-10-02

The owner authorized applying the performance, accessibility and SEO audit fixes,
correcting the roller hostname to `dice.clickclacks.app`, and trying a `.app`
wordmark. Pause controls were explicitly excluded.

## Implementation

- App and embed links, canonical metadata and the support CLI use the corrected
  hostname. Both app custom domains bind to the existing app Worker. GET/HEAD
  navigation on the legacy hostname redirects with 308 while preserving query
  parameters, including rooms. The legacy reporting API stays same-origin for
  already-open clients. Browser preferences and identity remain origin-scoped;
  the backend and existing room data stay on the dedicated deployment.
- Known page entries redirect HTTP to HTTPS and duplicate index/landing URLs
  to their canonical root. Static assets bypass the Worker where possible;
  this is page routing, not a zone-wide HTTPS setting. The app uses real 404
  fallback rather than returning its shell for every unknown URL.
- Landing code examples have keyboard focus, visible outlines and accessible
  labels. Bane text is darker in light mode. Mini-tray history has full-opacity
  rows and timestamps without a gradient mask.
- The landing mini starts when visible. The customizer dynamically imports React
  near its section, retains one renderer across viewport exits, suspends drawing
  offscreen and reserves layout space. The single-die idle texture cache is
  limited to 40 rather than 128 maps (10 rather than 32 MiB of base RGBA pixels
  for 256-square maps; excludes mipmaps and other resources). Active resources
  are never evicted. Multiplayer tray defaults and physics are unchanged.
- Landing title names the product category. Open Graph/Twitter metadata uses a
  1200×630 PNG generated at build time from the SVG wordmark by pinned resvg.
  The app and demo explicitly allow crawling so their `noindex` directives can
  be seen; the landing sitemap remains canonical. App responses have a noindex
  header and page metadata. Unknown sitemap URLs return 404.
- Dark and light wordmarks retain the approved paths and add a mint `.app`
  suffix. No runtime fonts are required for the logo or social card.
- `clickclacks:customizer-startup` is available as a Performance API measure.
  Existing Cloudflare RUM remains in place. These changes reduce eager work and
  bound a cache; field Core Web Vitals or actual GPU memory gains are not yet
  measured. The original landing Lighthouse scores were already 100 in each
  category on both mobile and desktop.

## Validation and publication

Authoring typecheck passed. Focused route, resource lifetime/cache and support
credential-origin tests passed (3 files, 10 tests). Independent review and the
assigned Test coordinator's candidate checks will be recorded before release.

Publication uses `wrangler.bugs.jsonc` (reporting API/D1 retained) and
`wrangler.landing.jsonc`, with the public backend set explicitly to
`https://nautical-partridge-636.convex.cloud`. No backend publication, database
migration or reset is part of these changes.
