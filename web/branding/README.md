# Click Clacks branding

High Voltage wordmark and emblem, approved by the owner on 2026-10-01.
Copied unchanged from Salient design commit `7a9b17be5517d17277a25bba176c7524a5da916e`,
`docs/design-mockups/click-clacks/01-high-voltage{,-mark}.svg`.
The wordmark uses SVG paths and needs no font download.

Used for the site header and favicon. Package, API, storage and hosting path names
remain `powerroller` to preserve existing consumers, settings and table links.

Validation: `pnpm typecheck` and both production entry builds passed. A focused
built-site Chromium check at 1280×900, 430×932, 320×568 and 320×225 confirmed
the accessible Click Clacks heading, loaded wordmark/favicon, browser title,
no header-control overlap, no horizontal document overflow and no page errors.
Existing ignored Convex bindings were reused; no backend changes or deployment.

The light-mode wordmark keeps the same geometry and accent colors; only the ivory
foreground changes to graphite (`#202a2c`) for contrast on the light page.
