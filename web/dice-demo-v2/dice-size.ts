// SPDX-License-Identifier: MIT
/** Keep small throws enlarged; cap larger pools' total footprint without changing old rolls. */
export function trayDieScale(count = 2): number {
  return Math.max(0.5, 0.65 * 1.15 * Math.sqrt(6 / Math.max(6, count)));
}
