// SPDX-License-Identifier: MIT
import {v, type Infer} from "convex/values";
import {makeFunctionReference} from "convex/server";
import {query} from "./_generated/server";
import {components} from "./_generated/api";
import {getAuthUserId} from "@convex-dev/auth/server";
import {gameplayStats} from "../component/activityTables";
import {validPeriodKey} from "../shared/stats";
const summaryReturns = v.object({totals: gameplayStats, startedAt: v.union(v.number(), v.null())});
// Typed component reference also works before the ignored bindings are regenerated.
const activity = (components.powerroller as unknown as {activity: {summary: ReturnType<typeof makeFunctionReference<"query", {period: string}, Infer<typeof summaryReturns>>>}}).activity;
export const summary = query({
  args: {period: v.string()}, returns: summaryReturns,
  handler: async (ctx, {period}): Promise<Infer<typeof summaryReturns>> => {
    if (!await getAuthUserId(ctx)) throw new Error("Sign in to view stats.");
    if (!validPeriodKey(period)) throw new Error("Invalid stats period.");
    return ctx.runQuery(activity.summary, {period});
  },
});
