// SPDX-License-Identifier: MIT
/** V244 presentation experiment. Possession of an unguessable room link grants demo access. */
import { ConvexError, v } from "convex/values";
import { authorityError } from "./lib/errors";
import { action, mutation, query } from "./_generated/server";
import {
  demoMotion,
  demoReceipt,
  demoRoll,
  demoStyle,
  demoViewer,
} from "./diceDemoTables";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { diceConfiguration } from "./diceDemoV2Tables";
import { defaultDice, validateDiceConfiguration } from "../shared/dice";
import { generate } from "./lib/dice";
const validKey = (key: string) => {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new ConvexError("Invalid demo room.");
};
async function room(ctx: MutationCtx | QueryCtx, key: string) {
  validKey(key);
  const found = await ctx.db
    .query("diceDemoRooms")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (found && found.expiresAt < Date.now())
    throw new ConvexError("Demo room expired. Open a new room.");
  return found;
}
/** Same server-side generator as game rolls, with a fresh demo seed and no campaign writes. */
export const sampleFaces = action({
  args: {
    key: v.optional(v.string()),
    viewer: v.optional(v.string()),
    credential: v.optional(v.string()),
    id: v.optional(v.string()),
    dice: v.optional(diceConfiguration),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args): Promise<number[]> => {
    let dice;
    try {
      dice = validateDiceConfiguration(args.dice ?? defaultDice);
    } catch (e) {
      throw authorityError("INVALID_REQUEST",(e as Error).message);
    }
    const hasSession = [args.key, args.viewer, args.credential, args.id].some(
      (value) => value !== undefined,
    );
    if (
      hasSession &&
      (!args.key || !args.viewer || !args.credential || !args.id)
    )
      throw authorityError("INVALID_REQUEST",
        "Provide the room, viewer, private credential and stable throw ID.",
      );
    const session = hasSession
      ? {
          key: args.key!,
          viewer: args.viewer!,
          credential: args.credential!,
          id: args.id!,
          dice,
        }
      : null;
    if (session) {
      const previous = await ctx.runQuery(
        api.diceDemoV2.sampleReceipt,
        session,
      );
      if (previous) return previous;
    }
    const faces = generate(
      crypto.getRandomValues(new Uint8Array(32)),
      0,
      Array.from({ length: dice.count }, (_, index) => ({
        id: `die-${index}`,
        sides: dice.sides,
      })),
    ).dice.map((die) => die.value);
    return session
      ? ctx.runMutation(api.diceDemoV2.recordSample, { ...session, faces })
      : faces;
  },
});
export const clock = action({
  args: {},
  returns: v.number(),
  handler: async () => Date.now(),
});
export const view = query({
  args: { key: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      viewers: v.array(demoViewer),
      roll: v.union(v.null(), demoRoll),
      receipts: v.array(demoReceipt),
    }),
  ),
  handler: async (ctx, { key }) => {
    const found = await room(ctx, key);
    return found
      ? { viewers: found.viewers, roll: found.roll, receipts: found.receipts }
      : null;
  },
});
export const join = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    name: v.string(),
    ready: v.boolean(),
    uncertainty: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validKey(args.viewer);
    if (
      args.name.length > 32 ||
      !Number.isFinite(args.uncertainty) ||
      args.uncertainty < 0
    )
      throw new ConvexError("Invalid viewer.");
    const found = await room(ctx, args.key);
    const now = Date.now();
    const viewers = (found?.viewers ?? []).filter(
      (p) => p.id !== args.viewer && p.seenAt > now - 30000,
    );
    if (viewers.length >= 16)
      throw new ConvexError("Demo supports up to 16 viewers.");
    viewers.push({
      id: args.viewer,
      name: args.name,
      ready: args.ready,
      uncertainty: args.uncertainty,
      seenAt: now,
    });
    if (found) await ctx.db.patch(found._id, { viewers });
    else
      await ctx.db.insert("diceDemoRooms", {
        key: args.key,
        expiresAt: now + 86400000,
        viewers,
        roll: null,
        receipts: [],
      });
    return null;
  },
});
export const throwDice = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    id: v.string(),
    faces: v.array(v.number()),
    styles: v.array(demoStyle),
    motion: v.optional(demoMotion),
  },
  returns: demoRoll,
  handler: async (ctx, args) => {
    const found = await room(ctx, args.key);
    if (
      !found ||
      !found.viewers.some(
        (p) => p.id === args.viewer && p.ready && p.seenAt > Date.now() - 30000,
      )
    )
      throw new ConvexError("Wait for the viewer to connect.");
    if (found.roll?.id === args.id) {
      if (
        JSON.stringify(found.roll.faces) !== JSON.stringify(args.faces) ||
        JSON.stringify(found.roll.styles) !== JSON.stringify(args.styles) ||
        JSON.stringify(found.roll.motion) !== JSON.stringify(args.motion)
      )
        throw new ConvexError(
          "This throw ID already has different faces or styles.",
        );
      return found.roll;
    }
    if (found.roll && Date.now() < found.roll.startsAt + found.roll.duration)
      throw new ConvexError("The current throw is still playing.");
    if (found.viewers.some((p) => p.seenAt > Date.now() - 30000 && !p.ready))
      throw new ConvexError("A viewer is still warming up.");
    if (
      args.faces.length !== 2 ||
      args.faces.some((n) => !Number.isInteger(n) || n < 1 || n > 10) ||
      args.styles.length !== 2 ||
      args.styles.some(
        (s) =>
          !/^#[a-f0-9]{6}$/i.test(s.color) || !/^#[a-f0-9]{6}$/i.test(s.ink),
      )
    )
      throw new ConvexError("Choose two d10 faces and valid colors.");
    validKey(args.id);
    if (
      args.motion &&
      ((args.motion.version ?? 1) !== 1 ||
        !Number.isInteger(args.motion.seed) ||
        args.motion.seed < 0 ||
        args.motion.seed > 0xffffffff ||
        Math.abs(args.motion.stepMs - 1000 / 60) > 1e-8 ||
        args.motion.samples.length < 28 ||
        args.motion.samples.length > 6734 ||
        args.motion.samples.length % 14 !== 0 ||
        args.motion.offsets.length !== 8 ||
        [...args.motion.samples, ...args.motion.offsets].some(
          (n) => !Number.isFinite(n) || Math.abs(n) > 20,
        ))
    )
      throw new ConvexError("Invalid recorded demo motion.");
    const duration = args.motion
      ? (args.motion.samples.length / 14 - 1) * args.motion.stepMs
      : 2200;
    const roll = {
      id: args.id,
      faces: args.faces,
      styles: args.styles,
      // Short shared lead: cover observed viewer latency without a fixed two-second pause.
      startsAt:
        Date.now() +
        Math.min(
          500,
          Math.max(
            150,
            ...found.viewers
              .filter(
                (viewer) => viewer.ready && viewer.seenAt > Date.now() - 30000,
              )
              .map((viewer) => viewer.uncertainty * 2 + 50),
          ),
        ),
      duration,
      ...(args.motion ? { motion: args.motion } : {}),
    };
    await ctx.db.patch(found._id, { roll, receipts: [] });
    return roll;
  },
});
export const receipt = mutation({
  args: { key: v.string(), sample: demoReceipt },
  returns: v.null(),
  handler: async (ctx, { key, sample }) => {
    const found = await room(ctx, key);
    if (
      !found ||
      sample.roll !== found.roll?.id ||
      !found.viewers.some((p) => p.id === sample.viewer)
    )
      return null;
    if (
      Object.values(sample).some(
        (n) => typeof n === "number" && !Number.isFinite(n),
      )
    )
      throw new ConvexError("Invalid timing sample.");
    const receipts = found.receipts
      .filter((s) => s.viewer !== sample.viewer)
      .slice(-15);
    receipts.push(sample);
    await ctx.db.patch(found._id, { receipts });
    return null;
  },
});
