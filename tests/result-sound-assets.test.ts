// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cinematicCriticalCue } from '../web/site/cinematic-critical-cue';

function pcm(filename: string) {
  const wav = readFileSync(new URL(`../web/dice-demo-v2/audio/${filename}`, import.meta.url));
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  let offset = 12;
  while (wav.toString('ascii', offset, offset + 4) !== 'data') offset += 8 + wav.readUInt32LE(offset + 4);
  const length = wav.readUInt32LE(offset + 4) / 2;
  return Float32Array.from({length}, (_, index) => wav.readInt16LE(offset + 8 + index * 2) / 32767);
}

it('ships the selected sword recording and the approved fail waveform with audible energy', () => {
  const sword = pcm('crit-sword-draw.wav'), failure = pcm('crit-fail.wav');
  expect(sword.length / 48000).toBe(.768);
  expect(failure.length / 48000).toBe(1.3);
  for (const samples of [sword, failure]) {
    expect(Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)).toBeGreaterThan(.08);
  }
  const audition = cinematicCriticalCue(48000, 'failure');
  expect(failure.every((sample, index) => Math.abs(sample - audition[index]!) < 1 / 32767)).toBe(true);
});
