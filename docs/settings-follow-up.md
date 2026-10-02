# Settings and dice picker follow-up — 2026-10-02

The owner requested Website and GitHub links in the roller Settings, app audio
on by default with a saved preference, and percentile dice at the bottom of the
picker. The shared full/tray Settings now links to `https://clickclacks.app/`
and `https://github.com/illos/powerroller`, opening a new tab with accessible
labels, underlines, keyboard focus and 44px target height.

The site preference loader defaults sound on when no valid sound choice exists.
An existing saved boolean mute remains muted. The existing sound button saves
both mute and enable choices; its handler and audio activation remain unchanged.
Embedding hosts retain their own defaults, including the landing demo's explicit
mute. The shared picker order is Power, d20, d12, d10, d8, d6, d4, d100.

Source `b52b027` passed independent source and final QC review. Authoring typecheck
and the focused storage tests passed. The assigned Test coordinator accepted
15/15 storage tests, the app build, and local Chromium checks at full-app
320×568 and tray 480×320: links/layout/focus, percentile-last, fresh audio on,
mute and re-enable persisted through reload. Backend traffic was blocked.
Evidence: `/srv/presidium/home/projects/powerroller/test-artifacts/settings-b52b027/RESULT.md`.

The source was fast-forwarded into main and pushed, then published with the
existing dedicated public backend `https://nautical-partridge-636.convex.cloud`.
Both required builds and pinned Wrangler 4.134.0 deployments exited 0:

- `https://dice.clickclacks.app/`: app Worker version
  `c7074885-2825-48d6-a856-9bf318365df0`.
- `https://clickclacks.app/`: landing Worker version
  `bd09e03e-8351-4aa5-bf72-52c42e5bf236`.

Publication logs: `/srv/presidium/home/projects/powerroller/test-artifacts/settings-publication-b52b027/`.
Accepted checks were reused for publication. Existing reporting/domain bindings
were retained and the dedicated backend was not republished.
