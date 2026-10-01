import { ConvexError, v, type Infer } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server.js";
import {
  accepted,
  appearance,
  event,
  member,
  motion,
  request,
  room,
  sessionArgs,
  policyOptions,
  roomPolicy,
  result as resultValidator,
} from "./validators.js";
import { resolveRoll, validateRequest, type RollRequest } from "../dice.js";
import { approveResolution } from "./resolution.js";
import { validateInput } from "./errors.js";
import type { Doc } from "./_generated/dataModel.js";
const HOUR = 3_600_000;
const DEFAULT_POLICY: Infer<typeof roomPolicy> = {
  capacity: 8,
  ttlMs: 24 * HOUR,
  receiptTtlMs: HOUR,
  eventTtlMs: HOUR,
  maxEvents: 10_000,
  maxSessions: 200,
  revealDelayMs: 2200,
  startDelayMs: 150,
  models: [3, 4, 6, 8, 10, 12, 20, 100].map((sides) => ({
    id: `d${sides}`,
    sides,
  })),
};
function policy(input?: Infer<typeof policyOptions>): Infer<typeof roomPolicy> {
  const value = {
    ...DEFAULT_POLICY,
    ...input,
    receiptTtlMs:
      input?.receiptTtlMs ??
      Math.min(
        DEFAULT_POLICY.receiptTtlMs,
        input?.ttlMs ?? DEFAULT_POLICY.ttlMs,
      ),
    eventTtlMs:
      input?.eventTtlMs ??
      Math.min(DEFAULT_POLICY.eventTtlMs, input?.ttlMs ?? DEFAULT_POLICY.ttlMs),
    startDelayMs:
      input?.startDelayMs ??
      Math.min(
        DEFAULT_POLICY.startDelayMs,
        input?.revealDelayMs ?? DEFAULT_POLICY.revealDelayMs,
      ),
  };
  const bounded = (name: keyof typeof value, min: number, max: number) => {
    const number = value[name];
    if (
      typeof number !== "number" ||
      !Number.isSafeInteger(number) ||
      number < min ||
      number > max
    )
      fail(
        "INVALID_POLICY",
        `Invalid ${name}; expected integer ${min}–${max}.`,
      );
  };
  bounded("capacity", 1, 32);
  bounded("ttlMs", 60_000, 7 * 24 * HOUR);
  bounded("receiptTtlMs", 60_000, value.ttlMs);
  bounded("eventTtlMs", 60_000, value.ttlMs);
  bounded("maxEvents", 1, 10_000);
  bounded("maxSessions", value.capacity, 1000);
  bounded("revealDelayMs", 0, 10_000);
  bounded("startDelayMs", 0, value.revealDelayMs);
  if (
    value.models.length > 64 ||
    value.models.some(
      (model) =>
        !/^[-a-zA-Z0-9_]{1,64}$/.test(model.id) ||
        !Number.isInteger(model.sides) ||
        model.sides < 2 ||
        model.sides > 1000,
    ) ||
    new Set(value.models.map((model) => model.id)).size !== value.models.length
  )
    fail(
      "INVALID_POLICY",
      "Register at most 64 uniquely identified dice models with valid side counts.",
    );
  return value;
}
type Appearance = Infer<typeof appearance>;
const DEFAULT_STYLE: Appearance = {
  color: "#c73d50",
  ink: "#ffffff",
  pattern: "solid",
  font: "serif",
};
const fail = (code: string, message: string): never => {
  throw new ConvexError({ code, message });
};
function validCredential(credential: string) {
  if (credential.length < 32 || credential.length > 256)
    fail(
      "INVALID_CREDENTIAL",
      "Use a private, random session credential of at least 32 characters.",
    );
}
function validName(name: string) {
  const text = name.trim();
  if (!text || text.length > 60)
    fail("INVALID_NAME", "Name must contain 1–60 characters.");
  return text;
}
function validAppearance(style: Appearance) {
  if (
    !/^#[0-9a-f]{6}$/i.test(style.color) ||
    !/^#[0-9a-f]{6}$/i.test(style.ink) ||
    style.pattern.length > 40 ||
    style.font.length > 60
  )
    fail("INVALID_APPEARANCE", "Invalid dice style.");
  return style;
}
async function getRoom(ctx: QueryCtx | MutationCtx, roomId: string) {
  const id = ctx.db.normalizeId("rooms", roomId);
  const doc = id ? await ctx.db.get(id) : null;
  if (!doc || doc.expiresAt <= Date.now())
    return fail("ROOM_EXPIRED", "This room has expired. Create another room.");
  return doc;
}
async function authenticate(
  ctx: QueryCtx | MutationCtx,
  args: { roomId: string; credential: string },
) {
  validCredential(args.credential);
  const room = await getRoom(ctx, args.roomId);
  const member = await ctx.db
    .query("members")
    .withIndex("by_room_credential", (q) =>
      q.eq("roomId", room._id).eq("credential", args.credential),
    )
    .unique();
  if (!member || member.left)
    return fail(
      "UNAUTHORIZED",
      "Join this room with your private session credential.",
    );
  return { room, member };
}
async function ensureSeat(
  ctx: QueryCtx | MutationCtx,
  room: Doc<"rooms">,
  memberId?: Doc<"members">["_id"],
) {
  const active = await ctx.db
    .query("members")
    .withIndex("by_room_active", (q) =>
      q.eq("roomId", room._id).eq("left", false).gt("activeUntil", Date.now()),
    )
    .take(room.policy.capacity + 1);
  if (active.filter((m) => m._id !== memberId).length >= room.policy.capacity)
    return fail(
      "ROOM_FULL",
      "This room is at its active participant capacity.",
    );
}
const publicMember = (doc: Doc<"members">) => ({
  id: doc.publicId,
  name: doc.name,
  appearance: doc.appearance,
  activeUntil: doc.activeUntil,
});
async function addMember(
  ctx: MutationCtx,
  roomDoc: Doc<"rooms">,
  name: string,
  credential: string,
  style: Appearance,
) {
  validCredential(credential);
  const existing = await ctx.db
    .query("members")
    .withIndex("by_room_credential", (q) =>
      q.eq("roomId", roomDoc._id).eq("credential", credential),
    )
    .unique();
  const all = await ctx.db
    .query("members")
    .withIndex("by_room", (q) => q.eq("roomId", roomDoc._id))
    .take(roomDoc.policy.maxSessions + 1);
  await ensureSeat(ctx, roomDoc, existing?._id);
  if (!existing && all.length >= roomDoc.policy.maxSessions)
    return fail(
      "ROOM_FULL",
      "This room has reached its session limit. Create another room.",
    );
  const data = {
    name: validName(name),
    appearance: validAppearance(style),
    activeUntil: Date.now() + 30_000,
    left: false,
  };
  if (existing) {
    await ctx.db.patch(existing._id, data);
    return publicMember({ ...existing, ...data });
  }
  const id = await ctx.db.insert("members", {
    roomId: roomDoc._id,
    publicId: "pending",
    credential,
    ...data,
    lastRollAt: 0,
    expiresAt: roomDoc.expiresAt,
  });
  // Public document identifiers are attribution, never authentication credentials.
  await ctx.db.patch(id, { publicId: id });
  return {
    id,
    name: data.name,
    appearance: data.appearance,
    activeUntil: data.activeUntil,
  };
}
export const create = mutation({
  args: {
    name: v.string(),
    credential: v.string(),
    appearance: v.optional(appearance),
    policy: v.optional(policyOptions),
  },
  returns: v.object({ room, member }),
  handler: async (ctx, args) => {
    const roomPolicy = policy(args.policy);
    const id = await ctx.db.insert("rooms", {
      expiresAt: Date.now() + roomPolicy.ttlMs,
      sequence: 0,
      policy: roomPolicy,
    });
    const doc = (await ctx.db.get(id))!;
    const member = await addMember(
      ctx,
      doc,
      args.name,
      args.credential,
      args.appearance ?? DEFAULT_STYLE,
    );
    return { room: { id, expiresAt: doc.expiresAt }, member };
  },
});
export const join = mutation({
  args: {
    ...sessionArgs,
    name: v.string(),
    appearance: v.optional(appearance),
  },
  returns: v.object({ room, member }),
  handler: async (ctx, args) => {
    const room = await getRoom(ctx, args.roomId);
    const member = await addMember(
      ctx,
      room,
      args.name,
      args.credential,
      args.appearance ?? DEFAULT_STYLE,
    );
    return { room: { id: room._id, expiresAt: room.expiresAt }, member };
  },
});
export const heartbeat = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, member } = await authenticate(ctx, args);
    await ensureSeat(ctx, room, member._id);
    await ctx.db.patch(member._id, { activeUntil: Date.now() + 30_000 });
    return null;
  },
});
export const profile = mutation({
  args: {
    ...sessionArgs,
    name: v.optional(v.string()),
    appearance: v.optional(appearance),
  },
  returns: member,
  handler: async (ctx, args) => {
    const { member } = await authenticate(ctx, args);
    const patch = {
      ...(args.name !== undefined ? { name: validName(args.name) } : {}),
      ...(args.appearance
        ? { appearance: validAppearance(args.appearance) }
        : {}),
    };
    await ctx.db.patch(member._id, patch);
    return publicMember({ ...member, ...patch });
  },
});
export const leave = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await authenticate(ctx, args);
    await ctx.db.patch(member._id, { left: true, activeUntil: 0 });
    return null;
  },
});
export const view = query({
  args: sessionArgs,
  returns: v.object({
    room,
    members: v.array(member),
    cursor: v.number(),
    latest: v.array(accepted),
  }),
  handler: async (ctx, args) => {
    const { room } = await authenticate(ctx, args);
    const members = await ctx.db
      .query("members")
      .withIndex("by_room_active", (q) =>
        q
          .eq("roomId", room._id)
          .eq("left", false)
          .gt("activeUntil", Date.now()),
      )
      .take(room.policy.capacity);
    const latest = members.flatMap((member) =>
      member.latestRoll ? [member.latestRoll] : [],
    );
    return {
      room: { id: room._id, expiresAt: room.expiresAt },
      members: members.map(publicMember),
      cursor: room.sequence,
      latest,
    };
  },
});
export const events = query({
  args: { ...sessionArgs, after: v.number(), limit: v.optional(v.number()) },
  returns: v.object({
    events: v.array(event),
    cursor: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { room } = await authenticate(ctx, args);
    if (
      !Number.isSafeInteger(args.after) ||
      args.after < 0 ||
      args.after > room.sequence
    )
      fail("INVALID_CURSOR", "Invalid room cursor.");
    const limit = args.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      fail("INVALID_LIMIT", "Catch-up pages contain 1–100 events.");
    const docs = await ctx.db
      .query("rolls")
      .withIndex("by_room_sequence", (q) =>
        q.eq("roomId", room._id).gt("sequence", args.after),
      )
      .take(limit + 1);
    if (
      args.after < room.sequence &&
      (!docs[0] ||
        docs[0].sequence !== args.after + 1 ||
        docs[0].expiresAt <= Date.now())
    )
      fail(
        "CURSOR_EXPIRED",
        "Missed results exceeded the configured catch-up window. Refresh current room state.",
      );
    const page = docs.slice(0, limit);
    return {
      events: page.map((d) => ({
        sequence: d.sequence,
        kind: d.kind,
        memberId: d.memberId,
        ...(d.roll ? { roll: d.roll } : {}),
      })),
      cursor: page.at(-1)?.sequence ?? args.after,
      hasMore: docs.length > limit,
    };
  },
});
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function fingerprint(
  input: RollRequest,
  source: "generated" | "supplied",
  values?: number[],
  resolved?: Infer<typeof resultValidator>,
) {
  validateInput(() => validateRequest(input));
  const serialized = canonical({
    input,
    source,
    ...(values ? { values } : {}),
    ...(resolved ? { resolved } : {}),
  });
  if (serialized.length > 16_000)
    fail("REQUEST_TOO_LARGE", "Roll requests must fit within 16 KB.");
  return serialized;
}
async function lookup(
  ctx: QueryCtx | MutationCtx,
  args: {
    roomId: string;
    credential: string;
    request: RollRequest;
    source: "generated" | "supplied";
    values?: number[];
    resolved?: Infer<typeof resultValidator>;
  },
) {
  const { room, member } = await authenticate(ctx, args);
  const print = fingerprint(
    args.request,
    args.source,
    args.values,
    args.resolved,
  );
  const receipt = await ctx.db
    .query("receipts")
    .withIndex("by_request", (q) =>
      q
        .eq("roomId", room._id)
        .eq("memberId", member.publicId)
        .eq("requestId", args.request.requestId),
    )
    .unique();
  if (receipt) {
    if (receipt.fingerprint !== print)
      fail(
        "REQUEST_CONFLICT",
        "This request ID was already used with different inputs.",
      );
    if (receipt.expiresAt <= Date.now() || !receipt.roll)
      fail(
        "REQUEST_EXPIRED",
        "This request receipt expired. Start a new roll with a new request ID.",
      );
  }
  return { room, member, print, receipt };
}
export const receipt = query({
  args: { ...sessionArgs, request },
  returns: v.union(accepted, v.null()),
  handler: async (ctx, args) =>
    (await lookup(ctx, { ...args, source: "generated" })).receipt?.roll ?? null,
});
async function accept(
  ctx: MutationCtx,
  args: {
    roomId: string;
    credential: string;
    request: RollRequest;
    values: number[];
    resolved?: Infer<typeof resultValidator>;
    source: "generated" | "supplied";
  },
) {
  const { room, member, print, receipt } = await lookup(ctx, {
    ...args,
    values: args.source === "supplied" ? args.values : undefined,
  });
  if (receipt?.roll) return receipt.roll;
  await ensureSeat(ctx, room, member._id);
  if (Date.now() - member.lastRollAt < 250)
    fail("RATE_LIMIT", "Wait a moment before another roll.");
  if (room.sequence >= room.policy.maxEvents)
    fail(
      "ROOM_LIMIT",
      "This room reached its event limit. Create another room.",
    );
  const result = args.resolved
    ? approveResolution(args.request, args.resolved)
    : validateInput(() => resolveRoll(args.request, args.values));
  const now = Date.now(),
    sequence = room.sequence + 1;
  const id = await ctx.db.insert("rolls", {
    roomId: room._id,
    sequence,
    kind: "roll",
    memberId: member.publicId,
    expiresAt: Math.min(room.expiresAt, now + room.policy.eventTtlMs),
  });
  const roll = {
    id,
    sequence,
    memberId: member.publicId,
    name: member.name,
    appearance: member.appearance,
    request: args.request,
    result,
    acceptedAt: now,
    startsAt: now + room.policy.startDelayMs,
    revealAt: now + room.policy.revealDelayMs,
    source: args.source,
  };
  await ctx.db.patch(id, { roll });
  await ctx.db.patch(room._id, { sequence });
  await ctx.db.patch(member._id, {
    lastRollAt: now,
    latestRoll: roll,
    activeUntil: now + 30_000,
  });
  await ctx.db.insert("receipts", {
    roomId: room._id,
    memberId: member.publicId,
    requestId: args.request.requestId,
    fingerprint: print,
    roll,
    expiresAt: Math.min(room.expiresAt, now + room.policy.receiptTtlMs),
    roomExpiresAt: room.expiresAt,
  });
  return roll;
}
export const acceptGenerated = mutation({
  args: { ...sessionArgs, request, values: v.array(v.number()) },
  returns: accepted,
  handler: (ctx, args) => accept(ctx, { ...args, source: "generated" }),
});
/** Only a trusted host wrapper may call this. The community app exports no supplied-values endpoint. */
export const acceptSupplied = mutation({
  args: { ...sessionArgs, request, values: v.array(v.number()) },
  returns: accepted,
  handler: (ctx, args) => accept(ctx, { ...args, source: "supplied" }),
});
/** Host-authenticated wrappers can install custom interpretation without forking this component. */
export const acceptResolved = mutation({
  args: { ...sessionArgs, request, result: resultValidator },
  returns: accepted,
  handler: (ctx, args) =>
    accept(ctx, {
      ...args,
      values: args.result.dice.map((die) => die.value),
      resolved: args.result,
      source: "supplied",
    }),
});
export const clear = mutation({
  args: sessionArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, member } = await authenticate(ctx, args);
    if (room.sequence >= room.policy.maxEvents)
      fail("ROOM_LIMIT", "Create another room.");
    if (Date.now() - (member.lastClearAt ?? 0) < 250)
      fail("RATE_LIMIT", "Wait a moment before clearing again.");
    const sequence = room.sequence + 1;
    await ctx.db.insert("rolls", {
      roomId: room._id,
      sequence,
      kind: "clear",
      memberId: member.publicId,
      expiresAt: Math.min(room.expiresAt, Date.now() + room.policy.eventTtlMs),
    });
    await ctx.db.patch(room._id, { sequence });
    await ctx.db.patch(member._id, {
      latestRoll: undefined,
      lastClearAt: Date.now(),
    });
    return null;
  },
});
export const attachPresentation = mutation({
  args: { ...sessionArgs, rollId: v.string(), motion },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, member } = await authenticate(ctx, args);
    const id = ctx.db.normalizeId("rolls", args.rollId);
    const stored = id ? await ctx.db.get(id) : null;
    const roll = stored?.roll;
    if (
      !roll ||
      stored!.roomId !== room._id ||
      roll.memberId !== member.publicId
    )
      return fail(
        "UNAUTHORIZED",
        "Only the roller may attach presentation to their accepted roll.",
      );
    const payload = args.motion;
    if (
      payload.frames.length > 100_000 ||
      payload.modelIds.length !== roll.result.dice.length ||
      payload.dieIds.length !== roll.result.dice.length ||
      payload.values.length !== roll.result.dice.length ||
      payload.frames.some((n) => !Number.isFinite(n))
    )
      fail("INVALID_PRESENTATION", "Invalid presentation payload.");
    if (
      payload.modelIds.some(
        (id) => !room.policy.models.some((model) => model.id === id),
      )
    )
      fail("INVALID_PRESENTATION", "Unknown presentation model.");
    for (let i = 0; i < roll.result.dice.length; i++) {
      const die = roll.result.dice[i];
      if (
        payload.dieIds[i] !== die.id ||
        payload.values[i] !== die.value ||
        (room.policy.models.find((model) => model.id === payload.modelIds[i])
          ?.sides !== die.sides &&
          !(
            roll.request.ruleset === "percentile" &&
            die.sides === 10 &&
            payload.modelIds[i] === "d100"
          ))
      )
        fail(
          "INVALID_PRESENTATION",
          "Presentation does not agree with accepted dice.",
        );
    }
    const existing = await ctx.db
      .query("presentation")
      .withIndex("by_roll", (q) =>
        q.eq("roomId", room._id).eq("rollId", args.rollId),
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, { motion: payload });
    else
      await ctx.db.insert("presentation", {
        roomId: room._id,
        rollId: args.rollId,
        memberId: member.publicId,
        motion: payload,
        expiresAt: Math.min(
          room.expiresAt,
          Date.now() + room.policy.eventTtlMs,
        ),
      });
    return null;
  },
});
export const getPresentation = query({
  args: { ...sessionArgs, rollId: v.string() },
  returns: v.union(motion, v.null()),
  handler: async (ctx, args) => {
    const { room } = await authenticate(ctx, args);
    const stored = await ctx.db
      .query("presentation")
      .withIndex("by_roll", (q) =>
        q.eq("roomId", room._id).eq("rollId", args.rollId),
      )
      .unique();
    return stored && stored.expiresAt > Date.now() ? stored.motion : null;
  },
});
