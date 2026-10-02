// SPDX-License-Identifier: MIT
import { trayDieScale } from './dice-size';
import { Quaternion, Vector3 } from 'three';
import { dieModel, dieConfigForIndex } from '../dice-demo/dice-models';
import { unpackMotion } from '../dice-demo/motion-codec';
import { trayOpacity, type Participant, type ParticipantRoll } from './model';
import type { ThrowScene } from '../dice-demo/model';

/** Every completed, still-visible die becomes a fixed obstacle, regardless of owner. */
export function restingScene(
  rolls: Iterable<ParticipantRoll>,
  members: Participant[],
  _viewer: string,
  serverNow: number,
  nextDieCount = 2,
): ThrowScene {
  const obstacles = [];
  const active = new Set(members.map(member => member.id));
  for (const roll of [...rolls].sort((a, b) => a.roller.localeCompare(b.roller))) {
    if (
      !active.has(roll.roller) ||
      serverNow < roll.startsAt + roll.duration ||
      !roll.motion ||
      trayOpacity(roll, serverNow) === 0
    )
      continue;
    const scale = trayDieScale(roll.faces.length);
    const motion = unpackMotion(roll.motion);
    const final = motion.samples.slice(-roll.faces.length * 7);
    for (let die = 0; die < roll.faces.length; die++) {
      const vertices = dieModel(roll.dice, die).vertices;
      const rotation = new Quaternion()
        .fromArray(final, die * 7 + 3)
        .normalize()
        .multiply(new Quaternion().fromArray(roll.motion.offsets, die * 4));
      const position = new Vector3().fromArray(final, die * 7);
      const support = Math.min(...vertices.map(v => v.clone().applyQuaternion(rotation).y));
      position.y -= support * (scale - 0.5);
      obstacles.push({
        scale,
        position: position.toArray(),
        rotation: rotation.toArray(),
        ...(roll.dice ? { dice: dieConfigForIndex(roll.dice, die) } : {}),
      });
    }
  }
  return { scale: trayDieScale(nextDieCount), obstacles };
}
