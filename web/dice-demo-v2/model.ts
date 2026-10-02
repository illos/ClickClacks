// SPDX-License-Identifier: MIT
import { recordedRevealDelay } from '../../shared/timing';
import { defaultDicePalette } from './palette';
import type { Roll, Style, Receipt } from '../dice-demo/model';
export type { Participant, ParticipantRoll, Track, Room } from '../../shared/room';
import type { ParticipantRoll } from '../../shared/room';
export { parseRoomKey } from '../../shared/room';
export function randomProfile() {
  const index = crypto.getRandomValues(new Uint32Array(1))[0]! % defaultDicePalette.length;
  return { name: 'Player', style: { ...defaultDicePalette[index]! } };
}

/** Common reveal point from the accepted path: within 0.25 units/radians of its final pose.
 * Wait another 50ms for quiet motion; tiny final settling continues after the result appears. */
export function revealDelay(roll: ParticipantRoll): number {
  return roll.revealAt !== undefined ? roll.revealAt - roll.startsAt : recordedRevealDelay(roll);
}

/** Shared cosmetic lifetime: hold five seconds after full completion, then a short fade. */
export function trayOpacity(
  roll: Pick<ParticipantRoll, 'startsAt' | 'duration'>,
  serverNow: number,
) {
  return Math.max(0, Math.min(1, 1 - (serverNow - roll.startsAt - roll.duration - 5000) / 600));
}
