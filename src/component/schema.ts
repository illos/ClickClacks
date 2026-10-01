import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { appearance, accepted, motion, roomPolicy } from "./validators.js";
export default defineSchema({
  rooms: defineTable({
    expiresAt: v.number(),
    sequence: v.number(),
    policy: roomPolicy,
  }).index("by_expiry", ["expiresAt"]),
  members: defineTable({
    roomId: v.id("rooms"),
    publicId: v.string(),
    credential: v.string(),
    name: v.string(),
    appearance,
    activeUntil: v.number(),
    left: v.boolean(),
    lastRollAt: v.number(),
    lastClearAt: v.optional(v.number()),
    latestRoll: v.optional(accepted),
    expiresAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_active", ["roomId", "left", "activeUntil"])
    .index("by_room_credential", ["roomId", "credential"])
    .index("by_expiry", ["expiresAt"]),
  rolls: defineTable({
    roomId: v.id("rooms"),
    sequence: v.number(),
    kind: v.union(v.literal("roll"), v.literal("clear")),
    memberId: v.string(),
    roll: v.optional(accepted),
    expiresAt: v.number(),
  })
    .index("by_room_sequence", ["roomId", "sequence"])
    .index("by_expiry", ["expiresAt"]),
  receipts: defineTable({
    roomId: v.id("rooms"),
    memberId: v.string(),
    requestId: v.string(),
    fingerprint: v.string(),
    roll: v.optional(accepted),
    expiresAt: v.number(),
    roomExpiresAt: v.number(),
  })
    .index("by_request", ["roomId", "memberId", "requestId"])
    .index("by_expiry", ["expiresAt"])
    .index("by_room", ["roomId"]),
  presentation: defineTable({
    roomId: v.id("rooms"),
    rollId: v.string(),
    memberId: v.string(),
    motion,
    expiresAt: v.number(),
  })
    .index("by_roll", ["roomId", "rollId"])
    .index("by_expiry", ["expiresAt"]),
});
