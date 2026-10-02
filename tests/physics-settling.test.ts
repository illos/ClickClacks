// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { Quaternion } from 'three';
import { simulateThrow } from '../web/dice-demo/physics';
import { faces } from '../web/dice-demo/d10';
import { trayDieScale } from '../web/dice-demo-v2/dice-size';
const scene = { scale: trayDieScale(), dice: { kind: 'power' as const, sides: 10 as const, count: 2 } };
afterEach(() => vi.unstubAllGlobals());
async function worker(randomValues: (values: Uint32Array) => Uint32Array) {
  vi.resetModules();
  const scope = { postMessage: vi.fn(), onmessage: undefined as unknown as (event: MessageEvent) => void };
  vi.stubGlobal('self', scope); vi.stubGlobal('crypto', { getRandomValues: randomValues });
  await import('../web/dice-demo/physics-worker');
  return scope;
}
it('recovers a real nonsettling seed and labels the original supplied faces from one cached motion', async () => {
  // Seed 10 reproduces the bounded-solver failure in the current power-pair scene.
  expect(() => simulateThrow(10, [10, 10], scene)).toThrow('This throw did not settle.');
  const seeds = [10, 1], random = vi.fn((values: Uint32Array) => values.fill(seeds.shift()!));
  const scope = await worker(random);
  scope.onmessage(new MessageEvent('message', { data: { id: 7, scene } }));
  expect(scope.postMessage).toHaveBeenLastCalledWith({ id: 7 });
  expect(random).toHaveBeenCalledTimes(2);
  scope.onmessage(new MessageEvent('message', { data: { id: 8, scene, faces: [2, 9] } }));
  expect(random).toHaveBeenCalledTimes(2); // The recovered warm path is reused, not simulated again.
  expect(scope.postMessage).toHaveBeenCalledTimes(2);
  const reply = scope.postMessage.mock.calls[1]![0];
  expect(reply.error).toBeUndefined(); expect(reply.id).toBe(8);
  const final = reply.motion.samples.slice(-14);
  // Original d10 labeling chooses physical face 1 for first-die 2, and face 18 for second-die 9.
  for (const [die, face] of [1, 18].entries()) {
    const pose = new Quaternion().fromArray(final, die * 7 + 3).normalize()
      .multiply(new Quaternion().fromArray(reply.motion.offsets, die * 4));
    expect(faces[face]!.normal.clone().applyQuaternion(pose).y)
      .toBeCloseTo(Math.max(...faces.map(value => value.normal.clone().applyQuaternion(pose).y)), 5);
  }
});
it('bounds an exhausted worker job at three attempts and permits a later job to recover', async () => {
  const random = vi.fn((values: Uint32Array) => values.fill(10));
  const scope = await worker(random);
  scope.onmessage(new MessageEvent('message', { data: { id: 1, scene, faces: [2, 9] } }));
  expect(random).toHaveBeenCalledTimes(3); expect(scope.postMessage).toHaveBeenCalledOnce();
  expect(scope.postMessage.mock.calls[0]![0]).toEqual({ id: 1, error: 'Error: This throw did not settle. Try another throw.' });
  random.mockImplementation(values => values.fill(1));
  scope.onmessage(new MessageEvent('message', { data: { id: 2, scene, faces: [2, 9] } }));
  expect(random).toHaveBeenCalledTimes(4); expect(scope.postMessage).toHaveBeenCalledTimes(2);
  expect(scope.postMessage.mock.calls[1]![0]).toMatchObject({ id: 2, motion: { offsets: expect.any(Array) } });
});
it('does not retry an unrelated failure', async () => {
  const random = vi.fn(() => { throw new Error('Random source unavailable'); });
  const scope = await worker(random);
  scope.onmessage(new MessageEvent('message', { data: { id: 1, scene, faces: [2, 9] } }));
  expect(random).toHaveBeenCalledOnce();
  expect(scope.postMessage).toHaveBeenCalledExactlyOnceWith({ id: 1, error: 'Error: Random source unavailable' });
});
