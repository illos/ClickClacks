// SPDX-License-Identifier: MIT
/** Original reveal threshold, generalized only from a pair to an arbitrary recorded pool. */
export function recordedRevealDelay(roll: { duration: number; faces: readonly number[]; motion?: { version?: number; stepMs: number; samples: readonly number[]; packed?: ArrayBuffer } }): number {
  const motion = roll.motion;
  if (!motion || motion.version !== undefined && motion.version !== 1) return roll.duration;
  const samples = motion.packed ? new Float64Array(motion.packed) : motion.samples;
  const stride = roll.faces.length * 7;
  const count = samples.length / stride;
  let quiet = count - 1;
  const end = (count - 1) * stride;
  for (let frame = count - 2; frame >= 0; frame--) {
    let settled = true;
    for (let die = 0; die < roll.faces.length; die++) {
      const a = frame * stride + die * 7, b = end + die * 7;
      let distance = 0, dot = 0, normA = 0, normB = 0;
      for (let axis = 0; axis < 3; axis++) distance += (samples[a + axis]! - samples[b + axis]!) ** 2;
      for (let axis = 3; axis < 7; axis++) {
        const x = samples[a + axis]!, y = samples[b + axis]!;
        dot += x * y; normA += x * x; normB += y * y;
      }
      if (distance > 0.25 ** 2 || !normA || !normB || Math.abs(dot) / Math.sqrt(normA * normB) < Math.cos(0.25 / 2)) settled = false;
    }
    if (!settled) break;
    quiet = frame;
  }
  return Math.min(roll.duration, Math.max(600, quiet * motion.stepMs + 50));
}
