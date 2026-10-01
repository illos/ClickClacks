# Open questions and implementation choices

## Required external steps

- GitHub token allows pushes but Pages creation returned HTTP403. User asked to enable Settings → Pages → GitHub Actions. Actions variable VITE_CONVEX_URL was configured successfully.
- Actual VoiceOver/NVDA spoken-delivery and real-device animation checks require those environments. Automated DOM/keyboard tests will not be reported as that evidence.

## Chosen defaults (configurable for integrations)

- Eight active participants, 200 sessions per room lifetime, 24-hour rooms.
- One-hour accepted-receipt/catch-up window; request tombstones remain until room expiry. Expired retries reject explicitly.
- Shared reveal 2200ms after acceptance, animation begins150ms after acceptance.
- Launch models d3,d4,d6,d10 and percentile d100 (two d10). Graphics limit32 dice per participant; larger logical pools remain readable in text.
- Local history1000 records,30 days, partitioned by backend and table. Guest credentials live in sessionStorage; persistent preferences use localStorage.
- Equal participants can clear their own dice. Full shared archive, npm release and Salient integration are deferred.

## Resolved

- Repository illos/powerroller; Pages https://illos.github.io/powerroller/.
- Dedicated Convex dev nautical-partridge-636 confirmed and owned for deployment by the user-assigned helper thread.
- MIT for Powerroller-owned code authorized by copyright owner; font OFL and dependency notices retained; no Draw Steel catalog names/assets included.
