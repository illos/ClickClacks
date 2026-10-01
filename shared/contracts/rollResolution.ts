// SPDX-License-Identifier: MIT
// Original standalone power-roll result types; no campaign dependencies.
export type Tier = 1 | 2 | 3;

export interface EdgeBaneResolution {
  edges: number;
  banes: number;
  effectiveEdges: 0 | 1 | 2;
  effectiveBanes: 0 | 1 | 2;
  net: -2 | -1 | 0 | 1 | 2;
  modifier: -2 | 0 | 2;
  tierShift: -1 | 0 | 1;
}
