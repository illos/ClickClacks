import { defaultNames } from '../shared/classical-names';
// SPDX-License-Identifier: MIT
/** Independent participant tracks, accessed through a public room capability. No campaign writes. */
import { ConvexError, v } from "convex/values";
import { authorityError } from "./lib/errors";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  demoMotion,
  demoReceipt,
  demoParticipantStyle as demoStyle,
} from "./diceDemoTables";
import { resolveEdgeBane, tierOf } from "../shared/resolve/index";
import {
  rollCooldownMs,
  dicePoolSides,
  dicePoolCount,
  genericModifier,
  naturalDiceTotal,
  type DiceConfiguration,
} from "../shared/dice";
import { validateMotion } from "./lib/recordedMotion";
import { recordedRevealDelay } from "../shared/timing";
import { validKey, codePattern, profile, config, validCredential, defaultPolicy, semanticFingerprint } from "./lib/roomPolicy";
import {
  participant,
  participantRoll,
  semanticRoll,
  diceConfiguration,
  roomPolicy,
  trackMetadataResult,
} from "./diceDemoV2Tables";

async function room(ctx: MutationCtx | QueryCtx, key: string) {
  const code = key.trim().toUpperCase();
  if (codePattern.test(code))
    return ctx.db
      .query("diceDemoV2Rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
  validKey(key);
  return ctx.db
    .query("diceDemoV2Rooms")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}
async function allocateCode(ctx: MutationCtx) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    if (
      !(await ctx.db
        .query("diceDemoV2Rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first())
    )
      return code;
  }
  throw new ConvexError("Could not allocate a room code. Try again.");
}
/** Standalone cosmetic names; no game catalog or campaign records are required. */
export const randomName = mutation({
  args: {},
  returns: v.string(),
  handler: async () =>
    defaultNames[Math.floor(Math.random() * defaultNames.length)]!,
});

async function member(
  ctx: MutationCtx | QueryCtx,
  key: string,
  viewer: string,
  credential: string,
) {
  const found = await room(ctx, key);
  if (!found || found.expiresAt <= Date.now())
    throw authorityError("ROOM_EXPIRED","Room expired. Open a new room.");
  validCredential(credential);
  const session = await ctx.db
    .query("diceDemoV2Sessions")
    .withIndex("by_room_viewer", (q) =>
      q.eq("key", found.key).eq("viewer", viewer),
    )
    .unique();
  if (!session || session.credential !== credential)
    throw authorityError("UNAUTHORIZED","Invalid private session credential.");
  const owner = found.participants.find(
    (p) => p.id === viewer && p.seenAt > Date.now() - 30000,
  );
  if (!owner) throw authorityError("UNAUTHORIZED","Reconnect to this room before throwing.");
  return { found, owner, session };
}
export const view = query({
  args: { key: v.string() },
  returns: v.object({
    expired: v.boolean(),
    participants: v.array(participant),
    code: v.union(v.string(), v.null()),
    cursor: v.optional(v.number()),
    canonicalKey: v.optional(v.string()),
  }),
  handler: async (ctx, { key }) => {
    const found = await room(ctx, key);
    const expired = !!found && found.expiresAt <= Date.now();
    return {
      expired,
      participants: expired ? [] : (found?.participants ?? []),
      code: found?.code ?? null,
      cursor: found?.sequence ?? 0,
      ...(found && !expired ? { canonicalKey: found.key } : {}),
    };
  },
});
export const track = query({
  args: { key: v.string(), viewer: v.string(), rollId: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({ roll: participantRoll, receipts: v.array(demoReceipt), activeRolls: v.optional(v.array(semanticRoll)) }),
  ),
  handler: async (ctx, args) => {
    const found = await room(ctx, args.key);
    if (
      !found ||
      found.expiresAt <= Date.now() ||
      !found.participants.some((p) => p.id === args.viewer)
    )
      return null;
    const current = await ctx.db
      .query("diceDemoV2Tracks")
      .withIndex("by_room_viewer", (q) =>
        q.eq("key", found.key).eq("viewer", args.viewer),
      )
      .unique();
    if (!current) return null;
    const compact = await compactCurrent(ctx, found.key, args.viewer, current);
    if (!compact || compact.expiresAt <= Date.now()) return null;
    const receipts = await playbackReceipts(ctx, found.key, args.viewer, current.roll.id, current.receipts);
    // At most eight compact overlapping results travel with the latest path.
    // Fetch another path separately: returning eight full recordings can exceed
    // Convex's one-megabyte function result limit for large dice pools.
    const requests = await ctx.db.query("diceDemoV2Requests")
      .withIndex("by_room_viewer_sequence", q => q.eq("key", found.key).eq("viewer", args.viewer).gte("sequence", compact.firstSequence))
      .order("desc").take(8);
    const activeRolls = [];
    for (const request of requests) {
      const roll = request.roll;
      if (!roll || request.expiresAt <= Date.now() || roll.startsAt + roll.duration + 5600 <= Date.now()) continue;
      if (args.rollId === roll.id) {
        const presentation = await ctx.db.query("diceDemoV2Presentations")
          .withIndex("by_request", q => q.eq("key", found.key).eq("viewer", args.viewer).eq("id", roll.id)).unique();
        if (!presentation || presentation.expiresAt <= Date.now() || (presentation.motion.version ?? 1) !== 1) return null;
        return { roll: { ...roll, motion: presentation.motion }, receipts: roll.id === current.roll.id ? receipts : [] };
      }
      activeRolls.push(roll);
    }
    if (args.rollId !== undefined) return null;
    // New tracks are compact; legacy consumers still receive the latest recording.
    const presentation = !current.roll.motion ? await ctx.db.query("diceDemoV2Presentations")
      .withIndex("by_request", q => q.eq("key", found.key).eq("viewer", args.viewer).eq("id", current.roll.id)).unique() : null;
    const motion = presentation && presentation.expiresAt > Date.now() && (presentation.motion.version ?? 1) === 1 ? presentation.motion : current.roll.motion;
    return { roll: { ...current.roll, ...(motion ? { motion } : {}) }, receipts, activeRolls: activeRolls.reverse() };
  },
});
export const join = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    name: v.string(),
    style: demoStyle,
    ready: v.boolean(),
    uncertainty: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validKey(args.viewer);
    validCredential(args.credential);
    if (args.credential === args.viewer || args.credential === args.key)
      throw authorityError("UNAUTHORIZED",
        "Use a private credential distinct from the public identity.",
      );
    profile(args.name, args.style);
    if (!Number.isFinite(args.uncertainty) || args.uncertainty < 0)
      throw authorityError("INVALID_REQUEST","Invalid clock estimate.");
    const found = await room(ctx, args.key);
    if (!found && codePattern.test(args.key.trim().toUpperCase()))
      throw authorityError("INVALID_REQUEST","Room code not found.");
    const session = found
      ? await ctx.db
          .query("diceDemoV2Sessions")
          .withIndex("by_room_viewer", (q) =>
            q.eq("key", found.key).eq("viewer", args.viewer),
          )
          .unique()
      : null;
    if (session && session.credential !== args.credential)
      throw authorityError("UNAUTHORIZED","Invalid private session credential.");
    if (!session && (found?.sessionCount ?? 0) >= 200)
      throw new ConvexError(
        "This room reached its session limit. Open a new room.",
      );
    const selectedPolicy = found?.policy ?? defaultPolicy;
    const code = found?.code ?? (await allocateCode(ctx));
    const now = Date.now();
    if (found && found.expiresAt <= now)
      throw authorityError("ROOM_EXPIRED","Room expired. Open a new room.");
    const alive = (found?.participants ?? []).filter(
      (p) => p.seenAt > now - 30000,
    );
    const previous = alive.find((p) => p.id === args.viewer);
    const others = alive.filter((p) => p.id !== args.viewer);
    if (others.length >= selectedPolicy.capacity)
      throw new ConvexError("This demo room has eight participants.");
    const slot =
      previous?.slot ??
      Array.from({ length: selectedPolicy.capacity }, (_, i) => i).find(
        (i) => !others.some((p) => p.slot === i),
      )!;
    const participants = [
      ...others,
      {
        id: args.viewer,
        name: previous?.name ?? args.name.trim(),
        style: previous?.style ?? args.style,
        slot,
        ready: args.ready,
        uncertainty: args.uncertainty,
        seenAt: now,
      },
    ].sort((a, b) => a.slot - b.slot);
    if (found)
      await ctx.db.patch(found._id, {
        participants,
        code,
        sessionCount: (found.sessionCount ?? 0) + (session ? 0 : 1),
      });
    else
      await ctx.db.insert("diceDemoV2Rooms", {
        key: args.key,
        code,
        expiresAt: now + selectedPolicy.ttlMs,
        policy: selectedPolicy,
        sequence: 0,
        sessionCount: 1,
        participants,
      });
    if (!session)
      await ctx.db.insert("diceDemoV2Sessions", {
        key: found?.key ?? args.key,
        viewer: args.viewer,
        credential: args.credential,
        expiresAt: found?.expiresAt ?? now + selectedPolicy.ttlMs,
      });
    return null;
  },
});
export const customize = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    name: v.string(),
    style: demoStyle,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    profile(args.name, args.style);
    const { found } = await member(ctx, args.key, args.viewer, args.credential);
    await ctx.db.patch(found._id, {
      participants: found.participants.map((p) =>
        p.id === args.viewer
          ? { ...p, name: args.name.trim(), style: args.style }
          : p,
      ),
    });
    return null;
  },
});
async function requestReceipt(
  ctx: MutationCtx | QueryCtx,
  args: {
    key: string;
    viewer: string;
    credential: string;
    id: string;
    dice?: DiceConfiguration;
  },
) {
  validKey(args.id);
  const dice = config(args.dice),
    { found, owner, session } = await member(
      ctx,
      args.key,
      args.viewer,
      args.credential,
    );
  const receipt = await ctx.db
    .query("diceDemoV2Requests")
    .withIndex("by_request", (q) =>
      q.eq("key", found.key).eq("viewer", args.viewer).eq("id", args.id),
    )
    .unique();
  if (receipt) {
    if (
      receipt.dice.kind !== dice.kind ||
      receipt.dice.sides !== dice.sides ||
      receipt.dice.count !== dice.count ||
      Boolean(receipt.dice.bonusD4) !== Boolean(dice.bonusD4)
    )
      throw authorityError("CONFLICT","Throw ID already used for another throw.");
    if (receipt.expiresAt <= Date.now() || !receipt.faces.length)
      throw authorityError("REQUEST_EXPIRED","Request expired. Start a new roll with a new ID.");
  }
  return { found, owner, session, dice, receipt };
}
export const sampleReceipt = query({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
  },
  returns: v.union(v.null(), v.array(v.number())),
  handler: async (ctx, args) =>
    (await requestReceipt(ctx, args)).receipt?.faces ?? null,
});
export const recordSample = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const { found, session, dice, receipt } = await requestReceipt(ctx, args);
    if (receipt) return receipt.faces;
    const selected = found.policy ?? defaultPolicy;
    if (Date.now() - (session.lastRollAt ?? 0) < selected.minRollIntervalMs)
      throw new ConvexError("Wait a moment before another roll.");
    if ((found.sequence ?? 0) >= selected.maxRolls)
      throw new ConvexError(
        "This room reached its roll limit. Open a new room.",
      );
    if (
      args.faces.length !== dicePoolCount(dice) ||
      args.faces.some((n,index) => !Number.isInteger(n) || n < 1 || n > dicePoolSides(dice)[index]!)
    )
      throw authorityError("INVALID_REQUEST","Invalid server-generated dice.");
    if ((found.requestCount ?? 0) >= selected.maxRolls)
      throw new ConvexError(
        "This room reached its request limit. Open a new room.",
      );
    await ctx.db.insert("diceDemoV2Requests", {
      key: found.key,
      viewer: args.viewer,
      id: args.id,
      dice,
      faces: args.faces,
      source: "generated",
      expiresAt: Math.min(found.expiresAt, Date.now() + selected.receiptTtlMs),
      roomExpiresAt: found.expiresAt,
    });
    await ctx.db.patch(session._id, { lastRollAt: Date.now() });
    await ctx.db.patch(found._id, {
      requestCount: (found.requestCount ?? 0) + 1,
    });
    return args.faces;
  },
});
export const throwDice = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
    motion: v.optional(demoMotion),
    edges: v.optional(v.number()),
    banes: v.optional(v.number()),
  },
  returns: participantRoll,
  handler: async (ctx, args) => acceptThrow(ctx, args),
});
async function acceptThrow(
  ctx: MutationCtx,
  args: {
    key: string;
    viewer: string;
    credential: string;
    id: string;
    dice?: DiceConfiguration;
    faces: number[];
    motion?: import("convex/values").Infer<typeof demoMotion>;
    edges?: number;
    banes?: number;
  },
  supplied = false,
) {
  const edges = args.edges ?? 0,
    banes = args.banes ?? 0;
  if ([edges, banes].some((n) => !Number.isInteger(n) || n < 0 || n > 2))
    throw authorityError("INVALID_REQUEST","Choose zero, one or two edges and banes.");
  let { found, owner, session, dice, receipt } = await requestReceipt(
    ctx,
    args,
  );
  if (!receipt && !supplied)
    throw authorityError("INVALID_REQUEST",
      "Sample server-generated faces with this throw ID first.",
    );
  if (
    receipt &&
    (receipt.source !== (supplied ? "supplied" : "generated") ||
      JSON.stringify(receipt.faces) !== JSON.stringify(args.faces))
  )
    throw authorityError("CONFLICT","Throw ID already used for another throw.");
  const fingerprint = semanticFingerprint(args);
  if (receipt?.fingerprint && receipt.fingerprint !== fingerprint)
    throw authorityError("CONFLICT","Throw ID already used for another throw.");
  if (receipt?.roll) {
    const presentation=await ctx.db.query("diceDemoV2Presentations")
      .withIndex("by_request",q=>q.eq("key",found.key).eq("viewer",args.viewer).eq("id",args.id)).unique();
    const motion=presentation && presentation.expiresAt>Date.now() && (presentation.motion.version??1)===1 ? presentation.motion : undefined;
    return {...receipt.roll,...(motion?{motion}:{})};
  }
  if (!owner.ready && args.motion)
    throw new ConvexError("Wait for your dice to warm up.");
  const previous = await ctx.db
    .query("diceDemoV2Tracks")
    .withIndex("by_room_viewer", (q) =>
      q.eq("key", found.key).eq("viewer", args.viewer),
    )
    .unique();
  if (previous) {
    const previousRequest = await ctx.db
      .query("diceDemoV2Requests")
      .withIndex("by_request", (q) =>
        q.eq("key", found.key).eq("viewer", args.viewer).eq("id", previous.roll.id),
      )
      .unique();
    // Server receipt creation includes sampling and physics preparation time.
    // Older tracks whose receipt was pruned retain the conservative start fallback.
    const requestedAt = previousRequest?._creationTime ?? previous.roll.startsAt;
    if (requestedAt + rollCooldownMs > Date.now())
      throw new ConvexError("Wait two seconds before another roll.");
  }
  if (
    args.faces.length !== dicePoolCount(dice) ||
    args.faces.some((n,index) => !Number.isInteger(n) || n < 1 || n > dicePoolSides(dice)[index]!)
  )
    throw authorityError("INVALID_REQUEST","Choose valid dice results for this pool.");
  const duration = args.motion ? validateMotion(args.motion, dicePoolCount(dice)) : 2200;
  const lead = Math.min(
    500,
    Math.max(
      150,
      ...found.participants
        .filter((p) => p.ready && p.seenAt > Date.now() - 30000)
        .map((p) => p.uncertainty * 2 + 50),
    ),
  );
  const natural = naturalDiceTotal(args.faces, dice),
    adjustment = resolveEdgeBane(edges, banes),
    modifier =
      dice.kind === "power" ? adjustment.modifier : genericModifier(edges, banes),
    total = natural + modifier;
  const power =
    dice.kind === "power"
      ? {
          edges,
          banes,
          total,
          tier:
            natural >= 19 ? (3 as const) : tierOf(total, adjustment.tierShift),
        }
      : undefined;
  const startsAt = Date.now() + lead,
    sequence = (found.sequence ?? 0) + 1;
  const expiresAt=receipt?.expiresAt ?? Math.min(found.expiresAt,Date.now()+(found.policy??defaultPolicy).receiptTtlMs);
  const roll = {
    historyExpiresAt: expiresAt,
    id: args.id,
    roller: owner.id,
    name: owner.name,
    faces: args.faces,
    dice,
    total,
    modifier,
    edges,
    banes,
    source: supplied ? ("supplied" as const) : ("generated" as const),
    sequence,
    ...(power ? { power } : {}),
    styles: Array.from({ length: dicePoolCount(dice) }, () => owner.style),
    ...(args.motion ? { motion: {...args.motion,version:1} } : {}),
    startsAt,
    duration,
    revealAt:
      startsAt +
      recordedRevealDelay({ faces: args.faces, motion: args.motion, duration }),
  };
  const {motion,...compactRoll}=roll;
  if (previous)
    await ctx.db.patch(previous._id, {
      roll: compactRoll,
      firstSequence: previous.firstSequence ?? await legacyFirstSequence(ctx, previous),
      receipts: [],
      expiresAt,
    });
  else
    await ctx.db.insert("diceDemoV2Tracks", {
      key: found.key,
      viewer: args.viewer,
      roll: compactRoll,
      firstSequence: sequence,
      receipts: [],
      expiresAt,
    });
  if(motion) await ctx.db.insert("diceDemoV2Presentations",{
    key:found.key,viewer:args.viewer,id:args.id,motion,expiresAt,
  });
  if (receipt) await ctx.db.patch(receipt._id, { fingerprint, roll:compactRoll, sequence });
  else
    await ctx.db.insert("diceDemoV2Requests", {
      key: found.key,
      viewer: args.viewer,
      id: args.id,
      dice,
      faces: args.faces,
      source: "supplied",
      fingerprint,
      roll:compactRoll,
      sequence,
      expiresAt: Math.min(
        found.expiresAt,
        Date.now() + (found.policy ?? defaultPolicy).receiptTtlMs,
      ),
      roomExpiresAt: found.expiresAt,
    });
  await ctx.db.patch(found._id, {
    sequence,
    ...(!receipt ? { requestCount: (found.requestCount ?? 0) + 1 } : {}),
  });
  return roll;
}
/** Integrating app's trusted server wrapper only; never callable by community clients. */
export const acceptSupplied = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    id: v.string(),
    dice: v.optional(diceConfiguration),
    faces: v.array(v.number()),
    motion: v.optional(demoMotion),
    edges: v.optional(v.number()),
    banes: v.optional(v.number()),
  },
  returns: participantRoll,
  handler: (ctx, args) => acceptThrow(ctx, args, true),
});
export const receipt = mutation({
  args: {
    key: v.string(),
    credential: v.string(),
    roller: v.string(),
    sample: demoReceipt,
  },
  returns: v.null(),
  handler: async (ctx, { key, credential, roller, sample }) => {
    const { found } = await member(ctx, key, sample.viewer, credential);
    if (
      !found ||
      found.expiresAt <= Date.now() ||
      !found.participants.some((p) => p.id === sample.viewer)
    )
      return null;
    const current = await ctx.db.query("diceDemoV2Tracks")
      .withIndex("by_room_viewer", q => q.eq("key", found.key).eq("viewer", roller)).unique();
    const roll = current?.roll;
    if (!roll || roll.id !== sample.roll || (roll.historyExpiresAt ?? Math.min(current?.expiresAt ?? Infinity, roll.startsAt + 3600000)) <= Date.now()) return null;
    if (Object.values(sample).some(n => typeof n === "number" && !Number.isFinite(n)))
      throw authorityError("INVALID_REQUEST", "Invalid timing sample.");
    const existing = await ctx.db.query("diceDemoV2PlaybackReceipts")
      .withIndex("by_roll_viewer", q => q.eq("key", found.key).eq("roller", roller).eq("rollId", sample.roll).eq("viewer", sample.viewer)).unique();
    // A late zero-frame delivery fallback must not replace real renderer timing.
    if (existing && existing.sample.frames > 0 && sample.frames === 0) return null;
    const expiresAt = roll.historyExpiresAt ?? Math.min(found.expiresAt, roll.startsAt + 3600000);
    if (existing) await ctx.db.patch(existing._id, { sample, expiresAt });
    else await ctx.db.insert("diceDemoV2PlaybackReceipts", {
      key: found.key, roller, rollId: sample.roll, viewer: sample.viewer, sample, expiresAt,
    });
    return null;
  },
});

/** Clear current shared dice; page-session result logs are intentionally retained. */
export const clearTray = mutation({
  args: { key: v.string(), viewer: v.string(), credential: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, viewer, credential }) => {
    const { found, session } = await member(ctx, key, viewer, credential);
    if (Date.now() - (session.lastClearAt ?? 0) < 250)
      throw new ConvexError("Wait a moment before clearing again.");
    await ctx.db.patch(session._id, { lastClearAt: Date.now() });
    for (const participant of found.participants) {
      const track = await ctx.db
        .query("diceDemoV2Tracks")
        .withIndex("by_room_viewer", (q) =>
          q.eq("key", found.key).eq("viewer", participant.id),
        )
        .unique();
      if (track) await ctx.db.delete(track._id);
    }
    return null;
  },
});
/** Compact accepted-result catch-up is separate from current tracks and presentation. */
export const events = query({
  args: {
    key: v.string(),
    viewer: v.string(),
    credential: v.string(),
    after: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rolls: v.array(participantRoll),
    cursor: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { found } = await member(ctx, args.key, args.viewer, args.credential);
    if (
      !Number.isSafeInteger(args.after) ||
      args.after < 0 ||
      args.after > (found.sequence ?? 0)
    )
      throw authorityError("INVALID_REQUEST","Invalid result cursor.");
    const size = args.limit ?? 20;
    if (!Number.isInteger(size) || size < 1 || size > 100)
      throw authorityError("INVALID_REQUEST","Choose a result page of 1–100 records.");
    const limit = Math.min(size, 20);
    const docs = await ctx.db
      .query("diceDemoV2Requests")
      .withIndex("by_key_sequence", (q) =>
        q.eq("key", found.key).gt("sequence", args.after),
      )
      .take(limit + 1);
    if (
      args.after < (found.sequence ?? 0) &&
      (!docs[0]?.roll ||
        docs[0].expiresAt <= Date.now() ||
        docs[0].sequence !== args.after + 1)
    )
      throw new ConvexError(
        "CURSOR_EXPIRED: retained result history expired. Restore current tracks.",
      );
    const page = docs.slice(0, limit);
    if(page.some((receipt,index)=>!receipt.roll || receipt.expiresAt<=Date.now() || receipt.sequence!==args.after+index+1))
      throw new ConvexError("CURSOR_EXPIRED: retained result history expired. Restore current tracks.");
    return {
      rolls: page.flatMap((receipt) => {
        if (!receipt.roll) return [];
        return [receipt.roll];
      }),
      cursor: page.at(-1)?.sequence ?? args.after,
      hasMore: docs.length > limit,
    };
  },
});
/** Host-only bounded policy configuration. Public join always uses the community defaults. */
export const setPolicy = mutation({
  args: { key: v.string(), policy: roomPolicy },
  returns: v.null(),
  handler: async (ctx, args) => {
    const found = await room(ctx, args.key);
    if (!found) throw authorityError("ROOM_EXPIRED","Room unavailable.");
    const p = args.policy;
    for (const [value, min, max] of [
      [p.capacity, 1, 32],
      [p.ttlMs, 60000, 7 * 86400000],
      [p.receiptTtlMs, 60000, p.ttlMs],
      [p.maxRolls, 1, 2000],
      [p.minRollIntervalMs, 250, 60000],
    ])
      if (!Number.isSafeInteger(value) || value < min || value > max)
        throw authorityError("INVALID_REQUEST","Invalid room policy.");
    const expiresAt = found._creationTime + p.ttlMs;
    await ctx.db.patch(found._id, { policy: p, expiresAt });
    const metadata = await ctx.db.query("diceDemoV2Tracks")
      .withIndex("by_room_viewer", q => q.eq("key", found.key)).take(32);
    for (const track of metadata) if ((track.expiresAt ?? Infinity) > expiresAt)
      await ctx.db.patch(track._id, { expiresAt });
    return null;
  },
});

/** Leave removes presence and the current tray, while retained semantic receipts survive. */
export const leave = mutation({
  args: {key:v.string(),viewer:v.string(),credential:v.string()},
  returns:v.null(),
  handler:async(ctx,args)=>{
    const {found,session}=await member(ctx,args.key,args.viewer,args.credential);
    const ownTrack=await ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer",q=>q.eq("key",found.key).eq("viewer",args.viewer)).unique();
    if(ownTrack) await ctx.db.delete(ownTrack._id);
    await ctx.db.delete(session._id);
    await ctx.db.patch(found._id,{participants:found.participants.filter(p=>p.id!==args.viewer)});
    return null;
  },
});

/** Resolve code aliases; canonical UUID clients avoid the presence-bearing room read. */
async function capabilityKey(ctx: QueryCtx, key: string) {
  if (codePattern.test(key.trim().toUpperCase())) {
    const found = await room(ctx, key);
    return found && found.expiresAt > Date.now() ? found.key : null;
  }
  validKey(key);
  return key;
}
async function playbackReceipts(ctx: QueryCtx | MutationCtx, key: string, roller: string, rollId: string,
  legacy: import("convex/values").Infer<typeof demoReceipt>[] = []) {
  const docs = await ctx.db.query("diceDemoV2PlaybackReceipts")
    .withIndex("by_roll_viewer", q => q.eq("key", key).eq("roller", roller).eq("rollId", rollId)).take(32);
  const samples = new Map(legacy.map(sample => [sample.viewer, sample]));
  for (const doc of docs) if (doc.expiresAt > Date.now()) samples.set(doc.viewer, doc.sample);
  return [...samples.values()].slice(-32);
}
/** Compact latest/overlap subscription; contains no recording buffers. */
export const trackMetadata = query({
  args: { key: v.string(), viewer: v.string() }, returns: trackMetadataResult,
  handler: async (ctx, args) => {
    const key = await capabilityKey(ctx, args.key);
    if (!key) return null;
    const current = await compactCurrent(ctx, key, args.viewer);
    if (!current || current.expiresAt <= Date.now()) return null;
    const docs = await ctx.db.query("diceDemoV2Requests")
      .withIndex("by_room_viewer_sequence", q => q.eq("key", key).eq("viewer", args.viewer).gte("sequence", current.firstSequence))
      .order("desc").take(8);
    const activeRolls = docs.flatMap(doc => doc.roll && doc.expiresAt > Date.now() &&
      doc.roll.startsAt + doc.roll.duration + 5600 > Date.now() ? [doc.roll] : []).reverse();
    return { roll: current.roll, activeRolls,
      receipts: await playbackReceipts(ctx, key, args.viewer, current.roll.id) };
  },
});
/** Immutable recording lookup, independently fetched when a roll ID changes. */
export const motion = query({
  args: { key: v.string(), viewer: v.string(), rollId: v.string() },
  returns: v.union(v.null(), demoMotion),
  handler: async (ctx, args) => {
    const key = await capabilityKey(ctx, args.key);
    if (!key) return null;
    const current = await compactCurrent(ctx, key, args.viewer);
    if (!current || current.expiresAt <= Date.now()) return null;
    const request = await ctx.db.query("diceDemoV2Requests")
      .withIndex("by_request", q => q.eq("key", key).eq("viewer", args.viewer).eq("id", args.rollId)).unique();
    if (!request?.roll || request.expiresAt <= Date.now() || (request.sequence ?? 0) < current.firstSequence) return null;
    const presentation = await ctx.db.query("diceDemoV2Presentations")
      .withIndex("by_request", q => q.eq("key", key).eq("viewer", args.viewer).eq("id", args.rollId)).unique();
    return presentation && presentation.expiresAt > Date.now() && (presentation.motion.version ?? 1) === 1 ? presentation.motion : null;
  },
});

/** Pre-upgrade compatibility lasts until the next accepted roll or one-hour expiry. */
async function compactCurrent(ctx: QueryCtx, key: string, viewer: string,
  existing?: import("./_generated/dataModel").Doc<"diceDemoV2Tracks">) {
  const track = existing ?? await ctx.db.query("diceDemoV2Tracks")
    .withIndex("by_room_viewer", q => q.eq("key", key).eq("viewer", viewer)).unique();
  if (!track) return null;
  let expiresAt = track.roll.historyExpiresAt;
  if (expiresAt === undefined) {
    // Only legacy rows need a presence-bearing room read. A shortened host TTL
    // or deleted room must invalidate UUID reads before normalization runs.
    const found = await room(ctx, key);
    if (!found || found.expiresAt <= Date.now()) return null;
    const request = await ctx.db.query("diceDemoV2Requests")
      .withIndex("by_request", q => q.eq("key", key).eq("viewer", viewer).eq("id", track.roll.id)).unique();
    expiresAt = Math.min(found.expiresAt, track.expiresAt ?? Infinity,
      request?.roll ? (request.roll.historyExpiresAt ?? request.expiresAt) : track.roll.startsAt + 3600000);
  }
  const { motion: _motion, ...roll } = track.roll;
  return { roll: { ...roll, historyExpiresAt: expiresAt },
    firstSequence: track.firstSequence ?? await legacyFirstSequence(ctx, track),
    expiresAt: Math.min(expiresAt, track.expiresAt ?? Infinity) };
}
async function legacyFirstSequence(ctx: QueryCtx, track: import("./_generated/dataModel").Doc<"diceDemoV2Tracks">) {
  // Existing pre-upgrade recordings need this bounded compatibility lookup once;
  // new tracks use the explicit sequence boundary and never read these buffers.
  const docs = await ctx.db.query("diceDemoV2Presentations")
    .withIndex("by_room_viewer", q => q.eq("key", track.key).eq("viewer", track.viewer).gte("_creationTime", track._creationTime))
    .order("desc").take(8);
  let first = track.roll.sequence ?? 0;
  for (const doc of docs) {
    const request = await ctx.db.query("diceDemoV2Requests")
      .withIndex("by_request", q => q.eq("key", track.key).eq("viewer", track.viewer).eq("id", doc.id)).unique();
    if (request?.sequence !== undefined && request.roll && request.expiresAt > Date.now()) first = Math.min(first, request.sequence);
  }
  return first;
}
