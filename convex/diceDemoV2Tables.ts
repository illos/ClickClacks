// SPDX-License-Identifier: MIT
import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import { demoRoll, demoParticipantStyle as demoStyle, demoReceipt } from './diceDemoTables';
export const participant = v.object({
  id: v.string(),
  name: v.string(),
  style: demoStyle,
  slot: v.number(),
  ready: v.boolean(),
  uncertainty: v.number(),
  seenAt: v.number(),
});
export const participantRoll = v.object({
  ...demoRoll.fields,
  styles: v.array(demoStyle),
  roller: v.string(),
  name: v.string(),
  // Optional for existing demo throws; new throws store their accepted modifier and outcome.
  power: v.optional(
    v.object({
      edges: v.number(),
      banes: v.number(),
      total: v.number(),
      tier: v.union(v.literal(1), v.literal(2), v.literal(3)),
    }),
  ),
});
export const diceDemoV2Tables = {
  diceDemoV2Rooms: defineTable({
    key: v.string(),
    code: v.optional(v.string()),
    expiresAt: v.number(),
    participants: v.array(participant),
  })
    .index('by_key', ['key'])
    .index('by_code', ['code']),
  // One current throw per participant; independent subscriptions avoid resending everyone else's paths.
  diceDemoV2Tracks: defineTable({
    key: v.string(),
    viewer: v.string(),
    roll: participantRoll,
    receipts: v.array(demoReceipt),
  }).index('by_room_viewer', ['key', 'viewer']),
};
