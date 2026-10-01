// SPDX-License-Identifier: MIT
/** Independent participant tracks, accessed through a public room capability. No campaign writes. */
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { demoMotion, demoReceipt, demoParticipantStyle as demoStyle } from './diceDemoTables';
import { resolveEdgeBane, tierOf } from '../shared/resolve/index';
import { participant, participantRoll } from './diceDemoV2Tables';

const validKey = (key: string) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))
    throw new ConvexError('Invalid room link.');
};
const codePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
async function room(ctx: MutationCtx | QueryCtx, key: string) {
  const code = key.trim().toUpperCase();
  if (codePattern.test(code))
    return ctx.db
      .query('diceDemoV2Rooms')
      .withIndex('by_code', q => q.eq('code', code))
      .unique();
  validKey(key);
  return ctx.db
    .query('diceDemoV2Rooms')
    .withIndex('by_key', q => q.eq('key', key))
    .unique();
}
async function allocateCode(ctx: MutationCtx) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('');
    if (
      !(await ctx.db
        .query('diceDemoV2Rooms')
        .withIndex('by_code', q => q.eq('code', code))
        .first())
    )
      return code;
  }
  throw new ConvexError('Could not allocate a room code. Try again.');
}
/** Standalone cosmetic names; no game catalog or campaign records are required. */
const defaultNames = [
  'Amber Otter', 'Copper Fox', 'Silver Finch', 'Indigo Hare',
  'Golden Badger', 'Slate Heron', 'Azure Moth', 'Crimson Wren',
];
export const randomName = mutation({
  args: {},
  returns: v.string(),
  handler: async () => defaultNames[Math.floor(Math.random() * defaultNames.length)]!,
});

function profile(name: string, style: { color: string; ink: string }) {
  if (
    !name.trim() ||
    name.length > 32 ||
    !/^#[a-f0-9]{6}$/i.test(style.color) ||
    !/^#[a-f0-9]{6}$/i.test(style.ink)
  )
    throw new ConvexError('Choose a name and valid dice colors.');
}
async function member(ctx: MutationCtx, key: string, viewer: string) {
  const found = await room(ctx, key);
  if (!found || found.expiresAt <= Date.now())
    throw new ConvexError('Room expired. Open a new room.');
  const owner = found.participants.find(p => p.id === viewer && p.seenAt > Date.now() - 30000);
  if (!owner) throw new ConvexError('Reconnect to this room before throwing.');
  return { found, owner };
}
export const view = query({
  args: { key: v.string() },
  returns: v.object({
    expired: v.boolean(),
    participants: v.array(participant),
    code: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { key }) => {
    const found = await room(ctx, key);
    const expired = !!found && found.expiresAt <= Date.now();
    return {
      expired,
      participants: expired ? [] : (found?.participants ?? []),
      code: found?.code ?? null,
    };
  },
});
export const track = query({
  args: { key: v.string(), viewer: v.string() },
  returns: v.union(v.null(), v.object({ roll: participantRoll, receipts: v.array(demoReceipt) })),
  handler: async (ctx, args) => {
    const found = await room(ctx, args.key);
    if (
      !found ||
      found.expiresAt <= Date.now() ||
      !found.participants.some(p => p.id === args.viewer)
    )
      return null;
    const current = await ctx.db
      .query('diceDemoV2Tracks')
      .withIndex('by_room_viewer', q => q.eq('key', found.key).eq('viewer', args.viewer))
      .unique();
    return current ? { roll: current.roll, receipts: current.receipts } : null;
  },
});
export const join = mutation({
  args: {
    key: v.string(),
    viewer: v.string(),
    name: v.string(),
    style: demoStyle,
    ready: v.boolean(),
    uncertainty: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validKey(args.viewer);
    profile(args.name, args.style);
    if (!Number.isFinite(args.uncertainty) || args.uncertainty < 0)
      throw new ConvexError('Invalid clock estimate.');
    const found = await room(ctx, args.key);
    if (!found && codePattern.test(args.key.trim().toUpperCase()))
      throw new ConvexError('Room code not found.');
    const code = found?.code ?? (await allocateCode(ctx));
    const now = Date.now();
    if (found && found.expiresAt <= now) throw new ConvexError('Room expired. Open a new room.');
    const alive = (found?.participants ?? []).filter(p => p.seenAt > now - 30000);
    const previous = alive.find(p => p.id === args.viewer);
    const others = alive.filter(p => p.id !== args.viewer);
    if (others.length >= 8) throw new ConvexError('This demo room has eight participants.');
    const slot =
      previous?.slot ??
      Array.from({ length: 8 }, (_, i) => i).find(i => !others.some(p => p.slot === i))!;
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
    if (found) await ctx.db.patch(found._id, { participants, code });
    else
      await ctx.db.insert('diceDemoV2Rooms', {
        key: args.key,
        code,
        expiresAt: now + 86400000,
        participants,
      });
    return null;
  },
});
export const customize = mutation({
  args: { key: v.string(), viewer: v.string(), name: v.string(), style: demoStyle },
  returns: v.null(),
  handler: async (ctx, args) => {
    profile(args.name, args.style);
    const { found } = await member(ctx, args.key, args.viewer);
    await ctx.db.patch(found._id, {
      participants: found.participants.map(p =>
        p.id === args.viewer ? { ...p, name: args.name.trim(), style: args.style } : p,
      ),
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
    motion: demoMotion,
    edges: v.optional(v.number()),
    banes: v.optional(v.number()),
  },
  returns: participantRoll,
  handler: async (ctx, args) => {
    const edges = args.edges ?? 0,
      banes = args.banes ?? 0;
    if ([edges, banes].some(n => !Number.isInteger(n) || n < 0 || n > 2))
      throw new ConvexError('Choose zero, one or two edges and banes.');
    const { found, owner } = await member(ctx, args.key, args.viewer);
    if (!owner.ready) throw new ConvexError('Wait for your dice to warm up.');
    validKey(args.id);
    const previous = await ctx.db
      .query('diceDemoV2Tracks')
      .withIndex('by_room_viewer', q => q.eq('key', found.key).eq('viewer', args.viewer))
      .unique();
    if (previous?.roll.id === args.id) {
      if (
        JSON.stringify(previous.roll.faces) !== JSON.stringify(args.faces) ||
        JSON.stringify(previous.roll.motion) !== JSON.stringify(args.motion) ||
        (previous.roll.power?.edges ?? 0) !== edges ||
        (previous.roll.power?.banes ?? 0) !== banes
      )
        throw new ConvexError('Throw ID already used for another throw.');
      return previous.roll;
    }
    if (previous && previous.roll.startsAt + previous.roll.duration > Date.now())
      throw new ConvexError('Your dice are still rolling.');
    if (args.faces.length !== 2 || args.faces.some(n => !Number.isInteger(n) || n < 1 || n > 10))
      throw new ConvexError('Choose two d10 results.');
    const motion = args.motion;
    if (
      !Number.isInteger(motion.seed) ||
      motion.seed < 0 ||
      motion.seed > 0xffffffff ||
      !Number.isFinite(motion.stepMs) ||
      Math.abs(motion.stepMs - 1000 / 60) > 1e-8 ||
      motion.samples.length < 28 ||
      motion.samples.length > 6734 ||
      motion.samples.length % 14 !== 0 ||
      motion.offsets.length !== 8 ||
      [...motion.samples, ...motion.offsets].some(n => !Number.isFinite(n) || Math.abs(n) > 20)
    )
      throw new ConvexError('Invalid recorded motion.');
    const lead = Math.min(
      500,
      Math.max(
        150,
        ...found.participants
          .filter(p => p.ready && p.seenAt > Date.now() - 30000)
          .map(p => p.uncertainty * 2 + 50),
      ),
    );
    // Compendium en/books/heroes/md/rule/dice/{edge,bane,tier-outcome,natural-roll}.md:
    // single edge/bane +/-2; double shifts tier; natural 19/20 always tier 3.
    // This standalone demo uses characteristic +0 and makes no critical-hit action claim.
    const natural = args.faces[0]! + args.faces[1]!;
    const adjustment = resolveEdgeBane(edges, banes);
    const total = natural + adjustment.modifier;
    const tier = natural >= 19 ? (3 as const) : tierOf(total, adjustment.tierShift);
    const roll = {
      id: args.id,
      roller: owner.id,
      name: owner.name,
      faces: args.faces,
      power: { edges, banes, total, tier },
      styles: [owner.style, owner.style],
      motion,
      startsAt: Date.now() + lead,
      duration: (motion.samples.length / 14 - 1) * motion.stepMs,
    };
    if (previous) await ctx.db.patch(previous._id, { roll, receipts: [] });
    else
      await ctx.db.insert('diceDemoV2Tracks', {
        key: found.key,
        viewer: args.viewer,
        roll,
        receipts: [],
      });
    return roll;
  },
});
export const receipt = mutation({
  args: { key: v.string(), roller: v.string(), sample: demoReceipt },
  returns: v.null(),
  handler: async (ctx, { key, roller, sample }) => {
    const found = await room(ctx, key);
    if (
      !found ||
      found.expiresAt <= Date.now() ||
      !found.participants.some(p => p.id === sample.viewer)
    )
      return null;
    const current = await ctx.db
      .query('diceDemoV2Tracks')
      .withIndex('by_room_viewer', q => q.eq('key', found.key).eq('viewer', roller))
      .unique();
    if (!current || current.roll.id !== sample.roll) return null;
    if (Object.values(sample).some(n => typeof n === 'number' && !Number.isFinite(n)))
      throw new ConvexError('Invalid timing sample.');
    await ctx.db.patch(current._id, {
      receipts: [...current.receipts.filter(p => p.viewer !== sample.viewer), sample].slice(-8),
    });
    return null;
  },
});

/** Clear current shared dice; page-session result logs are intentionally retained. */
export const clearTray = mutation({
  args: { key: v.string(), viewer: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, viewer }) => {
    const { found } = await member(ctx, key, viewer);
    for (const participant of found.participants) {
      const track = await ctx.db
        .query('diceDemoV2Tracks')
        .withIndex('by_room_viewer', q => q.eq('key', found.key).eq('viewer', participant.id))
        .unique();
      if (track) await ctx.db.delete(track._id);
    }
    return null;
  },
});
