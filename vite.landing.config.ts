// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diceFontNotices } from './scripts/lib/dice-font-build.ts';

/** Isolated demo build; the published roller's entry points stay in vite.config.ts. */
export default defineConfig({
  base: '/',
  publicDir: 'web/landing/public',
  plugins: [react(), diceFontNotices()],
  build: {
    outDir: 'dist/landing-demo',
    assetsInlineLimit: 0,
    rollupOptions: { input: { landing: 'landing.html', mini: 'web/landing/mini.html' } },
  },
});
