// SPDX-License-Identifier: MIT
// Packing without generated bindings produces an unusable Convex component.
import { accessSync, constants, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const required = [
  ...Object.values(manifest.exports),
  ...['api', 'component', 'dataModel', 'server'].map(name => `component/_generated/${name}.ts`),
  ...['serif', 'modern', 'rune', 'gothic'].flatMap(name => [
    `web/dice-demo/fonts/${name}.woff2`,
    `web/dice-demo/fonts/${name}-OFL.txt`,
  ]),
  'patches/three@0.186.1.patch',
  'LICENSE',
];
for (const path of required) {
  try {
    accessSync(new URL(path, root), constants.R_OK);
  } catch {
    throw new Error(`Cannot pack ClickClacks: missing ${path}. Generate component bindings first.`);
  }
}
console.log(`ClickClacks ${manifest.version}: package inputs ready.`);
