// SPDX-License-Identifier: MIT
import type { Motion, Roll } from './model';
/** Preserve every recorded 60 Hz sample while fitting Convex's array field limit. */
export function packMotion(motion: Motion): Motion {
  if (motion.samples.length <= 8192) return motion;
  return {
    ...motion,
    samples: [],
    packed: new Float64Array(motion.samples).buffer,
  };
}
export function unpackMotion(motion: Motion): Motion {
  if (!motion.packed || motion.samples.length) return motion;
  return { ...motion, samples: Array.from(new Float64Array(motion.packed)) };
}
export function unpackRoll<T extends Roll>(roll: T): T {
  if (!roll.motion) return roll;
  const motion = unpackMotion(roll.motion);
  return motion === roll.motion ? roll : { ...roll, motion };
}
export function unpackTrack<T extends { roll: Roll }>(track: T): T {
  const roll = unpackRoll(track.roll);
  return roll === track.roll ? track : { ...track, roll };
}
