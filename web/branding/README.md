# Click Clacks branding

High Voltage wordmark and emblem.
The wordmark uses SVG paths and needs no font download.

Used for the site header and favicon. The package name is `clickclacks`;
legacy storage keys, the installed backend namespace and the default Pages
path retain `powerroller` for compatibility.

Validation: `pnpm typecheck` and both production entry builds passed. A focused
built-site Chromium check at 1280×900, 430×932, 320×568 and 320×225 confirmed
the accessible Click Clacks heading, loaded wordmark/favicon, browser title,
no header-control overlap, no horizontal document overflow and no page errors.
Existing ignored Convex bindings were reused; no backend changes or deployment.

The light-mode wordmark keeps the same geometry and accent colors; only the ivory
foreground changes to graphite (`#202a2c`) for contrast on the light page.

The 2026-10-02 owner-requested `.app` trial adds mint angular path lettering to
both wordmark variants; the emblem remains unchanged. `build:landing` renders
the dark SVG into a 1200×630 PNG social card with pinned resvg. The PNG is built
into `dist/landing-demo`, rather than committed or downloaded by the page itself.
