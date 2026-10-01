// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Keep embedded fonts' OFL notices with every distributed standalone V2 build. */
export function diceFontNotices(): Plugin {
  return {
    name: 'dice-font-notices',
    generateBundle() {
      const root = new URL('../../web/dice-demo/fonts/', import.meta.url);
      const sources = [
        'README.md',
        ...['serif', 'modern', 'rune', 'gothic'].map(font => `${font}-OFL.txt`),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'dice-font-licenses.txt',
        source: sources
          .map(name => `${name}\n\n${readFileSync(new URL(name, root), 'utf8')}`)
          .join('\n\n'),
      });
    },
  };
}
