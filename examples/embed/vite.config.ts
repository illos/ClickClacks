// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diceFontNotices } from '../../scripts/lib/dice-font-build.ts';

export default defineConfig({
  base: '/',
  plugins: [react(), diceFontNotices()],
  server: { allowedHosts: ['presidium-iv.tail41404c.ts.net'] },
  build: {
    outDir: 'dist/embed-demo',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        demo: 'examples/embed/index.html',
        embed: 'embed/index.html',
      },
    },
  },
});
