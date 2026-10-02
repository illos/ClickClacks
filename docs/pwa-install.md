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

Every raster icon is rendered from `web/branding/click-clacks-mark.svg`, the
existing favicon. The maskable icon has more background padding so adaptive
home-screen crops keep the artwork. Raster files are generated build output;
the SVG remains the single artwork source. Vite's development server serves the
same generated assets. No new runtime dependency is required.

Installation metadata does not register a service worker or cache pages. Page
loading and the existing local/shared roll modes keep their ordinary network
behavior. Browser install prompts can depend on engagement and device settings.

The implementation follows [Chrome's install criteria](https://web.dev/articles/install-criteria)
and [WebKit's home-screen app guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
Physical-phone installation remains a manual device check; browser manifest and
built-asset verification can prove the supplied metadata and icon files.
