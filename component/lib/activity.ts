// SPDX-License-Identifier: MIT
import type {Infer} from "convex/values";
import type {Doc} from "../_generated/dataModel";
import type {MutationCtx} from "../_generated/server";
import {activityState} from "../activityTables";
import {dayOf, monthOf, periodKeys, emptyGameplay, demoRoomPrefix, type GameplayStats} from "../../shared/stats";

type Presence = {id: string; seenAt: number};
type Room = Pick<Doc<"diceDemoV2Rooms">, "key" | "expiresAt" | "participants" | "activity">;
const leaseMs = 30000;
const flushMs = 300000;
const nextDay = (at: number) => Date.parse(dayOf(at)) + 86400000;
const living = (people: Presence[], at: number) => people.filter(p => p.seenAt + leaseMs > at);

/** Same membership between flushes: renewed leases live in the existing room write.
 * Only arrivals, departures, lease expiry, midnight and five-minute flushes write totals. */
export async function updateActivity(ctx: MutationCtx, room: Room, after: Presence[], now: number) {
  if (room.key.startsWith(demoRoomPrefix)) return {activity: undefined, activityDueAt: undefined};
  const original = room.activity;
  const state: Infer<typeof activityState> = original ? {...original} : {at: now, everMulti: false};
  const deltas = new Map<string, GameplayStats>();
  const add = (period: string, delta: Partial<GameplayStats>) => {
    const total = deltas.get(period) ?? emptyGameplay();
    for (const [field, amount] of Object.entries(delta) as [keyof GameplayStats, number][])
      total[field] = field === "peakPlayers" ? Math.max(total[field], amount) : total[field] + amount;
    deltas.set(period, total);
  };
  const allPeriods = (at: number, delta: Partial<GameplayStats>) => periodKeys(at).forEach(p => add(p, delta));
  const markTable = (at: number, count: number) => {
    const day = dayOf(at), month = monthOf(at);
    if (!state.everMulti) {add("all", {multiplayerTables: 1}); state.everMulti = true;}
    if (state.dayMulti !== day) {add(`day:${day}`, {multiplayerTables: 1}); state.dayMulti = day;}
    if (state.monthMulti !== month) {add(`month:${month}`, {multiplayerTables: 1}); state.monthMulti = month;}
    allPeriods(at, {peakPlayers: count});
  };
  const finish = (at: number) => {
    if (state.sessionStartedAt === undefined) return;
    allPeriods(at, {sessionsCompleted: 1, completedMs: Math.max(0, at - state.sessionStartedAt)});
    state.sessionStartedAt = undefined;
  };
  const sameMembers = room.participants.length === after.length &&
    room.participants.every(p => after.some(n => n.id === p.id));
  const end = Math.min(now, room.expiresAt);
  const due = Math.min(state.at + flushMs, nextDay(state.at), room.expiresAt,
    ...room.participants.map(p => p.seenAt + leaseMs));
  if (original && (!sameMembers || now >= due)) {
    let at = state.at;
    // Each segment ends at an actual presence expiry or UTC boundary. Closed tabs
    // cannot keep accruing time until the room's 24-hour storage expiry.
    while (at < end) {
      const people = living(room.participants, at);
      if (people.length < 2) {finish(at); break;}
      markTable(at, people.length);
      const until = Math.min(end, nextDay(at), ...people.map(p => p.seenAt + leaseMs));
      allPeriods(at, {multiplayerMs: until - at, playerMs: (until - at) * people.length});
      at = until;
      if (living(room.participants, at).length < 2) finish(at);
    }
    state.at = end;
  }
  const before = living(room.participants, now);
  const people = now < room.expiresAt ? living(after, now) : [];
  if (people.length < 2) finish(end);
  else {
    if (state.sessionStartedAt === undefined) {
      state.at = now;
      state.sessionStartedAt = now;
      allPeriods(now, {sessionsStarted: 1, playerArrivals: people.length});
    } else {
      const arrivals = people.filter(p => !before.some(previous => previous.id === p.id)).length;
      if (arrivals) allPeriods(now, {playerArrivals: arrivals});
    }
    // Regular heartbeats need no counter lookups or writes.
    if (!original || !sameMembers || now >= due) markTable(now, people.length);
  }
  const shard = parseInt(room.key.slice(0, 8), 16) % 16;
  for (const [period, delta] of deltas) {
    const existing = await ctx.db.query("activityTotals")
      .withIndex("by_period_shard", q => q.eq("period", period).eq("shard", shard)).unique();
    const totals = emptyGameplay();
    for (const field of Object.keys(totals) as (keyof GameplayStats)[])
      totals[field] = field === "peakPlayers" ? Math.max(existing?.[field] ?? 0, delta[field]) : (existing?.[field] ?? 0) + delta[field];
    if (existing) await ctx.db.patch(existing._id, totals);
    else await ctx.db.insert("activityTotals", {period, shard, startedAt: now, ...totals});
  }
  const activityDueAt = people.length >= 2 ? Math.min(state.at + flushMs, nextDay(state.at), room.expiresAt,
    ...people.map(p => p.seenAt + leaseMs)) : undefined;
  return {activity: state, activityDueAt};
}
