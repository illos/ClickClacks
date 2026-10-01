// SPDX-License-Identifier: MIT
/** Independent participant tracks, accessed through a public room capability. No campaign writes. */
import { ConvexError, v } from "convex/values";
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
  defaultDice,
  validateDiceConfiguration,
  type DiceConfiguration,
} from "../shared/dice";
import { validateMotion } from "./lib/recordedMotion";
import { recordedRevealDelay } from "../shared/timing";
import { sha256, toHex } from "./lib/sha256";
import {
  participant,
  participantRoll,
  diceConfiguration,
  roomPolicy,
} from "./diceDemoV2Tables";

const validKey = (key: string) => {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)
  )
    throw new ConvexError("Invalid room link.");
};
const codePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
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
const defaultNames = [
  "Plato",
  "Sappho",
  "Hypatia",
  "Cicero",
  "Cato",
  "Marcus Aurelius",
  "Aurelia",
  "Livia",
  "Ovid",
  "Seneca",
  "Ariadne",
  "Daphne",
  "Lucius",
  "Octavia",
  "Vergil",
  "Claudia",
  "Dion",
  "Theon",
  "Julia",
  "Titus",
  "Aelia",
  "Cornelia",
];
export const randomName = mutation({
  args: {},
  returns: v.string(),
  handler: async () =>
    defaultNames[Math.floor(Math.random() * defaultNames.length)]!,
});

function profile(name: string, style: { color: string; ink: string }) {
  if (
    !name.trim() ||
    name.length > 32 ||
    !/^#[a-f0-9]{6}$/i.test(style.color) ||
    !/^#[a-f0-9]{6}$/i.test(style.ink)
  )
    throw new ConvexError("Choose a name and valid dice colors.");
}
const defaultPolicy = {
  capacity: 8,
  ttlMs: 86400000,
  receiptTtlMs: 3600000,
  maxRolls: 2000,
  minRollIntervalMs: 250,
};
function config(dice?: DiceConfiguration) {
  try {
    const checked = validateDiceConfiguration(dice ?? defaultDice);
    return { kind: checked.kind, sides: checked.sides, count: checked.count };
  } catch (e) {
    throw new ConvexError((e as Error).message);
  }
}
function validCredential(credential: string) {
  if (credential.length < 32 || credential.length > 256)
    throw new ConvexError("Use your private session credential.");
}
async function member(
  ctx: MutationCtx | QueryCtx,
  key: string,
  viewer: string,
  credential: string,
) {
  const found = await room(ctx, key);
  if (!found || found.expiresAt <= Date.now())
    throw new ConvexError("Room expired. Open a new room.");
  validCredential(credential);
  const session = await ctx.db
    .query("diceDemoV2Sessions")
    .withIndex("by_room_viewer", (q) =>
      q.eq("key", found.key).eq("viewer", viewer),
    )
    .unique();
  if (!session || session.credential !== credential)
    throw new ConvexError("Invalid private session credential.");
  const owner = found.participants.find(
    (p) => p.id === viewer && p.seenAt > Date.now() - 30000,
  );
  if (!owner) throw new ConvexError("Reconnect to this room before throwing.");
  return { found, owner, session };
}
export const view = query({
  args: { key: v.string() },
  returns: v.object({
    expired: v.boolean(),
    participants: v.array(participant),
    code: v.union(v.string(), v.null()),
    cursor: v.optional(v.number()),
  }),
  handler: async (ctx, { key }) => {
    const found = await room(ctx, key);
    const expired = !!found && found.expiresAt <= Date.now();
    return {
      expired,
      participants: expired ? [] : (found?.participants ?? []),
      code: found?.code ?? null,
      cursor: found?.sequence ?? 0,
    };
  },
});
export const track = query({
  args: { key: v.string(), viewer: v.string() },
  returns: v.union(
    v.null(),
    v.object({ roll: participantRoll, receipts: v.array(demoReceipt) }),
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
    return current ? { roll: current.roll, receipts: current.receipts } : null;
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
      throw new ConvexError(
        "Use a private credential distinct from the public identity.",
      );
    profile(args.name, args.style);
    if (!Number.isFinite(args.uncertainty) || args.uncertainty < 0)
      throw new ConvexError("Invalid clock estimate.");
    const found = await room(ctx, args.key);
    if (!found && codePattern.test(args.key.trim().toUpperCase()))
      throw new ConvexError("Room code not found.");
    const session = found
      ? await ctx.db
          .query("diceDemoV2Sessions")
          .withIndex("by_room_viewer", (q) =>
            q.eq("key", found.key).eq("viewer", args.viewer),
          )
          .unique()
      : null;
    if (session && session.credential !== args.credential)
      throw new ConvexError("Invalid private session credential.");
    if (!session && (found?.sessionCount ?? 0) >= 200)
      throw new ConvexError(
        "This room reached its session limit. Open a new room.",
      );
    const selectedPolicy = found?.policy ?? defaultPolicy;
    const code = found?.code ?? (await allocateCode(ctx));
    const now = Date.now();
    if (found && found.expiresAt <= now)
      throw new ConvexError("Room expired. Open a new room.");
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
function semanticFingerprint(args: {
  dice?: DiceConfiguration;
  faces: number[];
  edges?: number;
  banes?: number;
}) {
  return toHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify({
          dice: config(args.dice),
          faces: args.faces,
          edges: args.edges ?? 0,
          banes: args.banes ?? 0,
        }),
      ),
    ),
  );
}
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
      receipt.dice.count !== dice.count
    )
      throw new ConvexError("Throw ID already used for another throw.");
    if (receipt.expiresAt <= Date.now() || !receipt.faces.length)
      throw new ConvexError("Request expired. Start a new roll with a new ID.");
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
      args.faces.length !== dice.count ||
      args.faces.some((n) => !Number.isInteger(n) || n < 1 || n > dice.sides)
    )
      throw new ConvexError("Invalid server-generated dice.");
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
    throw new ConvexError("Choose zero, one or two edges and banes.");
  let { found, owner, session, dice, receipt } = await requestReceipt(
    ctx,
    args,
  );
  if (!receipt && !supplied)
    throw new ConvexError(
      "Sample server-generated faces with this throw ID first.",
    );
  if (
    receipt &&
    (receipt.source !== (supplied ? "supplied" : "generated") ||
      JSON.stringify(receipt.faces) !== JSON.stringify(args.faces))
  )
    throw new ConvexError("Throw ID already used for another throw.");
  const fingerprint = semanticFingerprint(args);
  if (receipt?.fingerprint && receipt.fingerprint !== fingerprint)
    throw new ConvexError("Throw ID already used for another throw.");
  if (receipt?.roll) return receipt.roll;
  if (!owner.ready && args.motion)
    throw new ConvexError("Wait for your dice to warm up.");
  const previous = await ctx.db
    .query("diceDemoV2Tracks")
    .withIndex("by_room_viewer", (q) =>
      q.eq("key", found.key).eq("viewer", args.viewer),
    )
    .unique();
  if (previous && previous.roll.startsAt + previous.roll.duration > Date.now())
    throw new ConvexError("Your dice are still rolling.");
  if (
    args.faces.length !== dice.count ||
    args.faces.some((n) => !Number.isInteger(n) || n < 1 || n > dice.sides)
  )
    throw new ConvexError("Choose valid dice results for this pool.");
  const duration = args.motion ? validateMotion(args.motion, dice.count) : 2200;
  const lead = Math.min(
    500,
    Math.max(
      150,
      ...found.participants
        .filter((p) => p.ready && p.seenAt > Date.now() - 30000)
        .map((p) => p.uncertainty * 2 + 50),
    ),
  );
  const natural = args.faces.reduce((sum, n) => sum + n, 0),
    adjustment = resolveEdgeBane(edges, banes),
    modifier =
      dice.kind === "power" ? adjustment.modifier : 2 * (edges - banes),
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
  const roll = {
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
    styles: Array.from({ length: dice.count }, () => owner.style),
    ...(args.motion ? { motion: args.motion } : {}),
    startsAt,
    duration,
    revealAt:
      startsAt +
      recordedRevealDelay({ faces: args.faces, motion: args.motion, duration }),
  };
  if (previous)
    await ctx.db.patch(previous._id, {
      roll,
      receipts: [],
      expiresAt: found.expiresAt,
    });
  else
    await ctx.db.insert("diceDemoV2Tracks", {
      key: found.key,
      viewer: args.viewer,
      roll,
      receipts: [],
      expiresAt: found.expiresAt,
    });
  if (receipt) await ctx.db.patch(receipt._id, { fingerprint, roll, sequence });
  else
    await ctx.db.insert("diceDemoV2Requests", {
      key: found.key,
      viewer: args.viewer,
      id: args.id,
      dice,
      faces: args.faces,
      source: "supplied",
      fingerprint,
      roll,
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
    await member(ctx, key, sample.viewer, credential);
    const found = await room(ctx, key);
    if (
      !found ||
      found.expiresAt <= Date.now() ||
      !found.participants.some((p) => p.id === sample.viewer)
    )
      return null;
    const current = await ctx.db
      .query("diceDemoV2Tracks")
      .withIndex("by_room_viewer", (q) =>
        q.eq("key", found.key).eq("viewer", roller),
      )
      .unique();
    if (!current || current.roll.id !== sample.roll) return null;
    if (
      Object.values(sample).some(
        (n) => typeof n === "number" && !Number.isFinite(n),
      )
    )
      throw new ConvexError("Invalid timing sample.");
    await ctx.db.patch(current._id, {
      receipts: [
        ...current.receipts.filter((p) => p.viewer !== sample.viewer),
        sample,
      ].slice(-8),
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
      throw new ConvexError("Invalid result cursor.");
    const size = args.limit ?? 20;
    if (!Number.isInteger(size) || size < 1 || size > 100)
      throw new ConvexError("Choose a result page of 1–100 records.");
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
        const { motion, ...compact } = receipt.roll;
        return [compact];
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
    if (!found) throw new ConvexError("Room unavailable.");
    const p = args.policy;
    for (const [value, min, max] of [
      [p.capacity, 1, 32],
      [p.ttlMs, 60000, 7 * 86400000],
      [p.receiptTtlMs, 60000, p.ttlMs],
      [p.maxRolls, 1, 2000],
      [p.minRollIntervalMs, 250, 60000],
    ])
      if (!Number.isSafeInteger(value) || value < min || value > max)
        throw new ConvexError("Invalid room policy.");
    await ctx.db.patch(found._id, { policy: p, expiresAt: found._creationTime + p.ttlMs });
    return null;
  },
});

/** Leave removes presence and the current tray, while retained semantic receipts survive. */
export const leave = mutation({
  args: {key:v.string(),viewer:v.string(),credential:v.string()},
  returns:v.null(),
  handler:async(ctx,args)=>{
    const {found,session}=await member(ctx,args.key,args.viewer,args.credential);
    const ownTrack=await ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer",q=>q.eq("key",args.key).eq("viewer",args.viewer)).unique();
    if(ownTrack) await ctx.db.delete(ownTrack._id);
    await ctx.db.delete(session._id);
    await ctx.db.patch(found._id,{participants:found.participants.filter(p=>p.id!==args.viewer)});
    return null;
  },
});
