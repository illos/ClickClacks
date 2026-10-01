// SPDX-License-Identifier: MIT
export const dieFonts = ['serif', 'modern', 'rune', 'gothic'] as const;
export type DieFont = (typeof dieFonts)[number];
export const dieFontFamilies: Record<DieFont, string> = {
  serif: 'Dice Eczar',
  modern: 'Dice Sora',
  rune: 'Dice Caesar Dressing',
  gothic: 'Dice New Rocker',
};
export const dieFontWeights: Record<DieFont, number> = {
  serif: 600,
  modern: 600,
  rune: 400,
  gothic: 400,
};
