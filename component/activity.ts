// SPDX-License-Identifier: MIT
import {mutation, query} from "./_generated/server";
import {makeFunctionReference} from "convex/server";
import {v} from "convex/values";
import {gameplayStats} from "./activityTables";
import {emptyGameplay, validPeriodKey, type GameplayStats} from "../shared/stats";
import {updateActivity} from "./lib/activity";

export const summary = query({
  args: {period: v.string()}, returns: v.object({totals: gameplayStats, startedAt: v.union(v.number(), v.null())}),
  handler: async (ctx, {period}) => {
    if (!validPeriodKey(period)) throw new Error("Invalid stats period.");
    const docs = await ctx.db.query("activityTotals").withIndex("by_period_shard", q => q.eq("period", period)).take(16);
    const totals = emptyGameplay();
    for (const doc of docs) for (const field of Object.keys(totals) as (keyof GameplayStats)[])
      totals[field] = field === "peakPlayers" ? Math.max(totals[field], doc[field]) : totals[field] + doc[field];
    return {totals, startedAt: docs.length ? Math.min(...docs.map(d => d.startedAt)) : null};
  },
});

export const flush = mutation({args: {}, returns: v.number(), handler: async ctx => {
  const now = Date.now();
  const rooms = await ctx.db.query("diceDemoV2Rooms")
    .withIndex("by_activity_due", q => q.gt("activityDueAt", 0).lte("activityDueAt", now)).take(100);
  for (const room of rooms) await ctx.db.patch(room._id, await updateActivity(ctx, room, room.participants, now));
  if (rooms.length === 100) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation", {}, number>("activity:flush"), {});
  return rooms.length;
}});
