// SPDX-License-Identifier: MIT
import { it, expect } from 'vitest';
import { restingScene } from '../web/dice-demo-v2/resting-scene';
import { packMotion } from '../web/dice-demo/motion-codec';
import type { ParticipantRoll, Participant } from '../web/dice-demo-v2/model';
const style = { color: '#aa3322', ink: '#ffffff', pattern: 'solid' as const };
it('resting mixed hulls decode large tracks and exclude own, cleared, faded and absent owners', () => {
  const roll: ParticipantRoll = {
    id: 'pool',
    roller: 'peer',
    name: 'Peer',
    faces: Array(10).fill(20),
    dice: { kind: 'dice', sides: 20, count: 10 },
    styles: [style],
    startsAt: 0,
    duration: 2000,
    motion: packMotion({
      seed: 1,
      stepMs: 1000 / 60,
      samples: Array.from({ length: 1210 }, (_, i) => [(i % 10) * 0.1, 0.5, 0, 0, 0, 0, 1]).flat(),
      offsets: Array(10).fill([0, 0, 0, 1]).flat(),
    }),
  };
  const members = [{ id: 'peer' }] as Participant[];
  const scene = restingScene([roll], members, 'me', 2500);
  expect(scene.obstacles).toHaveLength(10);
  expect(scene.obstacles![0]!.dice).toEqual({ kind: 'dice', sides: 20, count: 1 });
  expect(scene.obstacles![0]!.position.every(Number.isFinite)).toBe(true);
  expect(restingScene([roll], members, 'peer', 2500).obstacles).toHaveLength(0);
  expect(restingScene([roll], [], 'me', 2500).obstacles).toHaveLength(0);
  expect(restingScene([roll], members, 'me', 7600).obstacles).toHaveLength(0);
  expect(restingScene([], members, 'me', 2500).obstacles).toHaveLength(0);
});
