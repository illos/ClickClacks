// SPDX-License-Identifier: MIT
import { recordedRevealDelay } from '../../shared/timing';
import { defaultDicePalette } from './palette';
import type { Roll, Style, Receipt } from '../dice-demo/model';
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
  total?: number;
  modifier?: number;
  edges?: number;
  banes?: number;
  source?: 'generated' | 'supplied';
  sequence?: number;
  revealAt?: number;
  power?: { edges: number; banes: number; total: number; tier: 1 | 2 | 3 };
};
export type Track = { roll: ParticipantRoll; receipts: Receipt[]; activeRolls?: ParticipantRoll[] };
export type Room = {
  expired: boolean;
  participants: Participant[];
  code: string | null;
  cursor?: number;
};
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
