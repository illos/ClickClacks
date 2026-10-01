// SPDX-License-Identifier: MIT
import { defineTable } from 'convex/server';
import { v } from 'convex/values';
export const demoStyle = v.object({
  color: v.string(),
  ink: v.string(),
  pattern: v.union(v.literal('solid'), v.literal('speckle'), v.literal('marble')),
});
/** V2 approved palette additions; legacy V1 contract stays unchanged. */
export const demoParticipantStyle = v.object({
  ...demoStyle.fields,
  pattern: v.union(
    v.literal('solid'),
    v.literal('speckle'),
    v.literal('marble'),
    v.literal('frosted'),
  ),
  font: v.optional(
    v.union(v.literal('serif'), v.literal('modern'), v.literal('rune'), v.literal('gothic')),
  ),
});
export const demoMotion = v.object({
  version: v.optional(v.number()),
  seed: v.number(),
  stepMs: v.number(),
  samples: v.array(v.number()),
  packed: v.optional(v.bytes()),
  offsets: v.array(v.number()),
});
export const demoRoll = v.object({
  id: v.string(),
  faces: v.array(v.number()),
  styles: v.array(demoStyle),
  startsAt: v.number(),
  duration: v.number(),
  motion: v.optional(demoMotion),
});
export const demoViewer = v.object({
  id: v.string(),
  name: v.string(),
  seenAt: v.number(),
  ready: v.boolean(),
  uncertainty: v.number(),
});
export const demoReceipt = v.object({
  viewer: v.string(),
  roll: v.string(),
  firstFrame: v.number(),
  revealFrame: v.number(),
  uncertainty: v.number(),
  frames: v.number(),
  maxFrameGap: v.number(),
});
export const diceDemoTables = {
  // Isolated demo capability rooms; no campaign, roll record or rules-engine relationships.
  diceDemoRooms: defineTable({
    key: v.string(),
    expiresAt: v.number(),
    viewers: v.array(demoViewer),
    roll: v.union(v.null(), demoRoll),
    receipts: v.array(demoReceipt),
  }).index('by_key', ['key']),
};
