// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { cinematicCriticalCue } from '../web/site/cinematic-critical-cue';

it.each([44100, 48000])('keeps audition cues audible, unclipped and click-free at %i Hz', sampleRate => {
  for (const result of ['success', 'failure'] as const) {
    const cue = cinematicCriticalCue(sampleRate, result);
    expect(cue.every(Number.isFinite)).toBe(true);
    const peak = cue.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
    expect(peak).toBeCloseTo(0.78);
    expect(Math.sqrt(cue.reduce((sum, value) => sum + value * value, 0) / cue.length)).toBeGreaterThan(0.08);
    expect(cue[0]).toBe(0);
    expect(Math.abs(cue.at(-1)!)).toBeLessThan(0.0001);
  }
});
