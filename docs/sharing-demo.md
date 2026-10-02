# Sharing menu and website recording

The Sharing dialog shows the table code followed by separate copy-code and copy-link buttons. The redundant, truncated URL field is removed. Each action retains its accessible name, confirmation, and clipboard-error fallback.

The website's sharing section uses “share menu” and replaces the example invitation with a square recording: home, Sharing, copy code, return home, second player joins and rolls. Native playback controls, a roll-result poster, and a visible text alternative accompany the silent clip. `preload="none"` avoids downloading the recording on page load.

The recording uses source `9bb9712`, two fresh Chromium identities (Alex and Sam), and a disposable table on the dedicated Powerroller backend. Both app histories and a persisted backend readback agree on Sam's 1d20 result of 3. The final H.264 recording is 720 × 720, 30fps, and 17.433 seconds. The recording and poster are authored release assets, outside Git; `docs/assets/sharing-demo.json` pins their public URLs and SHA-256 checksums. The landing build downloads or verifies cached media before Vite copies it into the public output. A checksum failure stops the build. Hash-based filenames allow immutable caching.

Test and QC accepted the menu and real recording at `9bb9712`: code/link clipboard actions, denial fallbacks, 320px/430px layouts, and 480px tray layout passed. Evidence is outside Git at `/srv/presidium/home/projects/powerroller/test-artifacts/sharing-video-9bb9712/RESULT.md`. Final landing integration and publication are pending review.
