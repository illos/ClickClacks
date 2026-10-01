// SPDX-License-Identifier: MIT
import approved from '../../shared/dice-default-palette.json';
import type { Style } from '../dice-demo/model';

/** User-approved complete combinations; never independently reshuffle their components. */
export const defaultDicePalette: readonly Style[] = approved.palette.map(entry => {
  const pattern = (['solid', 'speckle', 'marble', 'frosted'] as const).find(
    p => p === entry.pattern,
  );
  const font = (['serif', 'modern', 'rune', 'gothic'] as const).find(f => f === entry.font);
  if (
    !pattern ||
    !font ||
    !/^#[a-f0-9]{6}$/i.test(entry.color) ||
    !/^#[a-f0-9]{6}$/i.test(entry.ink)
  )
    throw new Error(`Invalid approved dice style ${entry.id}.`);
  return { color: entry.color, ink: entry.ink, pattern, font };
});
