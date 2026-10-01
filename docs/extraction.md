# Direct extraction

Source: Salient `23cf9035b6e55d3e2e3a8198cba8c2320e7d205b` (approved V272).
The owner discarded the first extraction and its attempted parity rewrite. All of
that application code was removed before copying the original project files.

## Copied implementation

- `web/dice-demo-v2/`: original page, renderer, preview, clock sync, model, palette,
  color controls, CSS and API references.
- `web/dice-demo/`: original shared d10 geometry/materials, physics solver, worker,
  throw preparation, fonts, model, renderer, CSS and API references.
- `web/components/game-values.css`, `shared/dice-default-palette.json` and
  `scripts/lib/dice-font-build.ts`.
- `convex/diceDemo.ts`, `diceDemoTables.ts`, `diceDemoV2.ts`, `diceDemoV2Tables.ts`.
- Original `generate`/`draw`/validation functions and SHA256 helper; original
  `resolveEdgeBane`, `baseTierOf`, `tierOf` functions and their required types.
- Original `tests/app/dice-demo.test.ts` and `dice-demo-v2.test.ts`.

## Standalone adaptations

- Minimal package, TypeScript/Vite configuration, root HTML entry and GitHub Pages workflow.
- Header's Salient home link points to this repository; expired-room link uses the
  standalone base URL. HTML title drops En Garde branding.
- Original backend schema is mounted independently. Catalog-backed cosmetic names
  are replaced with a small standalone name pool behind the same API; its unused
  catalog cache table is omitted.
- Shared arithmetic/generator functions are copied out of their larger Salient
  modules; campaign state, campaign commands and unrelated game engine imports are omitted.
- Original tests use an isolated Convex fixture instead of Salient's campaign fixture.
- SPDX headers reflect the owner's existing MIT authorization. Font notices are unchanged.

No changes to the original renderer, solver, worker, animation paths, preview,
layout, menus, error handling, shared clearing, roll timing or roll acceptance logic.

## Validation and publication

28 frontend files preserve original source bytes after only the declared license/navigation substitutions. All relative imports and assets resolve.

Standalone typecheck passed. Both original test files passed:7 tests (477ms).
Production build passed, including the original physics worker and all four font files/notices.
Publication pending.
