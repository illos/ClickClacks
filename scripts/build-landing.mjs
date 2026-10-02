// SPDX-License-Identifier: MIT
import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
if (!process.env.VITE_CONVEX_URL) throw new Error('Set the public VITE_CONVEX_URL for the landing mini demo.');
await build({ configFile: 'vite.landing.config.ts' });
await copyFile('dist/landing-demo/landing.html', 'dist/landing-demo/index.html');
