// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { Plugin } from 'vite';

/** Install metadata and raster icons derived from the existing favicon artwork. */
export function appInstallation(): Plugin {
  let base = '/', root = process.cwd();
  let files: Map<string, { type: string; source: string | Uint8Array }>;
  function assets() {
    if (files) return files;
    const mark = readFileSync(resolve(root, 'web/branding/click-clacks-mark.svg'), 'utf8');
    const icon = (size: number, artworkWidth: number) => {
      const height = artworkWidth * 152 / 164;
      const artwork = mark.replace('<svg ', `<svg x="${(512 - artworkWidth) / 2}" y="${(512 - height) / 2}" width="${artworkWidth}" height="${height}" `);
      return new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111415"/>${artwork}</svg>`, {
        font: { loadSystemFonts: false },
      }).render().asPng();
    };
    files = new Map([
      ['manifest.webmanifest', { type: 'application/manifest+json', source: JSON.stringify({
        id: base,
        name: 'Click Clacks',
        short_name: 'Click Clacks',
        description: 'Roll dice on your own or at a shared table.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#111415',
        theme_color: '#111415',
        icons: [
          { src: 'icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }, null, 2) }],
      ['icons/app-192.png', { type: 'image/png', source: icon(192, 400) }],
      ['icons/app-512.png', { type: 'image/png', source: icon(512, 400) }],
      ['icons/app-maskable-512.png', { type: 'image/png', source: icon(512, 280) }],
      ['icons/apple-touch-icon.png', { type: 'image/png', source: icon(180, 400) }],
    ]);
    return files;
  }
  return {
    name: 'clickclacks-installation',
    configResolved(config) { base = config.base; root = config.root; },
    transformIndexHtml(_html, context) {
      if (context.filename !== resolve(root, 'index.html')) return;
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: `${base}icons/apple-touch-icon.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Click Clacks' }, injectTo: 'head' },
      ];
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!pathname.startsWith(base)) { next(); return; }
        const asset = assets().get(pathname.slice(base.length));
        if (!asset || !['GET', 'HEAD'].includes(request.method ?? 'GET')) { next(); return; }
        response.setHeader('Content-Type', asset.type);
        response.setHeader('Cache-Control', 'no-cache');
        response.end(request.method === 'HEAD' ? undefined : asset.source);
      });
    },
    generateBundle() {
      for (const [fileName, asset] of assets()) this.emitFile({ type: 'asset', fileName, source: asset.source });
    },
  };
}
