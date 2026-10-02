import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diceFontNotices } from './scripts/lib/dice-font-build.ts';

export default defineConfig({
  base: process.env.CLICKCLACKS_BASE ?? process.env.POWERROLLER_BASE ?? '/powerroller/',
  plugins: [react(), diceFontNotices(), {
    name: 'legacy-tray-document',
    generateBundle(_options, bundle) {
      const tray = bundle['web/popout/tray.html'];
      if (tray?.type === 'asset') this.emitFile({type:'asset', fileName:'pip/web/popout/tray.html', source:tray.source});
    },
  }],
  build: { assetsInlineLimit: 0, rollupOptions: { input: { site: 'index.html', tray: 'web/popout/tray.html' } } },
});
