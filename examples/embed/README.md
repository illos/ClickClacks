# Embedded tray demo

An ordinary iframe containing the same compact tray, existing roll controls and
six revealed results below the 3D dice. It does not require Picture-in-Picture.
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

No backend changes. Built on the accepted PiP preview commit f619cd2, which is
still separate from main; preserve the newer live audio during integration.

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
