// SPDX-License-Identifier: MIT
import { dieFonts, dieFontFamilies, dieFontWeights, type DieFont } from "./d10";
const serif = new URL("./fonts/serif.woff2", import.meta.url).href;
const modern = new URL("./fonts/modern.woff2", import.meta.url).href;
const rune = new URL("./fonts/rune.woff2", import.meta.url).href;
const gothic = new URL("./fonts/gothic.woff2", import.meta.url).href;

const sources: Record<DieFont, string> = { serif, modern, rune, gothic };

const fontDeadlineMs = 3000;

/** Load instance-owned fonts before baking numeral textures; abort removes only this instance’s faces. */
export function loadDiceFonts(signal?: AbortSignal) {
  return Promise.all(
    dieFonts.map(async (font) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const face = new FontFace(
          dieFontFamilies[font],
          `url(${sources[font]})`,
          {
            weight: String(dieFontWeights[font]),
            style: "normal",
          },
        );
        const loaded = await Promise.race([
          face.load(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("Dice font deadline exceeded.")),
              fontDeadlineMs,
            );
          }),
        ]);
        // A timed-out font is never registered later or allowed to change the chosen fallback.
        if (signal?.aborted) return font;
        document.fonts.add(loaded);
        signal?.addEventListener("abort", () => document.fonts.delete(loaded), {
          once: true,
        });
        return null;
      } catch {
        return font;
      } finally {
        clearTimeout(timeout);
      }
    }),
  ).then((results) => results.filter((font): font is DieFont => font !== null));
}
