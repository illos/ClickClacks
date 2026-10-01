// SPDX-License-Identifier: MIT
// Standalone subset of Salient convex/lib/dice.ts: original validation and hash-stream generation.
import { ConvexError } from 'convex/values';
import type { DieResult, DieSpec } from '../../shared/contracts/history';
import { sha256 } from './sha256';

/** Bounds on one request. Any larger request is not a table roll. */
export const MAX_DICE = 100;
export const MAX_SIDES = 1000;

export function validateDice(dice: DieSpec[]): void {
  if (!dice.length || dice.length > MAX_DICE)
    throw new ConvexError(`Roll between 1 and ${MAX_DICE} dice.`);
  const ids = new Set<string>();
  for (const die of dice) {
    if (!Number.isInteger(die.sides) || die.sides < 2 || die.sides > MAX_SIDES)
      throw new ConvexError(`Each die needs an integer side count between 2 and ${MAX_SIDES}.`);
    if (!die.id || die.id.length > 64 || ids.has(die.id))
      throw new ConvexError('Each die needs a distinct id of at most 64 characters.');
    ids.add(die.id);
  }
}

/** Draws value `counter` of the campaign stream as an unsigned 32-bit integer. */
function draw(seed: Uint8Array, counter: number): number {
  const input = new Uint8Array(seed.length + 8);
  input.set(seed);
  new DataView(input.buffer).setBigUint64(seed.length, BigInt(counter));
  return new DataView(sha256(input).buffer).getUint32(0);
}

/**
 * Pure generation from a seed and a starting counter: returns the faces and the next counter.
 * Rejection sampling discards draws at or above the largest multiple of `sides` below 2^32.
 */
export function generate(
  seed: Uint8Array,
  counter: number,
  dice: DieSpec[],
): { dice: DieResult[]; counter: number } {
  const results: DieResult[] = [];
  for (const die of dice) {
    const limit = Math.floor(0x100000000 / die.sides) * die.sides;
    let value: number;
    do {
      value = draw(seed, counter++);
    } while (value >= limit);
    results.push({ id: die.id, sides: die.sides, value: (value % die.sides) + 1 });
  }
  return { dice: results, counter };
}
