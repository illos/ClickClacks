import { action, mutation, query } from "./_generated/server.js";
import { components, internal } from "./_generated/api.js";
import {
  accepted,
  appearance,
  event,
  member,
  motion,
  request,
  room,
  sessionArgs,
} from "../src/component/validators.js";
import { v, type Infer } from "convex/values";
const backend = components.powerroller;
export const clock = action({
  args: {},
  returns: v.number(),
  handler: () => Date.now(),
});
export const create = mutation({
  args: {
    name: v.string(),
    credential: v.string(),
    appearance: v.optional(appearance),
  },
  returns: v.object({ room, member }),
  handler: (ctx, args) => ctx.runMutation(backend.rooms.create, args),
});
export const join = mutation({
  args: {
    ...sessionArgs,
    name: v.string(),
    appearance: v.optional(appearance),
  },
  returns: v.object({ room, member }),
  handler: (ctx, args) => ctx.runMutation(backend.rooms.join, args),
});
export const heartbeat = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: (ctx, args) => ctx.runMutation(backend.rooms.heartbeat, args),
});
export const profile = mutation({
  args: {
    ...sessionArgs,
    name: v.optional(v.string()),
    appearance: v.optional(appearance),
  },
  returns: member,
  handler: (ctx, args) => ctx.runMutation(backend.rooms.profile, args),
});
export const leave = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: (ctx, args) => ctx.runMutation(backend.rooms.leave, args),
});
export const view = query({
  args: sessionArgs,
  returns: v.object({
    room,
    members: v.array(member),
    cursor: v.number(),
    latest: v.array(accepted),
  }),
  handler: (ctx, args) => ctx.runQuery(backend.rooms.view, args),
});
export const events = query({
  args: { ...sessionArgs, after: v.number(), limit: v.optional(v.number()) },
  returns: v.object({
    events: v.array(event),
    cursor: v.number(),
    hasMore: v.boolean(),
  }),
  handler: (ctx, args) => ctx.runQuery(backend.rooms.events, args),
});
export const roll = action({
  args: { ...sessionArgs, request },
  returns: accepted,
  handler: (ctx, args): Promise<Infer<typeof accepted>> =>
    ctx.runAction(internal.sampling.roll, args),
});
export const clear = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: (ctx, args) => ctx.runMutation(backend.rooms.clear, args),
});
export const attachPresentation = mutation({
  args: { ...sessionArgs, rollId: v.string(), motion },
  returns: v.null(),
  handler: (ctx, args) =>
    ctx.runMutation(backend.rooms.attachPresentation, args),
});
export const getPresentation = query({
  args: { ...sessionArgs, rollId: v.string() },
  returns: v.union(motion, v.null()),
  handler: (ctx, args) => ctx.runQuery(backend.rooms.getPresentation, args),
});
