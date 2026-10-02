// SPDX-License-Identifier: MIT
export function historyDeadline(roll: { startsAt: number; historyExpiresAt?: number }): number {
  return Number.isFinite(roll.historyExpiresAt)
    ? Math.min(roll.startsAt + 3600000, roll.historyExpiresAt!)
    : roll.startsAt + 3600000;
}
