// SPDX-License-Identifier: MIT
// Original power-roll arithmetic subset. Compendium rule/dice/{edge,bane,tier-outcome}.md.
import type { EdgeBaneResolution, Tier } from '../contracts/rollResolution.ts';

/** Section 1.4: counts above two add nothing; net decides a ±2 modifier or a one-tier shift. */
export function resolveEdgeBane(edges: number, banes: number): EdgeBaneResolution {
  const effectiveEdges = Math.min(edges, 2) as 0 | 1 | 2;
  const effectiveBanes = Math.min(banes, 2) as 0 | 1 | 2;
  const net = (effectiveEdges - effectiveBanes) as -2 | -1 | 0 | 1 | 2;
  const modifier = net === 1 ? 2 : net === -1 ? -2 : 0;
  const tierShift = net === 2 ? 1 : net === -2 ? -1 : 0;
  return { edges, banes, effectiveEdges, effectiveBanes, net, modifier, tierShift };
}


/** Section 1.5: 11 or lower is tier 1, 12 to 16 tier 2, 17 or higher tier 3. */
export function baseTierOf(total: number): Tier {
  return total <= 11 ? 1 : total <= 16 ? 2 : 3;
}

/** Section 1.5: the base tier plus the double edge/bane shift, clamped to 1..3. */
export function tierOf(total: number, tierShift: -1 | 0 | 1): Tier {
  return Math.max(1, Math.min(3, baseTierOf(total) + tierShift)) as Tier;
}
