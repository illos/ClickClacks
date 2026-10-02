# Phone installation

Open [the dice app](https://dice.clickclacks.app/) in the phone's browser.

- iPhone/iPad: Safari → Share → Add to Home Screen → Add.
- Android: Chrome → menu → Install app (or Add to Home screen).

The installed app is named **Click Clacks** and launches the roller in a standalone
window. Its start URL is the app root, independent of any room link used during
installation. The ordinary app decides which table to resume from its saved state.

## Assets and launch metadata

The app's Vite configuration uses `scripts/lib/pwa-build.ts` to provide:

- `manifest.webmanifest`, with stable ID, scope and start URL matching the hosting
  base (`/` on the app domain, `/powerroller/` in the default prefixed build).
- 192 × 192 and 512 × 512 PNG icons, plus a 512 × 512 maskable icon.
- A 180 × 180 Apple touch icon and standalone launch metadata in the full app's
  document. The embedded tray keeps its existing document metadata.

Every raster icon is rendered from `web/branding/click-clacks-app-icon.svg`, a
square version of the favicon artwork. The hexagon is centered at (82, 82) in
its 164 × 164 viewBox; the lightning bolt and pink accents keep their positions
relative to it. The maskable icon has more background padding so adaptive
home-screen crops keep the artwork. Raster files are generated build output.
Vite's development server serves the same generated assets. No new runtime
dependency is required. The revised icon paths include `-v2` to avoid reusing
cached images; existing installed icons may require removal and reinstallation.

Installation metadata does not register a service worker or cache pages. Page
loading and the existing local/shared roll modes keep their ordinary network
behavior. Browser install prompts can depend on engagement and device settings.

The implementation follows [Chrome's install criteria](https://web.dev/articles/install-criteria)
and [WebKit's home-screen app guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
Physical-phone installation remains a manual device check; browser manifest and
built-asset verification can prove the supplied metadata and icon files.

## Verification and publication

Focused Test and final QC accepted `0c133e3`. Root and prefixed builds exited 0;
built and development manifest/icon GET/HEAD requests returned 200 with the
expected MIME types. Icons decoded at their declared sizes and the maskable
artwork stayed inside the safe region. Chromium's manifest and installability
APIs returned no errors for the app root and a room-query URL. Embedded tray
metadata was unchanged. Backend HTTP and WebSocket requests were blocked during
these checks. Evidence remains outside Git at `test-artifacts/pwa-0c133e3/`.
Physical-phone installation was not exercised.

Runtime-identical PWA code was combined with separately reviewed homepage changes
and published from pushed main `486623f` on 2026-10-02. Required app and landing
builds and Wrangler 4.134.0 deployments exited 0. App Worker:
`83e96748-c9a2-43f8-8e6a-2e2db2af97bf`. Landing Worker:
`892a92d4-14ed-47c8-bf6a-caff6189f654`. Publication logs remain outside Git at
`test-artifacts/pwa-publication-486623f/`. Accepted verification was reused;
no post-publication test or backend deployment ran.

The centered icon revision `b5be6c3` was accepted by focused Test and final QC.
Root and prefixed builds exited 0. All four PNG sizes matched their declarations;
the mint hexagon's raster bounds were centered exactly on each pixel grid.
The maskable artwork's maximum radius was 176.8 px, inside the 204.8 px safe
radius. Manifest and Apple metadata referenced the emitted `-v2` assets, and
tray metadata stayed unchanged. Evidence: `test-artifacts/pwa-centered-b5be6c3/`.
The required app build and deployment exited 0 from pushed main `b5be6c3` on
2026-10-02, publishing Worker `540a16bf-6b54-471f-822f-4f4a5af95ca7`.
Publication logs: `test-artifacts/pwa-centered-publication-b5be6c3/`.
Accepted evidence was reused; physical-phone installation remains unverified.
