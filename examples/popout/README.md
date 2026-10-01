# Tray popout demo

Document Picture-in-Picture only. The PiP window embeds the existing Power Roller
in its own document, keeping its renderer, audio and pointer events in that
window's context. Demo CSS hides the header and log and fits the tray and existing
roll controls into a 480 × 420 window. No popup fallback or backend change.

The original tab must remain open. Unsupported browsers show an unavailable
message. The child document shows loading while the roller starts and a visible
error if its module cannot load. Closing the mini window stops its roller; opening again restores the
existing site preferences and saved room through the original site entry.

Run from the repository root:

```sh
VITE_CONVEX_URL=https://nautical-partridge-636.convex.cloud pnpm exec vite --config examples/popout/vite.config.ts --host 127.0.0.1 --port 9596 --strictPort
```

Open `/examples/popout/index.html` on localhost or HTTPS. Click **Pop out tray**.
The demo's separate Vite config also builds with `vite build --config
examples/popout/vite.config.ts`; output stays ignored under `dist/popout-demo`.

Validation: `pnpm typecheck`, the separate demo build and
`node tests/browser-popout.mjs`. The focused headed Chromium check covers actual
PiP creation, the dice picker/count, an animated roll with persisted readback,
controls fitting at 480 × 420 and 360 × 320, close/reopen, unsupported-browser
messaging and a failed-module error. Run against the built demo with
`URL=http://127.0.0.1:9597/examples/popout/index.html node tests/browser-popout.mjs`
after starting `vite preview --config examples/popout/vite.config.ts --port 9597`.
A private Xvfb display is used when the host has no display. Firefox
and physical-desktop interaction are not covered by that check.
