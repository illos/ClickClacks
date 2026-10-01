// SPDX-License-Identifier: MIT
import { Quaternion, Vector3 } from 'three';
import { dieModel } from '../dice-demo/dice-models';
import { unpackMotion } from '../dice-demo/motion-codec';
import { trayOpacity, type Participant, type ParticipantRoll } from './model';
import type { ThrowScene } from '../dice-demo/model';

/** Only completed, still-visible other-owner pairs become fixed obstacles. */
export function restingScene(
  rolls: Iterable<ParticipantRoll>,
  members: Participant[],
  viewer: string,
  serverNow: number,
): ThrowScene {
  const obstacles = [];
  const active = new Set(members.map(member => member.id));
  for (const roll of [...rolls].sort((a, b) => a.roller.localeCompare(b.roller))) {
    if (
      roll.roller === viewer ||
      !active.has(roll.roller) ||
      serverNow < roll.startsAt + roll.duration ||
      !roll.motion ||
      trayOpacity(roll, serverNow) === 0
    )
      continue;
    const motion = unpackMotion(roll.motion);
    const final = motion.samples.slice(-roll.faces.length * 7);
    const vertices = dieModel(roll.dice).vertices;
    for (let die = 0; die < roll.faces.length; die++) {
      const rotation = new Quaternion()
        .fromArray(final, die * 7 + 3)
        .normalize()
        .multiply(new Quaternion().fromArray(roll.motion.offsets, die * 4));
      const position = new Vector3().fromArray(final, die * 7);
      const support = Math.min(...vertices.map(v => v.clone().applyQuaternion(rotation).y));
      position.y -= support * 0.15;
      obstacles.push({
        position: position.toArray(),
        rotation: rotation.toArray(),
        ...(roll.dice ? { dice: roll.dice } : {}),
      });
    }
  }
  return { scale: 0.65, obstacles };
}
