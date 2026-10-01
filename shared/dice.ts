// SPDX-License-Identifier: MIT
export type DiceConfiguration = {
  kind: "power" | "dice";
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  count: number;
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
    !["power", "dice"].includes(value.kind) ||
    ![4, 6, 8, 10, 12, 20].includes(value.sides) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 20 ||
    (value.kind === "power" && (value.sides !== 10 || value.count !== 2))
  )
    throw new Error(
      "Choose a power roll (2d10) or 1–20 dice with 4, 6, 8, 10, 12 or 20 sides.",
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
