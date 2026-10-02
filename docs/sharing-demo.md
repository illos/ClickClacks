# Sharing menu and website recording

The Sharing dialog shows the table code followed by separate copy-code and copy-link buttons. The redundant, truncated URL field is removed. Each action retains its accessible name, confirmation, and clipboard-error fallback.

The website's sharing section uses “share menu” and replaces the example invitation with a square recording: home, Sharing, copy code, return home, second player joins and rolls. Native playback controls, a roll-result poster, and a visible text alternative accompany the silent clip. `preload="none"` avoids downloading the recording on page load.

The recording uses source `9bb9712`, two fresh Chromium identities (Alex and Sam), and a disposable table on the dedicated Powerroller backend. Both app histories and a persisted backend readback agree on Sam's 1d20 result of 3. The final H.264 recording is 720 × 720, 30fps, and 17.433 seconds. The recording and poster are authored release assets, outside Git; `docs/assets/sharing-demo.json` pins their public URLs and SHA-256 checksums. The landing build downloads or verifies cached media before Vite copies it into the public output. A checksum failure stops the build. Hash-based filenames allow immutable caching.

Test and QC accepted the menu and real recording at `9bb9712`: code/link clipboard actions, denial fallbacks, 320px/430px layouts, and 480px tray layout passed. Evidence is outside Git at `/srv/presidium/home/projects/powerroller/test-artifacts/sharing-video-9bb9712/RESULT.md`.

Final landing integration passed Test and QC at `ded5296`: cached media matched manifest checksums, the landing build exited 0, and corrupt cache plus an invalid replacement download was rejected. The video fit at 320/430/720/1440px, displayed its poster and text description, and made no startup MP4 request. Keyboard Space started playback, which reached the end at 17.433 seconds. Backend traffic was blocked during these integration checks. Evidence: `/srv/presidium/home/projects/powerroller/test-artifacts/sharing-integrate-ded5296/RESULT.md`.

Source `ded5296` was merged into main and pushed. The [authored media release](https://github.com/illos/powerroller/releases/tag/sharing-demo-20261002) was then published from that main commit. Both required production builds and pinned Wrangler 4.134.0 deployments exited 0; the clean landing build downloaded and checksum-verified the released assets. Publication reused accepted tests without rerunning them.

- App: `https://dice.clickclacks.app/`, Worker `a133d89b-7875-4d3f-83c1-1e30820b874a`.
- Website: `https://clickclacks.app/`, Worker `b0076e55-90ce-4fec-869f-d708732626cb`.
- Publication logs: `/srv/presidium/home/projects/powerroller/test-artifacts/sharing-publication-ded5296/`.
