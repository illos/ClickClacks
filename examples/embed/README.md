# Embedded tray demo

An ordinary iframe containing the same compact tray, existing roll controls and
six revealed results below the 3D dice. It does not require Picture-in-Picture.
The top-right settings cog opens a combined Sharing/Dice menu. Sharing includes
the participant list, display name, room code/link and join/leave controls. Dice
reuses the existing color, pattern, font, preview and accessibility controls.
The same menu is enabled for the compact PiP tray through `trayHistory`; the
participant counter and sound/clear buttons reserve space for the cog.
`/embed/index.html` is the iframe entry; `/examples/embed/index.html` previews it
and generates copyable HTML. A `?room=CODE` parameter connects visitors to a
shared room through the existing room API; without it, the normal saved/personal
room behavior applies. Each browser participant keeps its own identity.

The frame starts with audio off unless the visitor already saved a sound setting
for this site. Sound follows the existing user interaction controls. When a
browser blocks storage in an embedded context, the original session/preferences
and history code handles memory-only use. The parent page receives no credentials
or roll messages, and needs no JavaScript integration.

```sh
VITE_CONVEX_URL=https://nautical-partridge-636.convex.cloud pnpm exec vite build --config examples/embed/vite.config.ts
pnpm exec vite preview --config examples/embed/vite.config.ts --host 127.0.0.1 --port 9602 --strictPort
```

This build stays ignored under `dist/embed-demo`. The entry is intended to be
integrated into the live site's build after acceptance. When publishing, the host
must allow this route to be framed by external origins (no restrictive
`X-Frame-Options` or CSP `frame-ancestors` on the embed response).

No backend changes. The demo branch includes the live PiP, audio and branding
source through f503321. Its embed entry and settings-menu changes remain on
`feat/embed-demo` for integration.

Validation: `pnpm typecheck`, the separate embed build, and
`node tests/browser-embed.mjs`, plus `pnpm exec vitest run tests/clock-sync.test.ts`.
The focused Chromium check embeds the HTTPS tray
in a different site's page, drives two distinct visitors in one shared room,
checks an animated d6 against persisted backend state, reloads the frame, rolls
with local/session/IndexedDB storage blocked, and validates the generated snippet
and room input. These checks do not establish physical Safari/Firefox behavior.

Iframe focus refreshes the clock without clearing a valid estimate. The first
Roll click previously focused the frame, disabled its button during the clock
refresh, and could be swallowed before click dispatch. The browser check now
proves a first-click power roll with storage blocked and reads its saved result
back. Visibility changes, connection failures and top-level focus continue to
invalidate readiness as before.

`node tests/browser-mini-settings.mjs` drives the cog in a cross-site iframe:
keyboard tabs, Escape/focus return, persisted name/pattern/font changes, saved
motion preference, joining/leaving with room readback, and menu fit/scrolling at
360 × 320. It also verifies the participant counter and top-right controls do not
overlap and reopening returns to the Sharing tab.
