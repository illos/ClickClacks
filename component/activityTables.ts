// SPDX-License-Identifier: MIT
import {defineTable} from "convex/server";
import {v} from "convex/values";
export const activityState = v.object({
  at: v.number(), everMulti: v.boolean(), dayMulti: v.optional(v.string()), monthMulti: v.optional(v.string()),
  sessionStartedAt: v.optional(v.number()),
});
export const gameplayFields = {
  multiplayerTables: v.number(), sessionsStarted: v.number(), sessionsCompleted: v.number(), playerArrivals: v.number(),
  peakPlayers: v.number(), multiplayerMs: v.number(), playerMs: v.number(), completedMs: v.number(),
};
export const gameplayStats = v.object(gameplayFields);
export const activityTables = {
  activityTotals: defineTable({period: v.string(), shard: v.number(), startedAt: v.number(), ...gameplayFields})
    .index("by_period_shard", ["period", "shard"]),
};
