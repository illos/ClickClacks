// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { Quaternion } from 'three';
import { dieConfigForIndex, dieModel } from '../web/dice-demo/dice-models';
import { simulateThrow } from '../web/dice-demo/physics';
import { restingScene } from '../web/dice-demo-v2/resting-scene';
import { trayDieScale } from '../web/dice-demo-v2/dice-size';
import { packMotion, unpackMotion } from '../web/dice-demo/motion-codec';
import type { DiceConfig } from '../web/dice-demo/model';
import type { Participant, ParticipantRoll } from '../web/dice-demo-v2/model';
const sides = [6, 8, 10, 12, 20] as const;
function settled(config: DiceConfig, results: number[]) {
  for (let seed = 1; seed <= 8; seed++) {
    try {
      return simulateThrow(seed, results, { dice: config, scale: trayDieScale(results.length) });
    } catch (error) {
      if (!String(error).includes('did not settle')) throw error;
    }
  }
  throw new Error('The bounded pool did not settle for any focused seed.');
}
describe('bonus d4 physical presentation', () => {
  for (const base of sides)
    it(`d${base} plus d4 records the correct two hulls and numbered results`, () => {
      const config: DiceConfig = { kind: 'dice', sides: base, count: 1, bonusD4: true };
      const motion = settled(config, [base, 4]),
        last = motion.samples.slice(-14);
      expect(motion.samples.length % 14).toBe(0);
      expect(motion.offsets).toHaveLength(8);
      const baseModel = dieModel(config, 0),
        bonusModel = dieModel(config, 1);
      expect(baseModel.faces).toHaveLength(base);
      expect(bonusModel.faces).toHaveLength(4);
      expect(bonusModel.vertexRead).toBe(true);
      for (const index of [0, 1]) {
        const body = new Quaternion().fromArray(last, index * 7 + 3).normalize(),
          pose = body.clone().multiply(new Quaternion().fromArray(motion.offsets, index * 4));
        const model = dieModel(config, index),
          expected = index ? 4 : base;
        expect(
          model.vertices.every(vertex =>
            model.vertices.some(
              other =>
                other.distanceTo(
                  vertex
                    .clone()
                    .applyQuaternion(new Quaternion().fromArray(motion.offsets, index * 4)),
                ) < 1e-5,
            ),
          ),
        ).toBe(true);
        if (index) {
          const upper = Math.max(
            ...model.vertices.map(vertex => vertex.clone().applyQuaternion(pose).y),
          );
          expect(model.vertices[expected - 1]!.clone().applyQuaternion(pose).y).toBeCloseTo(
            upper,
            5,
          );
        } else {
          const upper = Math.max(
            ...model.faces.map(face => face.normal.clone().applyQuaternion(pose).y),
          );
          expect(
            model.faces
              .find(face => face.value === expected)!
              .normal.clone()
              .applyQuaternion(pose).y,
          ).toBeCloseTo(upper, 5);
        }
      }
      const roll: ParticipantRoll = {
        id: 'mixed',
        roller: 'peer',
        name: 'Peer',
        faces: [base, 4],
        dice: config,
        styles: [],
        startsAt: 0,
        duration: (motion.samples.length / 14 - 1) * motion.stepMs,
        motion,
      };
      const obstacles = restingScene(
        [roll],
        [{ id: 'peer' }] as Participant[],
        'me',
        roll.duration + 1,
      ).obstacles!;
      expect(obstacles.map(obstacle => obstacle.dice)).toEqual([
        { kind: 'dice', sides: base, count: 1 },
        { kind: 'dice', sides: 4, count: 1 },
      ]);
      for (const obstacle of obstacles) {
        const model = dieModel(obstacle.dice),
          q = new Quaternion().fromArray(obstacle.rotation);
        const bottom = Math.min(
          ...model.vertices.map(
            vertex => vertex.clone().applyQuaternion(q).y * obstacle.scale! + obstacle.position[1]!,
          ),
        );
        expect(bottom).toBeGreaterThan(-0.06);
      }
    });
  it('two d20 base dice and the final d4 retain three independent numbered tracks', () => {
    const config: DiceConfig = { kind: 'dice', sides: 20, count: 2, bonusD4: true };
    const motion = settled(config, [20, 1, 4]),
      stride = 21,
      final = motion.samples.slice(-stride);
    expect(motion.samples.length % stride).toBe(0);
    expect(motion.offsets).toHaveLength(12);
    for (let index = 0; index < 3; index++) {
      const model = dieModel(config, index),
        pose = new Quaternion()
          .fromArray(final, index * 7 + 3)
          .normalize()
          .multiply(new Quaternion().fromArray(motion.offsets, index * 4));
      for (const vertex of model.vertices) {
        const world = vertex.clone().applyQuaternion(pose).multiplyScalar(trayDieScale(config.count + 1));
        expect(Math.abs(world.x + final[index * 7]!)).toBeLessThan(5.15);
        expect(Math.abs(world.z + final[index * 7 + 2]!)).toBeLessThan(3.4);
      }
      if (index < 2) {
        const face = model.faces.find(face => face.value === [20, 1][index])!;
        expect(face.normal.clone().applyQuaternion(pose).y).toBeCloseTo(
          Math.max(...model.faces.map(face => face.normal.clone().applyQuaternion(pose).y)),
          5,
        );
      } else
        expect(model.vertices[3]!.clone().applyQuaternion(pose).y).toBeCloseTo(
          Math.max(...model.vertices.map(vertex => vertex.clone().applyQuaternion(pose).y)),
          5,
        );
    }
  });
  it('twenty base dice and the final d4 preserve all21 hull tracks through binary wire packing', () => {
    const config: DiceConfig = { kind: 'dice', sides: 20, count: 20, bonusD4: true };
    const motion = settled(config, [...Array(20).fill(20), 4]),
      stride = 21 * 7;
    expect(motion.samples.length % stride).toBe(0);
    expect(motion.offsets).toHaveLength(84);
    expect(dieConfigForIndex(config, 20)).toEqual({ kind: 'dice', sides: 4, count: 1 });
    expect(unpackMotion(packMotion(motion)).samples).toEqual(motion.samples);
    const final = motion.samples.slice(-stride);
    for (let i = 0; i < 21; i++) {
      const model = dieModel(config, i),
        pose = new Quaternion()
          .fromArray(final, i * 7 + 3)
          .normalize()
          .multiply(new Quaternion().fromArray(motion.offsets, i * 4));
      for (const vertex of model.vertices) {
        const world = vertex.clone().applyQuaternion(pose).multiplyScalar(trayDieScale(config.count + 1));
        expect(Math.abs(world.x + final[i * 7]!)).toBeLessThan(5.15);
        expect(Math.abs(world.z + final[i * 7 + 2]!)).toBeLessThan(3.4);
      }
    }
  });
});
