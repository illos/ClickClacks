// SPDX-License-Identifier: MIT
import { dicePoolSides } from '../../shared/dice';
import { Quaternion } from 'three';
import { throwNumberingOrientation, simulateThrow } from './physics';
import type { Motion, ThrowScene } from './model';
import { prepareSettledThrow } from './throw-settling';

let prepared: Motion | undefined;
let preparedKey = '';
function prepare(scene: ThrowScene) {
  const key = JSON.stringify(scene);
  if (key !== preparedKey) prepared = undefined;
  preparedKey = key;
  // Cosmetic motion is independent of supplied results. Each throw gets a fresh seed.
  prepared ??= prepareSettledThrow(() => simulateThrow(
    crypto.getRandomValues(new Uint32Array(1))[0]!,
    scene.dice ? dicePoolSides(scene.dice) : [10, 10],
    scene,
  ));
}
self.onmessage = (event: MessageEvent<{ id: number; faces?: number[]; scene?: ThrowScene }>) => {
  const { id, faces, scene = {} } = event.data;
  try {
    const began = performance.now();
    prepare(scene);
    if (!faces) {
      self.postMessage({ id });
      return;
    }
    const motion = prepared!;
    const final = motion.samples.slice(-faces.length * 7);
    motion.offsets = faces.flatMap((face, index) =>
      throwNumberingOrientation(
        new Quaternion().fromArray(final, index * 7 + 3),
        face,
        index,
        scene.dice,
      ).toArray(),
    );
    prepared = undefined;
    self.postMessage({ id, motion, planningMs: performance.now() - began });
    // Prewarming is explicitly scheduled by the client. An unconditional refill
    // would race new scene/quantity intent and delay the next actual throw.
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
