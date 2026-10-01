// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import { diceFontNotices } from '../../scripts/lib/dice-font-build.ts';

// A separate module graph keeps production app startup out of the demo.
export default defineConfig({
  base: '/',
  plugins: [diceFontNotices()],
  server: { allowedHosts: ['presidium-iv.tail41404c.ts.net'] },
  preview: { host: '127.0.0.1', port: 9601, strictPort: true },
  build: {
    outDir: '.preview/critical-sounds',
    assetsInlineLimit: 0,
    rollupOptions: { input: 'web/site/critical-sounds.html' },
  },
});
