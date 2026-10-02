# Public readiness review

Reviewed on 2026-10-02, starting from `e374e00`. This covers the repository's
current files, public project metadata, and the published landing page and roller.
It is not a full security, gameplay, accessibility or Git-history audit.

## Cleanup in this change

- Removed references to the originating application from current repository text.
- Corrected the component and API guides to use the `clickclacks` package and
  the `components.clickclacks` namespace for new installations. The hosted
  installation retains its existing `powerroller` namespace.
- Updated old repository links and made private test-evidence paths relative.
- Added a documentation index separating contributor guides from historical
  investigations and release records.
- Added both audio creators to the README credits. The sword-draw clip's spoken
  reuse permission was confirmed by the maintainer; its credits now record that
  permission instead of treating the video description as the only source.
- Kept license notices, rules citations, compatibility identifiers and recorded
  verification results.

## Public site findings

The assigned test coordinator inspected the landing page and app in Chromium
at 1440 × 900, 390 × 844 and 320 × 700. Settings, Sharing and customization menus
fit all three sizes. There were no page exceptions, console errors, failed
network requests, horizontal overflow, broken visible links or unexpected debug
copy. Lazy sharing and customization sections rendered after scrolling.

The advertised standalone tray URL loaded at 720 × 720 and 320 × 420 with visible
controls, a connected participant and no errors. At 320 pixels, Roll wraps onto
another row and remains visible. This inspection did not exercise rolling,
reconnection, bug-report submission, physical devices or screen readers.

Independent HTTP reads returned 200 with the expected content types for the
landing page, app, robots file, sitemap, social preview and tray document.
Raw Python requests returned 403, while curl with a browser user agent and the
coordinator's browser loaded successfully; that was a client-specific result.

Evidence is outside Git at
`test-artifacts/public-readiness-live-20261002/RESULT.md`, with screenshots and
JSON inspection details. The screenshots include initial lazy placeholders and
separate views of the sections after they loaded.

The only editorial site finding was inconsistent spelling of “Real Time” and
“Realtime” in headings. “Real-time” would be consistent with the README.

## Items to address before announcing

1. **GitHub About points to a broken legacy build.** The repository homepage is
   `https://illos.github.io/ClickClacks/`. Its HTML responds with 200, but its
   five linked script, stylesheet and icon assets use `/powerroller/` and return
   404. Point About to `https://clickclacks.app/`. If Pages is retained as a
   supported mirror, its workflow must build with the actual repository path
   rather than the default legacy asset base.
2. **Repository description is empty.** A suitable description is “Open source
   3D dice roller with shared tables, Draw Steel power rolls, and a reusable
   TypeScript library and Convex component.” Topics are also unset.
3. **Confirm the production backend decision.** Hosting records still identify
   the published backend as a dedicated development deployment and leave its
   production selection open. Confirm the intended deployment and ownership
   before treating those historical instructions as a launch runbook. No
   backend changes or deployment actions were performed in this review.

Other polish: the latest GitHub release is labelled “Revised sharing demo media,”
which contains demonstration assets rather than a versioned software release.
Historical investigation documents still contain operator-specific workflow
details; the documentation index identifies their purpose. They can be reduced
or moved out of the contributor path without changing supported APIs.

## Repository checks

A scan of 304 tracked files found no candidate private keys, GitHub tokens,
AWS access keys or long literal assignments to the checked deployment/support
credential fields. The scan reports candidate patterns, not an exhaustive
credential audit, and does not cover Git history or ignored local files.

Current contributor guides were checked for relative links, Markdown fences and
package exports. The cleanup leaves no originating-application name in tracked
text, and `git diff --check` is clean. Runtime code is unchanged apart from one
source comment. Existing live inspection results were not repeated for the
documentation commit.
