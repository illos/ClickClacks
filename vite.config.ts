import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
const buildCommit = process.env.VITE_BUILD_COMMIT ?? execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
import { diceFontNotices } from './scripts/lib/dice-font-build.ts';

export default defineConfig({
  base: process.env.CLICKCLACKS_BASE ?? process.env.POWERROLLER_BASE ?? '/powerroller/',
  define: { 'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(buildCommit) },
  plugins: [react(), diceFontNotices()],
  build: { assetsInlineLimit: 0, rollupOptions: { input: { site: 'index.html', tray: 'web/popout/tray.html' } } },
});
