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
