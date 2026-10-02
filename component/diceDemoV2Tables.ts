// SPDX-License-Identifier: MIT
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  demoRoll,
  demoParticipantStyle as demoStyle,
  demoReceipt,
  demoMotion,
} from "./diceDemoTables";
export const diceConfiguration = v.object({
  kind: v.union(v.literal("power"), v.literal("dice"), v.literal("percentile")),
  sides: v.union(
    v.literal(4),
    v.literal(6),
    v.literal(8),
    v.literal(10),
    v.literal(12),
    v.literal(20),
  ),
  count: v.number(),
  bonusD4: v.optional(v.boolean()),
});
export const roomPolicy = v.object({
  capacity: v.number(),
  ttlMs: v.number(),
  receiptTtlMs: v.number(),
  maxRolls: v.number(),
  minRollIntervalMs: v.number(),
});
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
  dice: v.optional(diceConfiguration),
  total: v.optional(v.number()),
  modifier: v.optional(v.number()),
  edges: v.optional(v.number()),
  banes: v.optional(v.number()),
  source: v.optional(v.union(v.literal("generated"), v.literal("supplied"))),
  sequence: v.optional(v.number()),
  revealAt: v.optional(v.number()),
  roller: v.string(),
  name: v.string(),
  historyExpiresAt: v.optional(v.number()),
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
const { motion: _motion, ...semanticFields } = participantRoll.fields;
export const semanticRoll = v.object(semanticFields);
export const trackMetadataResult = v.union(v.null(), v.object({
  roll: semanticRoll, activeRolls: v.array(semanticRoll), receipts: v.array(demoReceipt),
}));
export const diceDemoV2Tables = {
  diceDemoV2TrackMetadata: defineTable({
    key: v.string(), viewer: v.string(), roll: semanticRoll,
    firstSequence: v.number(), expiresAt: v.number(),
  }).index("by_room_viewer", ["key", "viewer"]).index("by_expiry", ["expiresAt"]),
  diceDemoV2PlaybackReceipts: defineTable({
    key: v.string(), roller: v.string(), rollId: v.string(), viewer: v.string(),
    sample: demoReceipt, expiresAt: v.number(),
  }).index("by_roll_viewer", ["key", "roller", "rollId", "viewer"])
    .index("by_expiry", ["expiresAt"]),
  diceDemoV2Presentations: defineTable({
    key: v.string(), viewer: v.string(), id: v.string(),
    motion: demoMotion, expiresAt: v.number(),
  }).index("by_request",["key","viewer","id"]).index("by_room_viewer",["key","viewer"]).index("by_expiry",["expiresAt"]),
  diceDemoV2Sessions: defineTable({
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    expiresAt: v.number(),
    lastRollAt: v.optional(v.number()),
    lastClearAt: v.optional(v.number()),
  })
    .index("by_room_viewer", ["key", "viewer"])
    .index("by_expiry", ["expiresAt"]),
  diceDemoV2Requests: defineTable({
    key: v.string(),
    viewer: v.string(),
    id: v.string(),
    dice: diceConfiguration,
    faces: v.array(v.number()),
    source: v.union(v.literal("generated"), v.literal("supplied")),
    expiresAt: v.number(),
    roomExpiresAt: v.number(),
    fingerprint: v.optional(v.string()),
    roll: v.optional(semanticRoll),
    sequence: v.optional(v.number()),
  })
    .index("by_request", ["key", "viewer", "id"])
    .index("by_expiry", ["expiresAt"])
    .index("by_key_sequence", ["key", "sequence"])
    .index("by_key", ["key"])
    .index("by_room_viewer_sequence", ["key", "viewer", "sequence"]),
  diceDemoV2Rooms: defineTable({
    key: v.string(),
    sequence: v.optional(v.number()),
    requestCount: v.optional(v.number()),
    sessionCount: v.optional(v.number()),
    policy: v.optional(roomPolicy),
    code: v.optional(v.string()),
    expiresAt: v.number(),
    participants: v.array(participant),
  })
    .index("by_key", ["key"])
    .index("by_code", ["code"])
    .index("by_expiry", ["expiresAt"]),
  // One current throw per participant; independent subscriptions avoid resending everyone else's paths.
  diceDemoV2Tracks: defineTable({
    key: v.string(),
    viewer: v.string(),
    expiresAt: v.optional(v.number()),
    roll: participantRoll,
    receipts: v.array(demoReceipt),
  })
    .index("by_room_viewer", ["key", "viewer"])
    .index("by_expiry", ["expiresAt"]),
};
