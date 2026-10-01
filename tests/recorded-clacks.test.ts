// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('loads real WAV clips once and preserves encoded bytes when decoding detaches inputs on Safari recovery', async () => {
  const { readFile } = await import('node:fs/promises');
  const clips = await Promise.all([1, 2, 3, 4].map(index => readFile(new URL(`../web/dice-demo-v2/audio/clack-${index}.wav`, import.meta.url))));
  let requests = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => {
    const clip = clips[requests++]!;
    return clip.buffer.slice(clip.byteOffset, clip.byteOffset + clip.byteLength);
  } })));
  const { loadRecordedClacks } = await import('../web/dice-demo-v2/recorded-clacks');
  const decode = vi.fn(async (bytes: ArrayBuffer) => {
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(bytes.byteLength).toBeGreaterThan(5000);
    structuredClone(bytes, { transfer: [bytes] });
    const data = new Float32Array([0, 0.95, -0.4, 0]);
    return { numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer;
  });
  const context = { decodeAudioData: decode } as unknown as AudioContext;
  const first = await loadRecordedClacks(context);
  expect(first).toHaveLength(4);
  expect(first[0]!.getChannelData(0)[1]).toBeCloseTo(0.9, 6);
  expect(await loadRecordedClacks(context)).toHaveLength(4);
  expect(requests).toBe(4); expect(decode).toHaveBeenCalledTimes(8);
});

it('retries fetching clips after a failed asset request', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const { preloadClacks } = await import('../web/dice-demo-v2/recorded-clacks');
  await expect(preloadClacks()).rejects.toThrow('Dice audio could not load');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
  expect(await preloadClacks()).toHaveLength(4);
});
