// SPDX-License-Identifier: MIT
import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
import { writeSocialPreview } from './lib/social-preview.mjs';
if (!process.env.VITE_CONVEX_URL) throw new Error('Set the public VITE_CONVEX_URL for the landing mini demo.');
await build({ configFile: 'vite.landing.config.ts' });
await copyFile('dist/landing-demo/landing.html', 'dist/landing-demo/index.html');

// Shared source artwork keeps website/app link previews consistent.
await writeSocialPreview('dist/landing-demo/social-preview-v2.png');
// Preserve previews cached with the earlier image URL.
await copyFile('dist/landing-demo/social-preview-v2.png', 'dist/landing-demo/social-preview.png');
