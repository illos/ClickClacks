// SPDX-License-Identifier: MIT
import { defaultDice, type DiceConfiguration } from '../shared/dice';

export type CriticalResult = 'success' | 'failure' | null;
export type CriticalRoll = { faces: readonly number[]; dice?: DiceConfiguration };

/** Owner-requested standalone labels, derived only from natural faces.
 * Power 19/20: Compendium rule/dice/natural-19-20.md, “Success With a Reward”.
 * Double-one failure and single-d20 endpoints are the owner's display policy.
 * This classifies results; it never applies actions or changes totals. */
export function criticalResult(roll: CriticalRoll): CriticalResult {
  const dice = roll.dice ?? defaultDice;
  if (dice.kind === 'power') {
    if (roll.faces.length !== 2 || roll.faces.some(face => !Number.isInteger(face) || face < 1 || face > 10)) return null;
    const natural = roll.faces[0]! + roll.faces[1]!;
    return natural >= 19 ? 'success' : natural === 2 ? 'failure' : null;
  }
  if (dice.sides !== 20 || dice.count !== 1) return null;
  return roll.faces[0] === 20 ? 'success' : roll.faces[0] === 1 ? 'failure' : null;
}

export function criticalLabel(result: Exclude<CriticalResult, null>) {
  return result === 'success' ? 'Crit' : 'Crit fail';
}
