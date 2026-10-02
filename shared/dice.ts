// SPDX-License-Identifier: MIT
/** Roll taps are spaced two seconds apart; preparation counts toward the wait. */
export const rollCooldownMs = 2000;
export type DiceConfiguration = {
  kind: "power" | "dice" | "percentile";
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  count: number;
  bonusD4?: boolean;
};
export const defaultDice: DiceConfiguration = {
  kind: "power",
  sides: 10,
  count: 2,
};
export function validateDiceConfiguration(
  value: DiceConfiguration = defaultDice,
): DiceConfiguration {
  if (
    !["power", "dice", "percentile"].includes(value.kind) ||
    ![4, 6, 8, 10, 12, 20].includes(value.sides) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 20 ||
    (value.bonusD4 !== undefined && typeof value.bonusD4 !== "boolean") ||
    (value.bonusD4 === true && (value.kind === "power" || value.sides === 4)) ||
    (["power", "percentile"].includes(value.kind) && (value.sides !== 10 || value.count !== 2))
  )
    throw new Error(
      "Choose a power roll (2d10), percentile roll (paired d10s), or 1–20 dice with 4, 6, 8, 10, 12 or 20 sides.",
    );
  return value;
}

export type GenericModifierStage = 0 | 1 | 2;
/** Generic bonus/penalty clicks select no modifier, two, then five. */
export function genericModifierValue(stage: GenericModifierStage): number {
  if (!Number.isInteger(stage) || stage < 0 || stage > 2)
    throw new Error('Choose a generic modifier stage from zero to two.');
  return [0, 2, 5][stage]!;
}
export function genericModifier(edges: number, banes: number): number {
  return genericModifierValue(edges as GenericModifierStage) - genericModifierValue(banes as GenericModifierStage);
}


/** Base pool first, followed by the optional bonus d4. count denotes base dice only. */
export function dicePoolSides(dice: DiceConfiguration): number[] {
  validateDiceConfiguration(dice);
  return [...Array.from({length:dice.count},()=>dice.sides),...(dice.bonusD4?[4]:[])];
}
export function dicePoolCount(dice: DiceConfiguration): number {
  validateDiceConfiguration(dice);
  return dice.count + (dice.bonusD4 ? 1 : 0);
}

export function dieSides(dice: DiceConfiguration, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= dicePoolCount(dice))
    throw new Error('Choose an index within the configured dice pool.');
  return dice.bonusD4 && index === dice.count ? 4 : dice.sides;
}

/** Tens first, units second; a physical 10 denotes zero, and double zero denotes 100. */
export function resolvePercentile(tens: number, units: number): number {
  if (![tens, units].every(value => Number.isInteger(value) && value >= 1 && value <= 10))
    throw new Error('Percentiles require two valid d10 faces.');
  const value = (tens % 10) * 10 + (units % 10);
  return value || 100;
}
/** Resolve the base pool before adding the optional d4; raw d10 faces remain 1–10. */
export function naturalDiceTotal(faces: readonly number[], dice: DiceConfiguration = defaultDice): number {
  const sides = dicePoolSides(dice);
  if (faces.length !== sides.length || faces.some((face, index) => !Number.isInteger(face) || face < 1 || face > sides[index]!))
    throw new Error('Provide one valid face for each requested die.');
  if (dice.kind === 'percentile')
    return resolvePercentile(faces[0]!, faces[1]!) + (dice.bonusD4 ? faces[2]! : 0);
  return faces.reduce((sum, face) => sum + face, 0);
}
