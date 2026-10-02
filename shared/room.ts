// SPDX-License-Identifier: MIT
import type { Roll, Style, Receipt } from './model';
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
  /** Original server request deadline, never extended by browser caching. */
  historyExpiresAt?: number;
  power?: { edges: number; banes: number; total: number; tier: 1 | 2 | 3 };
};
export type Track = { roll: ParticipantRoll; receipts: Receipt[]; activeRolls?: ParticipantRoll[] };
export type Room = {
  expired: boolean;
  participants: Participant[];
  code: string | null;
  /** Canonical storage key; session and URL aliases remain unchanged. */
  canonicalKey?: string;
  cursor?: number;
};
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

export type CachedRoll = Omit<ParticipantRoll, 'motion'>;
