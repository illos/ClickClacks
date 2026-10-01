// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { criticalCue } from '../web/dice-demo-v2/critical-cue';

it('produces distinct short cues with audible energy, safe headroom and quiet endpoints', () => {
  const success = criticalCue(48000, 'success'), failure = criticalCue(48000, 'failure');
  for (const cue of [success, failure]) {
    expect(cue.length).toBe(15840);
    expect(cue.every(Number.isFinite)).toBe(true);
    expect(Math.max(...cue.map(Math.abs))).toBeLessThan(0.8);
    expect(Math.sqrt(cue.reduce((sum, value) => sum + value * value, 0) / cue.length)).toBeGreaterThan(0.04);
    expect(cue[0]).toBe(0);
    expect(Math.abs(cue.at(-1)!)).toBeLessThan(0.0001);
  }
  expect(success).not.toEqual(failure);
});
