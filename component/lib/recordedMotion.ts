// SPDX-License-Identifier: MIT
import { ConvexError, type Infer } from "convex/values";
import { demoMotion } from "../diceDemoTables";
export function decodedSamples(
  motion: Infer<typeof demoMotion>,
): readonly number[] | Float64Array {
  if (motion.packed) {
    if (
      motion.samples.length ||
      motion.packed.byteLength % 8 ||
      motion.packed.byteLength > 538720
    )
      throw new ConvexError("Invalid recorded motion.");
    return new Float64Array(motion.packed);
  }
  return motion.samples;
}
export function validateMotion(
  motion: Infer<typeof demoMotion>,
  count: number,
): number {
  const samples = decodedSamples(motion),
    stride = 7 * count;
  if (
    !Number.isInteger(motion.seed) ||
    motion.seed < 0 ||
    motion.seed > 0xffffffff ||
    !Number.isFinite(motion.stepMs) ||
    Math.abs(motion.stepMs - 1000 / 60) > 1e-8 ||
    samples.length < stride * 2 ||
    samples.length > stride * 481 ||
    samples.length % stride ||
    motion.offsets.length !== 4 * count
  )
    throw new ConvexError("Invalid recorded motion.");
  for (const n of samples)
    if (!Number.isFinite(n) || Math.abs(n) > 20)
      throw new ConvexError("Invalid recorded motion.");
  if (motion.offsets.some((n) => !Number.isFinite(n) || Math.abs(n) > 20))
    throw new ConvexError("Invalid recorded motion.");
  return (samples.length / stride - 1) * motion.stepMs;
}
