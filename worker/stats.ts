// SPDX-License-Identifier: MIT
import {ConvexHttpClient} from "convex/browser";
import {makeFunctionReference} from "convex/server";
import {trafficSummary, type MetricsDatabase} from "./metrics";
import type {GameplayStats, StatsPeriod, StatsSnapshot} from "../shared/stats";
const summary = makeFunctionReference<"query", {period: StatsPeriod}, {totals: GameplayStats; startedAt: number | null}>("stats:summary");
type StatsEnv = {ASSETS: {fetch(request: Request): Promise<Response>}; METRICS: MetricsDatabase; CONVEX_URL: string};
export default {
  async fetch(request: Request, env: StatsEnv) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/stats") return env.ASSETS.fetch(request);
    const headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"};
    if (request.method !== "GET") return Response.json({error: "Method not allowed."}, {status: 405, headers});
    const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return Response.json({error: "Sign in to view stats."}, {status: 401, headers});
    const period = url.searchParams.get("period") ?? "day";
    if (!["day", "month", "all"].includes(period)) return Response.json({error: "Invalid stats period."}, {status: 400, headers});
    const client = new ConvexHttpClient(env.CONVEX_URL);
    client.setAuth(token);
    let gameplay;
    try {gameplay = await client.query(summary, {period: period as StatsPeriod});}
    catch {return Response.json({error: "Could not verify your sign-in. Sign in again or retry."}, {status: 401, headers});}
    try {
      const now = Date.now();
      const traffic = await trafficSummary(env.METRICS, period as StatsPeriod, now);
      const dates = [traffic.startedAt, gameplay.startedAt].filter((date): date is number => date !== null);
      const snapshot: StatsSnapshot = {period: period as StatsPeriod, generatedAt: now, ...traffic,
        startedAt: dates.length ? Math.min(...dates) : null, gameplay: gameplay.totals};
      return Response.json(snapshot, {headers});
    } catch {return Response.json({error: "Stats are temporarily unavailable. Try refreshing."}, {status: 503, headers});}
  },
};
