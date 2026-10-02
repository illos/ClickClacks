// SPDX-License-Identifier: MIT
import { build } from 'vite';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { prepareLandingPublic } from './lib/landing-media.mjs';
if (!process.env.VITE_CONVEX_URL) throw new Error('Set the public VITE_CONVEX_URL for the landing mini demo.');
const publicDir = await prepareLandingPublic();
await build({ configFile: 'vite.landing.config.ts', publicDir });
await copyFile('dist/landing-demo/landing.html', 'dist/landing-demo/index.html');

// Raster social cards are build output; the SVG wordmark remains the only source.
const wordmark = await readFile('web/branding/click-clacks.svg', 'utf8');
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111415"/>
  <path d="M0 40H1200M0 590H1200" stroke="#6edbc0" stroke-width="4"/>
  ${wordmark.replace('<svg ', '<svg x="120" y="105" width="960" height="420" ')}
</svg>`;
await writeFile('dist/landing-demo/social-preview.png', new Resvg(card, {
  font: { loadSystemFonts: false },
}).render().asPng());
