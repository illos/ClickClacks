// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { unpackRoll } from '../web/dice-demo/motion-codec';
it('unknown recorded presentation falls back to text without losing authoritative result or shared reveal time', () => {
  const roll = {
    id: 'future',
    faces: [6],
    styles: [],
    startsAt: 1000,
    duration: 800,
    dice: { kind: 'dice' as const, sides: 6 as const, count: 1 },
    revealAt: 1800,
    total: 6,
    motion: {
      version: 2,
      seed: 1,
      stepMs: 1000 / 60,
      samples: [0, 0.5, 0, 0, 0, 0, 1],
      offsets: [0, 0, 0, 1],
    },
  };
  const replay = unpackRoll(roll);
  expect(replay.motion).toBeUndefined();
  expect(replay.faces).toEqual([6]);
  expect(replay.revealAt).toBe(1800);
  expect(replay.total).toBe(6);
  expect(roll.motion.version).toBe(2);
  expect(unpackRoll({ ...roll, motion: { ...roll.motion, version: 1 } }).motion).toBeDefined();
  expect(
    unpackRoll({ ...roll, motion: { ...roll.motion, version: undefined } }).motion,
  ).toBeDefined();
});
