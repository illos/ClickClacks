// SPDX-License-Identifier: MIT
import { generate, validateDice } from '../shared/generate.ts';
import type { DieSpec, DieResult } from '../shared/contracts/history.ts';
export { generate, validateDice, MAX_DICE, MAX_SIDES } from '../shared/generate.ts';
export type { DieSpec, DieResult } from '../shared/contracts/history.ts';
export type DiceGroup = { sides: number; count: number; id?: string };
export type KeepPolicy = { mode: 'highest' | 'lowest'; count: number };
export type PoolResult = { dice: (DieResult & { kept: boolean })[]; naturalTotal: number; modifier: number; total: number };
export function expandDice(groups: readonly DiceGroup[]): DieSpec[] {
  if (!groups.length || groups.length > 100) throw new Error('Provide at least one bounded dice group.');
  const dice: DieSpec[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    if (!Number.isInteger(group.count) || group.count < 1 || dice.length + group.count > 100) throw new Error('Roll between 1 and 100 dice.');
    for (let index = 0; index < group.count; index++) dice.push({ id: `${group.id ?? `group-${groupIndex}`}:${index}`, sides: group.sides });
  }
  validateDice(dice);
  return dice;
}
/** Reuse the copied unbiased generator; cosmetic workers never produce logical values. */
export function generatePool(groups: readonly DiceGroup[]) {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure randomness is unavailable. Supply authoritative values to resolvePool instead.");
  const seed = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return generate(seed, 0, expandDice(groups)).dice;
}
export function resolvePool(dice: readonly DieSpec[], values: readonly number[], options: { modifier?: number; keep?: KeepPolicy } = {}): PoolResult {
  validateDice([...dice]);
  if (values.length !== dice.length || values.some((value,index) => !Number.isInteger(value) || value < 1 || value > dice[index]!.sides)) throw new Error('Provide one valid face for each requested die.');
  const modifier = options.modifier ?? 0;
  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 1_000_000) throw new Error('Provide a bounded integer modifier.');
  const keep = options.keep;
  if (keep && (!['highest','lowest'].includes(keep.mode) || !Number.isInteger(keep.count) || keep.count < 1 || keep.count > dice.length)) throw new Error('Choose a valid number of dice to keep.');
  const ranked = values.map((value,index) => ({ value,index })).sort((a,b) => (keep?.mode === 'lowest' ? a.value-b.value : b.value-a.value) || a.index-b.index);
  const kept = new Set(ranked.slice(0,keep?.count ?? dice.length).map(value=>value.index));
  const resolved = dice.map((die,index)=>({ ...die,value:values[index]!,kept:kept.has(index) }));
  const naturalTotal = resolved.reduce((sum,die)=>sum+(die.kept?die.value:0),0);
  return { dice:resolved,naturalTotal,modifier,total:naturalTotal+modifier };
}
export { resolvePercentile } from '../shared/dice.ts';
