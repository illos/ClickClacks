// SPDX-License-Identifier: MIT
import { dieFonts, dieFontFamilies, dieFontWeights, type DieFont } from './d10';
import serif from './fonts/serif.woff2?url';
import modern from './fonts/modern.woff2?url';
import rune from './fonts/rune.woff2?url';
import gothic from './fonts/gothic.woff2?url';

const sources: Record<DieFont, string> = { serif, modern, rune, gothic };
let loading: Promise<DieFont[]> | undefined;
const fontDeadlineMs = 3000;

/** Load once before baking numeral textures; all remote styles are available before shared tray playback. */
export function loadDiceFonts() {
  return (loading ??= Promise.all(
    dieFonts.map(async font => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const face = new FontFace(dieFontFamilies[font], `url(${sources[font]})`, {
          weight: String(dieFontWeights[font]),
          style: 'normal',
        });
        const loaded = await Promise.race([
          face.load(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Dice font deadline exceeded.')),
              fontDeadlineMs,
            );
          }),
        ]);
        // A timed-out font is never registered later or allowed to change the chosen fallback.
        document.fonts.add(loaded);
        return null;
      } catch {
        return font;
      } finally {
        clearTimeout(timeout);
      }
    }),
  ).then(results => results.filter((font): font is DieFont => font !== null)));
}
