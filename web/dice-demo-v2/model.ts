// SPDX-License-Identifier: MIT
import { Quaternion, Vector3 } from 'three';
import { vertices } from '../dice-demo/d10';
import { defaultDicePalette } from './palette';
import type { Roll, Style, Receipt, ThrowScene } from '../dice-demo/model';
export type Participant = {
  id: string;
  name: string;
  style: Style;
  slot: number;
  ready: boolean;
  uncertainty: number;
  seenAt: number;
};
export type ParticipantRoll = Roll & {
  roller: string;
  name: string;
  power?: { edges: number; banes: number; total: number; tier: 1 | 2 | 3 };
};
export type Track = { roll: ParticipantRoll; receipts: Receipt[] };
export type Room = { expired: boolean; participants: Participant[]; code: string | null };
export function randomProfile() {
  const index = crypto.getRandomValues(new Uint32Array(1))[0]! % defaultDicePalette.length;
  return { name: 'Player', style: { ...defaultDicePalette[index]! } };
}

/** Common reveal point from the accepted path: within 0.25 units/radians of its final pose.
 * Wait another 50ms for quiet motion; tiny final settling continues after the result appears. */
export function revealDelay(roll: ParticipantRoll): number {
  const motion = roll.motion;
  if (!motion) return roll.duration;
  const count = motion.samples.length / 14;
  let quiet = count - 1;
  const end = (count - 1) * 14;
  for (let frame = count - 2; frame >= 0; frame--) {
    let settled = true;
    for (let die = 0; die < 2; die++) {
      const a = frame * 14 + die * 7,
        b = end + die * 7;
      let distance = 0,
        dot = 0,
        normA = 0,
        normB = 0;
      for (let axis = 0; axis < 3; axis++)
        distance += (motion.samples[a + axis]! - motion.samples[b + axis]!) ** 2;
      for (let axis = 3; axis < 7; axis++) {
        const x = motion.samples[a + axis]!,
          y = motion.samples[b + axis]!;
        dot += x * y;
        normA += x * x;
        normB += y * y;
      }
      if (
        distance > 0.25 ** 2 ||
        !normA ||
        !normB ||
        Math.abs(dot) / Math.sqrt(normA * normB) < Math.cos(0.25 / 2)
      )
        settled = false;
    }
    if (!settled) break;
    quiet = frame;
  }
  return Math.min(roll.duration, Math.max(600, quiet * motion.stepMs + 50));
}

/** Shared cosmetic lifetime: hold five seconds after full completion, then a short fade. */
export function trayOpacity(
  roll: Pick<ParticipantRoll, 'startsAt' | 'duration'>,
  serverNow: number,
) {
  return Math.max(0, Math.min(1, 1 - (serverNow - roll.startsAt - roll.duration - 5000) / 600));
}

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
    const final = roll.motion.samples.slice(-14);
    for (let die = 0; die < 2; die++) {
      const rotation = new Quaternion()
        .fromArray(final, die * 7 + 3)
        .normalize()
        .multiply(new Quaternion().fromArray(roll.motion.offsets, die * 4));
      const position = new Vector3().fromArray(final, die * 7);
      const support = Math.min(...vertices.map(v => v.clone().applyQuaternion(rotation).y));
      position.y -= support * 0.15;
      obstacles.push({ position: position.toArray(), rotation: rotation.toArray() });
    }
  }
  return { scale: 0.65, obstacles };
}

export function parseRoomKey(input: string): string | null {
  let value = input.trim();
  if (/^https?:/i.test(value)) {
    try {
      value = new URL(value).searchParams.get('room') ?? '';
    } catch {
      return null;
    }
  }
  if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/i.test(value)) return value.toUpperCase();
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
    ? value
    : null;
}
