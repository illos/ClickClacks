import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diceFontNotices } from './scripts/lib/dice-font-build.ts';

export default defineConfig({
  base: '/powerroller/',
  plugins: [react(), diceFontNotices()],
  build: { assetsInlineLimit: 0 },
});
