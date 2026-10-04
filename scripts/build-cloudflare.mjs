// SPDX-License-Identifier: MIT
// A dedicated app hostname serves the existing site and tray from its root.
process.env.CLICKCLACKS_BASE = '/';
await import('./build-site.mjs');

const {writeSocialPreview} = await import('./lib/social-preview.mjs');
await writeSocialPreview('dist/social-preview-v2.png');
