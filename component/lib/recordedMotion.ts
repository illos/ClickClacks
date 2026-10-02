// SPDX-License-Identifier: MIT
import { ConvexError, type Infer } from "convex/values";
import { authorityError } from "./errors.ts";
import type { demoMotion } from "../diceDemoTables.ts";
export function decodedSamples(
  motion: Infer<typeof demoMotion>,
): readonly number[] | Float64Array {
  if (motion.packed) {
    if (
      motion.samples.length ||
      motion.packed.byteLength % 8 ||
      motion.packed.byteLength > 565656
    )
      throw authorityError("INVALID_REQUEST","Invalid recorded motion.");
    return new Float64Array(motion.packed);
  }
  return motion.samples;
}
export function validateMotion(
  motion: Infer<typeof demoMotion>,
  count: number,
): number {
  if ((motion.version ?? 1) !== 1)
    throw authorityError("INVALID_REQUEST","Unsupported recorded motion version.");
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
    throw authorityError("INVALID_REQUEST","Invalid recorded motion.");
  for (const n of samples)
    if (!Number.isFinite(n) || Math.abs(n) > 20)
      throw authorityError("INVALID_REQUEST","Invalid recorded motion.");
  if (motion.offsets.some((n) => !Number.isFinite(n) || Math.abs(n) > 20))
    throw authorityError("INVALID_REQUEST","Invalid recorded motion.");
  return (samples.length / stride - 1) * motion.stepMs;
}
