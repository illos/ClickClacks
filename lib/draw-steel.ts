// SPDX-License-Identifier: MIT
import { resolveEdgeBane, tierOf } from '../shared/resolve/index.ts';
export { resolveEdgeBane, baseTierOf, tierOf } from '../shared/resolve/index.ts';
/** Compendium rule/dice/{power-roll,edge,bane,tier-outcome,natural-roll}.md.
 * This basic power roll makes no ability-specific critical-hit claim. */
export function resolvePowerRoll(faces: readonly number[], edges = 0, banes = 0, characteristic = 0) {
  if (faces.length !== 2 || faces.some(face=>!Number.isInteger(face)||face<1||face>10)) throw new Error('Power rolls require two d10 faces.');
  if (![edges,banes].every(value=>Number.isInteger(value)&&value>=0&&value<=2) || !Number.isSafeInteger(characteristic) || Math.abs(characteristic) > 1_000_000) throw new Error('Provide valid power-roll modifiers.');
  const natural = faces[0]!+faces[1]!;
  const adjustment = resolveEdgeBane(edges,banes);
  const total = natural+characteristic+adjustment.modifier;
  const tier = natural>=19 ? 3 : tierOf(total,adjustment.tierShift);
  return { natural,total,tier,edges,banes,characteristic,adjustment };
}

function modifiers(edges: number, banes: number, characteristic: number, bonus: number) {
  if (![edges, banes].every(value => Number.isInteger(value) && value >= 0 && value <= 2) ||
      ![characteristic, bonus].every(value => Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000))
    throw new Error('Provide bounded integer modifiers and edge/bane counts from zero to two.');
  return 2 * (edges - banes);
}
function powerFaces(faces: readonly number[]) {
  if (faces.length !== 2 || faces.some(face => !Number.isInteger(face) || face < 1 || face > 10))
    throw new Error('Provide two d10 faces.');
  return faces[0]! + faces[1]!;
}
export type TotalModifiers = { edges?: number; banes?: number; characteristic?: number; bonus?: number };
/** Compendium rule/dice/opposed-power-roll.md: totals, not tiers; double edge/bane is ±4.
 * A tie leaves the scene unchanged. Automatic tier adjustments convert to ±4 each. */
export function resolveOpposedRoll(faces: readonly number[], options: TotalModifiers & { automaticTierAdjustment?: number } = {}) {
  const natural = powerFaces(faces);
  const { edges = 0, banes = 0, characteristic = 0, bonus = 0, automaticTierAdjustment = 0 } = options;
  if (!Number.isSafeInteger(automaticTierAdjustment) || Math.abs(automaticTierAdjustment) > 100)
    throw new Error('Provide a bounded automatic tier adjustment.');
  const modifier = characteristic + bonus + modifiers(edges, banes, characteristic, bonus) + 4 * automaticTierAdjustment;
  return { natural, modifier, total: natural + modifier };
}
export function compareOpposedRolls(left: number, right: number): 'left' | 'right' | 'unchanged' {
  if (![left, right].every(Number.isSafeInteger)) throw new Error('Compare integer opposed totals.');
  return left === right ? 'unchanged' : left > right ? 'left' : 'right';
}
/** Compendium rule/downtime/project-roll.md, Project Roll / Project Roll Edges and Banes.
 * Bonus dice are explicit host inputs; a breakthrough uses the original 2d10 natural total. */
export function resolveProjectRoll(faces: readonly number[], options: TotalModifiers & { extraValues?: readonly number[] } = {}) {
  const natural = powerFaces(faces);
  const { edges = 0, banes = 0, characteristic = 0, bonus = 0, extraValues = [] } = options;
  if (extraValues.length > 98 || extraValues.some(value => !Number.isInteger(value) || value < 1 || value > 1000))
    throw new Error('Provide bounded positive bonus-die values.');
  const modifier = characteristic + bonus + modifiers(edges, banes, characteristic, bonus);
  const extraTotal = extraValues.reduce((sum, value) => sum + value, 0);
  return { natural, extraTotal, modifier, total: Math.max(1, natural + extraTotal + modifier), breakthrough: natural >= 19 };
}
function singleD10(face: number) {
  if (!Number.isInteger(face) || face < 1 || face > 10) throw new Error('Provide one d10 face.');
}
/** Compendium rule/general/saving-throw.md: a d10 result of six or higher ends the effect. */
export function resolveSavingThrow(face: number) {
  singleD10(face);
  return { total: face, success: face >= 6 };
}
/** Compendium rule/combat/combat-round.md, Determine Who Goes First.
 * Identifies who chooses the first side; does not automatically grant a creature a turn. */
export function resolveCombatOpening(face: number) {
  singleD10(face);
  return { total: face, chooser: face >= 6 ? 'players' as const : 'director' as const };
}
