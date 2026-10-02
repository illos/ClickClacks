// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { dieModel } from '../web/dice-demo/dice-models';
import { simulateThrow } from '../web/dice-demo/physics';
import { trayDieScale } from '../web/dice-demo-v2/dice-size';
import type { Motion, RestingDie } from '../web/dice-demo/model';

const cube = { kind: 'dice', sides: 6, count: 1 } as const;
const model = dieModel(cube);
const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

/** Exact cube separating axes: face normals and every pair of edge cross products. */
function penetration(motion: Motion, scale: number, obstacle: RestingDie): number {
  const obstacleQ = new Quaternion().fromArray(obstacle.rotation);
  const obstacleAxes = axes.map(axis => axis.clone().applyQuaternion(obstacleQ));
  const obstacleVertices = model.vertices.map(vertex => vertex.clone()
    .multiplyScalar(obstacle.scale!).applyQuaternion(obstacleQ)
    .add(new Vector3().fromArray(obstacle.position)));
  let deepest = -Infinity;
  for (let frame = 0; frame < motion.samples.length / 7; frame++) {
    const at = frame * 7;
    const q = new Quaternion().fromArray(motion.samples, at + 3).normalize();
    const position = new Vector3().fromArray(motion.samples, at);
    // Samples retain the original half-size floor convention; recover the actual hull center.
    const support = Math.min(...model.vertices.map(vertex => vertex.clone().applyQuaternion(q).y));
    position.y -= support * (scale - 0.5);
    const movingAxes = axes.map(axis => axis.clone().applyQuaternion(q));
    const candidates = [...obstacleAxes, ...movingAxes,
      ...obstacleAxes.flatMap(a => movingAxes.map(b => a.clone().cross(b)))];
    const movingVertices = model.vertices.map(vertex => vertex.clone()
      .multiplyScalar(scale).applyQuaternion(q).add(position));
    let depth = Infinity;
    for (const candidate of candidates) {
      if (candidate.lengthSq() < 1e-10) continue;
      const axis = candidate.normalize();
      const a = movingVertices.map(vertex => vertex.dot(axis));
      const b = obstacleVertices.map(vertex => vertex.dot(axis));
      depth = Math.min(depth, Math.min(Math.max(...a), Math.max(...b)) -
        Math.max(Math.min(...a), Math.min(...b)));
    }
    deepest = Math.max(deepest, depth);
  }
  return deepest;
}

it('a smaller die respects a larger settled die’s own hull size throughout its recorded throw', () => {
  const scale = trayDieScale(20);
  const oldScale = trayDieScale(1);
  const unobstructed = simulateThrow(1, [6], { dice: cube, scale });
  const final = unobstructed.samples.slice(-7);
  const halfHeight = Math.max(...model.vertices.map(vertex => vertex.y)) * oldScale;
  const obstacle: RestingDie = {
    dice: cube, scale: oldScale,
    position: [final[0]!, halfHeight - 0.04, final[2]!],
    rotation: [0, 0, 0, 1],
  };
  const blocked = simulateThrow(1, [6], { dice: cube, scale, obstacles: [obstacle] });
  const wrongHull = simulateThrow(1, [6], {
    dice: cube, scale, obstacles: [{ ...obstacle, scale }],
  });
  // This control reproduces the wrong hull: obstacle sized like the new die.
  expect(penetration(wrongHull, scale, obstacle)).toBeGreaterThan(0.04);
  // Without an obstacle, this seeded throw demonstrably enters the occupied landing area.
  expect(penetration(unobstructed, scale, obstacle)).toBeGreaterThan(0.1);
  // Allow only normal discrete-solver contact slop, not the missing outer shell of a large die.
  expect(penetration(blocked, scale, obstacle)).toBeLessThan(0.04);
});
