// SPDX-License-Identifier: MIT
export type LegacyStyle = {
  color: string;
  ink: string;
  pattern: 'solid' | 'speckle' | 'marble';
};
export type DiceFont = 'serif' | 'modern' | 'rune' | 'gothic';
export type Style = {
  color: string;
  ink: string;
  pattern: 'solid' | 'speckle' | 'marble' | 'frosted';
  /** Missing on legacy records: retain their original Georgia numerals. */
  font?: DiceFont;
};
export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20;
export type DiceConfig = {
  kind: 'power' | 'dice';
  sides: DiceSides;
  count: number;
  bonusD4?: boolean;
};
export type RestingDie = {
  position: number[];
  rotation: number[];
  dice?: DiceConfig;
};
export type ThrowScene = {
  obstacles?: RestingDie[];
  scale?: number;
  dice?: DiceConfig;
};
export type Motion = {
  /** Absent means legacy v1; unsupported versions use semantic/text fallback. */
  version?: number;
  seed: number;
  stepMs: number;
  samples: number[];
  offsets: number[];
  packed?: ArrayBuffer;
};
export type Roll = {
  id: string;
  faces: number[];
  dice?: DiceConfig;
  styles: Style[];
  startsAt: number;
  duration: number;
  motion?: Motion;
};
export type Receipt = {
  viewer: string;
  roll: string;
  firstFrame: number;
  revealFrame: number;
  uncertainty: number;
  frames: number;
  maxFrameGap: number;
};
export type Viewer = {
  id: string;
  name: string;
  ready: boolean;
  seenAt: number;
  uncertainty: number;
};
export type Room = {
  viewers: Viewer[];
  roll: Roll | null;
  receipts: Receipt[];
};
export type ClockSample = { start: number; end: number; server: number };
// A monotonic browser clock mapped to server epoch time. Fastest samples reduce queueing bias.
export function estimateClock(samples: ClockSample[]) {
  const fastest = [...samples].sort((a, b) => a.end - a.start - (b.end - b.start)).slice(0, 3);
  if (!fastest.length) throw new Error('No clock samples.');
  const offsets = fastest.map(s => s.server - (s.start + s.end) / 2).sort((a, b) => a - b);
  const offset = offsets[Math.floor(offsets.length / 2)]!;
  const uncertainty = Math.max(
    ...fastest.map(
      s => (s.end - s.start) / 2 + Math.abs(s.server - (s.start + s.end) / 2 - offset),
    ),
  );
  return { offset, uncertainty };
}
export function progress(roll: Roll, serverNow: number) {
  return Math.max(0, Math.min(1, (serverNow - roll.startsAt) / roll.duration));
}
