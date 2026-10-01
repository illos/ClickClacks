// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diceFontNotices } from '../../scripts/lib/dice-font-build.ts';

export default defineConfig({
  base: `${process.env.POWERROLLER_BASE ?? '/powerroller/'}pip/`,
  plugins: [react(), diceFontNotices()],
  build: {
    outDir: 'dist/pip',
    assetsInlineLimit: 0,
    rollupOptions: {input:'web/popout/tray.html'},
  },
});
