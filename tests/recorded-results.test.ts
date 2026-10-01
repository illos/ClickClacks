// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('preserves both result recordings across decoders that detach buffers on Safari recovery', async () => {
  const clips = await Promise.all(['crit-sword-draw.wav', 'crit-fail.wav'].map(name =>
    readFile(new URL(`../web/dice-demo-v2/audio/${name}`, import.meta.url))));
  let requests = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, arrayBuffer: async () => {
    const clip = clips[requests++]!;
    return clip.buffer.slice(clip.byteOffset, clip.byteOffset + clip.byteLength);
  }})));
  const { loadRecordedResults } = await import('../web/dice-demo-v2/recorded-results');
  const decode = vi.fn(async (bytes: ArrayBuffer) => {
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(bytes.byteLength).toBeGreaterThan(70000);
    structuredClone(bytes, {transfer: [bytes]});
    return {} as AudioBuffer;
  });
  const context = {decodeAudioData: decode} as unknown as AudioContext;
  expect(await loadRecordedResults(context)).toHaveLength(2);
  expect(await loadRecordedResults(context)).toHaveLength(2);
  expect(requests).toBe(2);
  expect(decode).toHaveBeenCalledTimes(4);
});

it('retries a failed result-asset fetch on the next activation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ok: false})));
  const { preloadResults } = await import('../web/dice-demo-v2/recorded-results');
  await expect(preloadResults()).rejects.toThrow('Result audio could not load');
  vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(4)})));
  expect(await preloadResults()).toHaveLength(2);
});
