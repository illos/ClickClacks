// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Authored recordings live in a pinned release; build products stay outside Git.
export async function prepareLandingPublic() {
  const manifest = JSON.parse(await readFile('docs/assets/sharing-demo.json', 'utf8'));
  const output = resolve('.cache/landing-public');
  const cache = resolve('.cache/landing-media');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await mkdir(cache, { recursive: true });
  await cp('web/landing/public', output, { recursive: true });
  await mkdir(resolve(output, 'media'), { recursive: true });
  for (const asset of manifest.assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !/^[a-z0-9-]+\.(mp4|webm|png|webp)$/.test(asset.filename))
      throw new Error('Invalid sharing media manifest');
    const cachePath = resolve(cache, asset.sha256);
    let bytes;
    try { bytes = await readFile(cachePath); } catch {}
    const digest = value => createHash('sha256').update(value).digest('hex');
    if (!bytes || digest(bytes) !== asset.sha256) {
      const response = await fetch(asset.url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Sharing media download failed: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (digest(bytes) !== asset.sha256) throw new Error('Sharing media checksum mismatch');
      await writeFile(cachePath, bytes);
    }
    await writeFile(resolve(output, 'media', asset.filename), bytes);
  }
  return output;
}
