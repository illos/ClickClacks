// SPDX-License-Identifier: MIT
import { it, expect } from 'vitest';
import { restingScene } from '../web/dice-demo-v2/resting-scene';
import { packMotion } from '../web/dice-demo/motion-codec';
import { Quaternion } from 'three';
import { dieModel } from '../web/dice-demo/dice-models';
import type { ParticipantRoll, Participant } from '../web/dice-demo-v2/model';
const style = { color: '#aa3322', ink: '#ffffff', pattern: 'solid' as const };
it('resting mixed hulls include own rolls and exclude moving, cleared, faded and absent owners', () => {
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
  expect(scene.scale).toBeCloseTo(0.65 * 1.15);
  expect(scene.obstacles).toHaveLength(10);
  expect(scene.obstacles![0]!.dice).toEqual({ kind: 'dice', sides: 20, count: 1 });
  expect(scene.obstacles![0]!.position.every(Number.isFinite)).toBe(true);
  // A one-die follow-up must retain the smaller ten-die pool's original hull size.
  expect(scene.obstacles![0]!.scale).toBeCloseTo(0.65 * 1.15 * Math.sqrt(6 / 10));
  const obstacle = scene.obstacles![0]!;
  const bottom = Math.min(...dieModel(obstacle.dice).vertices.map(vertex =>
    vertex.clone().applyQuaternion(new Quaternion().fromArray(obstacle.rotation)).y * obstacle.scale! + obstacle.position[1]!,
  ));
  expect(bottom).toBeCloseTo(0.5 + Math.min(...dieModel(obstacle.dice).vertices.map(vertex => vertex.y)) * 0.5);
  expect(restingScene([roll], members, 'me', 2500, 20).scale).toBe(0.5);
  expect(restingScene([roll], members, 'peer', 2500).obstacles).toHaveLength(10);
  const own = { ...roll, id: 'own', roller: 'me' };
  const previousOwn = { ...own, id: 'previous-own' };
  const moving = { ...own, id: 'moving', startsAt: 2400 };
  expect(restingScene([roll, own, previousOwn, moving], [...members, { id: 'me' } as Participant], 'me', 2500).obstacles).toHaveLength(30);
  expect(restingScene([roll], [], 'me', 2500).obstacles).toHaveLength(0);
  expect(restingScene([roll], members, 'me', 7600).obstacles).toHaveLength(0);
  expect(restingScene([], members, 'me', 2500).obstacles).toHaveLength(0);
});
