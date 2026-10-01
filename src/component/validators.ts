import { v } from "convex/values";
export const appearance = v.object({
  color: v.string(),
  ink: v.string(),
  pattern: v.union(
    v.literal("solid"),
    v.literal("speckle"),
    v.literal("marble"),
    v.literal("frosted"),
  ),
  font: v.union(
    v.literal("serif"),
    v.literal("modern"),
    v.literal("rune"),
    v.literal("gothic"),
  ),
});
export const request = v.object({
  requestId: v.string(),
  dice: v.array(
    v.object({
      sides: v.number(),
      count: v.number(),
      id: v.optional(v.string()),
    }),
  ),
  ruleset: v.union(
    v.literal("sum"),
    v.literal("percentile"),
    v.literal("draw-steel/power"),
    v.literal("draw-steel/opposed"),
    v.literal("draw-steel/project"),
    v.literal("draw-steel/save"),
    v.literal("draw-steel/initiative"),
  ),
  modifiers: v.optional(
    v.object({
      characteristic: v.optional(v.number()),
      edges: v.optional(v.number()),
      banes: v.optional(v.number()),
      bonus: v.optional(v.number()),
    }),
  ),
  keep: v.optional(
    v.object({
      mode: v.union(v.literal("highest"), v.literal("lowest")),
      count: v.number(),
    }),
  ),
  context: v.optional(v.any()),
});
export const result = v.object({
  dice: v.array(
    v.object({
      id: v.string(),
      sides: v.number(),
      value: v.number(),
      kept: v.boolean(),
    }),
  ),
  naturalTotal: v.number(),
  total: v.number(),
  tier: v.optional(v.number()),
  success: v.optional(v.boolean()),
  critical: v.optional(v.boolean()),
  breakthrough: v.optional(v.boolean()),
  summary: v.string(),
});
export const accepted = v.object({
  id: v.string(),
  sequence: v.number(),
  memberId: v.string(),
  name: v.string(),
  appearance,
  request,
  result,
  acceptedAt: v.number(),
  startsAt: v.number(),
  revealAt: v.number(),
  source: v.union(v.literal("generated"), v.literal("supplied")),
});
export const member = v.object({
  id: v.string(),
  name: v.string(),
  appearance,
  activeUntil: v.number(),
});
export const room = v.object({ id: v.string(), expiresAt: v.number() });
export const sessionArgs = { roomId: v.string(), credential: v.string() };
export const event = v.object({
  sequence: v.number(),
  kind: v.union(v.literal("roll"), v.literal("clear")),
  memberId: v.string(),
  roll: v.optional(accepted),
});
export const motion = v.object({
  version: v.literal(1),
  modelIds: v.array(v.string()),
  dieIds: v.array(v.string()),
  values: v.array(v.number()),
  frames: v.array(v.number()),
});
/** Hosts choose bounded room policy at creation; the community site uses defaults. */
export const roomPolicy = v.object({
  capacity: v.number(),
  ttlMs: v.number(),
  receiptTtlMs: v.number(),
  eventTtlMs: v.number(),
  maxEvents: v.number(),
  maxSessions: v.number(),
  revealDelayMs: v.number(),
  startDelayMs: v.number(),
  models: v.array(v.object({ id: v.string(), sides: v.number() })),
});
export const policyOptions = v.object({
  capacity: v.optional(v.number()),
  ttlMs: v.optional(v.number()),
  receiptTtlMs: v.optional(v.number()),
  eventTtlMs: v.optional(v.number()),
  maxEvents: v.optional(v.number()),
  maxSessions: v.optional(v.number()),
  revealDelayMs: v.optional(v.number()),
  startDelayMs: v.optional(v.number()),
  models: v.optional(v.array(v.object({ id: v.string(), sides: v.number() }))),
});
