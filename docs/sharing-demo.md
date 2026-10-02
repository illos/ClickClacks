# Sharing menu and website recording

The recording described below is superseded by the [live sharing demonstration](live-sharing-demo.md).

The Sharing dialog shows the table code followed by separate copy-code and copy-link buttons. The redundant, truncated URL field is removed. Each action retains its accessible name, confirmation, and clipboard-error fallback.

The website's sharing section uses “share menu” and replaces the example invitation with a square recording: home, Sharing, copy code, return home, second player joins and rolls. Following the owner's revision, the silent clip autoplays and loops without controls. It loads when the sharing section becomes visible, pauses offscreen or in a hidden tab, and resumes when visible. A roll-result poster and visible text alternative accompany it.

The revised recording uses source `72ae958`, two fresh Chromium identities (Alex and Sam), and a disposable table on the dedicated Powerroller backend. The empty log is centered and muted before recording. Sharing remains open for 3.181 seconds after copying, and Sam starts rolling 1.326 seconds after it closes. Both app histories and persisted backend readback agree on Sam's 1d20 result of 19. The H.264 recording is 720 × 720, 30fps, and 12.10 seconds. The recording and poster are authored release assets, outside Git; `docs/assets/sharing-demo.json` pins their public URLs and SHA-256 checksums in the renamed `illos/ClickClacks` repository. The landing build downloads or verifies cached media before Vite copies it into the public output. A checksum failure stops the build. Hash-based filenames allow immutable caching.

Test accepted the new centered empty state in dark/light themes at 320/430/720px, populated-log layout, the exact-source build, and the revised real recording/readback. Evidence: `test-artifacts/sharing-autoplay-72ae958/RESULT.md`. The owner then explicitly requested live publication before further checks. Final autoplay integration checks are held for owner viewing; none ran before publication. Current website/app GitHub links and README installation URLs use `https://github.com/illos/ClickClacks`.

Test and QC accepted the menu and real recording at `9bb9712`: code/link clipboard actions, denial fallbacks, 320px/430px layouts, and 480px tray layout passed. Evidence is outside Git at `test-artifacts/sharing-video-9bb9712/RESULT.md`.

Final landing integration passed Test and QC at `ded5296`: cached media matched manifest checksums, the landing build exited 0, and corrupt cache plus an invalid replacement download was rejected. The video fit at 320/430/720/1440px, displayed its poster and text description, and made no startup MP4 request. Keyboard Space started playback, which reached the end at 17.433 seconds. Backend traffic was blocked during these integration checks. Evidence: `test-artifacts/sharing-integrate-ded5296/RESULT.md`.

Source `ded5296` was merged into main and pushed. The [authored media release](https://github.com/illos/ClickClacks/releases/tag/sharing-demo-20261002) was then published from that main commit. Both required production builds and pinned Wrangler 4.134.0 deployments exited 0; the clean landing build downloaded and checksum-verified the released assets. Publication reused accepted tests without rerunning them.

- App: `https://dice.clickclacks.app/`, Worker `a133d89b-7875-4d3f-83c1-1e30820b874a`.
- Website: `https://clickclacks.app/`, Worker `b0076e55-90ce-4fec-869f-d708732626cb`.
- Publication logs: `test-artifacts/sharing-publication-ded5296/`.

The revised source `b127643` was merged into main and pushed on 2026-10-02. The [revised media release](https://github.com/illos/ClickClacks/releases/tag/sharing-demo-20261002-v2) was published from that commit. Required app/landing builds and Wrangler 4.134.0 deployments exited 0. The landing build downloaded and checksum-verified the revised release assets. This publication follows the owner's live-before-checks instruction and does not claim an autoplay browser test result.

- Revised app: Worker `b03a7e42-3cf6-4076-8d5f-440ba6153812`.
- Revised website: Worker `6f7119b3-0196-42aa-976c-4db1f2d30f91`.
- Revision publication logs: `test-artifacts/sharing-publication-b127643/`.
