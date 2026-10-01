// SPDX-License-Identifier: MIT
import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  faces,
  faceForResult,
  faceGlyph,
  finalOrientation,
  vertices,
} from '../../web/dice-demo/d10';
import { estimateClock, progress } from '../../web/dice-demo/model';
import { demo } from '../../web/dice-demo/api';
import { backend } from './fixtures/table';

// Geometry facts and supplied faces are independent of a game roll or physics simulation.
test('twenty-sided d10 has two of each digit and all supplied results settle uppermost', () => {
  for (const face of faces) {
    for (const p of face.points)
      expect(Math.abs(p.clone().sub(face.centroid).dot(face.normal))).toBeLessThan(1e-10);
    for (const index of [0, 1]) {
      const q = finalOrientation(face.value, index);
      expect(faceForResult(face.value, index).normal.clone().applyQuaternion(q).y).toBeCloseTo(
        1,
        10,
      );
      expect(faces.filter(f => f.normal.clone().applyQuaternion(q).y > 0.99999)).toHaveLength(1);
      // A matching opposite supporting face keeps the final pose stable on a flat tray.
      expect(faces.some(f => f.normal.clone().applyQuaternion(q).y < -0.99999)).toBe(true);
      const heights = vertices.map(v => v.clone().applyQuaternion(q).y);
      expect(Math.min(...heights)).toBeLessThan(0);
      expect(q.length()).toBeCloseTo(1);
    }
  }
  expect(faces).toHaveLength(20);
  expect(vertices).toHaveLength(12);
  for (let digit = 0; digit < 10; digit++)
    expect(faces.filter(f => faceGlyph(f.value) === String(digit))).toHaveLength(2);
  expect(faceGlyph(10)).toBe('0');
  expect(faceGlyph(10, 1)).toBe('00');
  for (let value = 1; value < 10; value++) {
    expect(faceGlyph(value, 0)).toBe(String(value));
    expect(faceGlyph(value, 1)).toBe(`0${value}`);
  }
  expect(faces.every(face => face.points.length === 3)).toBe(true);
});
test('clock ignores slower queued samples and animation catches up after skipped frames', () => {
  const clock = estimateClock([
    { start: 0, end: 20, server: 1010 },
    { start: 100, end: 120, server: 1110 },
    { start: 200, end: 222, server: 1211 },
    { start: 300, end: 1300, server: 1310 },
  ]);
  expect(clock).toEqual({ offset: 1000, uncertainty: 11 });
  const roll = { id: 'fixture', faces: [1, 10], styles: [], startsAt: 1000, duration: 2200 };
  expect(progress(roll, 999)).toBe(0);
  expect(progress(roll, 2100)).toBe(0.5);
  expect(progress(roll, 10000)).toBe(1);
});
test('room persists one supplied throw, rejects overlap and waits for unready viewers', async () => {
  const t = backend();
  const key = '12345678-1234-1234-1234-123456789012',
    viewer = '12345678-1234-1234-1234-123456789013';
  const other = '12345678-1234-1234-1234-123456789014';
  const styles = [
    { color: '#ffffff', ink: '#111111', pattern: 'solid' as const },
    { color: '#a63a3a', ink: '#ffffff', pattern: 'marble' as const },
  ];
  await t.mutation(demo.join, { key, viewer, name: 'One', ready: true, uncertainty: 10 });
  await t.mutation(demo.join, { key, viewer: other, name: 'Two', ready: false, uncertainty: 20 });
  const { simulateThrow } = await import('../../web/dice-demo/physics');
  const motion = simulateThrow(42, [1, 10]);
  const request = {
    motion,
    key,
    viewer,
    id: '12345678-1234-1234-1234-123456789015',
    faces: [1, 10],
    styles,
  };
  await expect(t.mutation(demo.throwDice, request)).rejects.toThrow('warming up');
  await t.mutation(demo.join, { key, viewer: other, name: 'Two', ready: true, uncertainty: 20 });
  const accepted = await t.mutation(demo.throwDice, request);
  expect(accepted.startsAt - Date.now()).toBeGreaterThan(100);
  expect(accepted.startsAt - Date.now()).toBeLessThanOrEqual(150);
  const persisted = (await t.query(demo.view, { key }))?.roll;
  expect(persisted?.faces).toEqual([1, 10]);
  expect(persisted?.motion).toEqual(motion);
  expect(persisted?.duration).toBe((motion.samples.length / 14 - 1) * motion.stepMs);
  expect(await t.mutation(demo.throwDice, request)).toEqual(accepted);
  await expect(t.mutation(demo.throwDice, { ...request, faces: [2, 10] })).rejects.toThrow(
    'different faces',
  );
  await expect(
    t.mutation(demo.throwDice, { ...request, id: '12345678-1234-1234-1234-123456789016' }),
  ).rejects.toThrow('still playing');
  await t.mutation(demo.receipt, {
    key,
    sample: {
      viewer,
      roll: accepted.id,
      firstFrame: accepted.startsAt + 10,
      revealFrame: accepted.startsAt + accepted.duration + 15,
      uncertainty: 10,
      frames: 130,
      maxFrameGap: 20,
    },
  });
  expect((await t.query(demo.view, { key }))?.receipts[0]?.frames).toBe(130);
  expect(await t.query(demo.view, { key: '12345678-1234-1234-1234-123456789099' })).toBeNull();
});

test('real physics varies by seed while preserving supplied faces without a final-frame twist', async () => {
  const { simulateThrow } = await import('../../web/dice-demo/physics');
  const { Quaternion, PerspectiveCamera, Vector3 } = await import('three');
  for (const seed of [0, 1, 12345, 0xffffffff]) {
    const motion = simulateThrow(seed, [1, 10]);
    // The clipped approach still starts entirely outside desktop and phone views.
    for (const aspect of [1140 / 440, 358 / 370]) {
      const camera = new PerspectiveCamera(38, aspect, 0.1, 40);
      camera.up.set(0, 0, -1);
      camera.position.y = Math.max(7.2, 10.8 / aspect) / (2 * Math.tan((19 * Math.PI) / 180));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      for (const index of [0, 1]) {
        const start = index * 7;
        const position = new Vector3().fromArray(motion.samples, start);
        const rotation = new Quaternion().fromArray(motion.samples, start + 3);
        const side = Math.sign(position.x);
        for (const vertex of vertices) {
          const projected = vertex
            .clone()
            .multiplyScalar(0.5)
            .applyQuaternion(rotation)
            .add(position)
            .project(camera);
          expect(projected.x * side).toBeGreaterThan(1);
        }
      }
    }
    expect(motion.samples.length % 14).toBe(0);
    expect(motion.samples.length).toBeLessThanOrEqual(6734);
    expect(motion.samples.every(Number.isFinite)).toBe(true);
    for (const index of [0, 1]) {
      const end = motion.samples.length - 14 + index * 7;
      const body = new Quaternion().fromArray(motion.samples, end + 3).normalize();
      const numbering = new Quaternion().fromArray(motion.offsets, index * 4);
      const visual = body.clone().multiply(numbering);
      const wanted = faceForResult(index ? 10 : 1, index);
      const upward = faces.map(face => face.normal.clone().applyQuaternion(visual).y);
      expect(wanted.normal.clone().applyQuaternion(visual).y).toBeCloseTo(Math.max(...upward), 4);
      expect(upward.filter(n => n > Math.max(...upward) - 1e-4)).toHaveLength(1);
      // Pre-oriented numbering is a hull symmetry, so it never moves a physical vertex.
      for (const vertex of vertices) {
        const rotated = vertex.clone().applyQuaternion(numbering);
        expect(Math.min(...vertices.map(p => p.distanceToSquared(rotated)))).toBeLessThan(1e-10);
      }
      const minimum = Math.min(
        ...vertices.map(
          v => v.clone().multiplyScalar(0.5).applyQuaternion(body).y + motion.samples[end + 1]!,
        ),
      );
      expect(minimum).toBeGreaterThan(-0.05);
    }
  }
  const first = simulateThrow(42, [1, 10]);
  expect(simulateThrow(42, [10, 1]).samples).toEqual(first.samples);
  expect(simulateThrow(43, [1, 10]).samples).not.toEqual(first.samples);
});

test('random demo throws use the shared server generator with fresh entropy', async () => {
  const t = backend();
  const seeds = [new Uint8Array(32), new Uint8Array(32).fill(1)];
  const entropy = vi.spyOn(crypto, 'getRandomValues');
  try {
    for (const seed of seeds) {
      entropy.mockReturnValueOnce(seed);
      // Independent SHA-256 reference for this fixture: no rejection draws for these seeds.
      const expected = [0, 1].map(counter => {
        const input = Buffer.alloc(40);
        input.set(seed);
        input.writeBigUInt64BE(BigInt(counter), 32);
        return (createHash('sha256').update(input).digest().readUInt32BE(0) % 10) + 1;
      });
      expect(await t.action(demo.sampleFaces, {})).toEqual(expected);
    }
    expect(entropy).toHaveBeenCalledTimes(2);
  } finally {
    entropy.mockRestore();
  }
});
