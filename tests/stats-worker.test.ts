// SPDX-License-Identifier: MIT
import {afterEach, expect, test, vi} from "vitest";
import {emptyGameplay} from "../shared/stats";
import type {MetricsDatabase, MetricsStatement} from "../worker/metrics";
const {query} = vi.hoisted(() => ({query: vi.fn()}));
vi.mock("convex/browser", () => ({ConvexHttpClient: class {setAuth() {} query = query;}}));
import worker from "../worker/stats";
afterEach(() => {vi.useRealTimers(); query.mockReset();});

test.each(["day", "month"])("%s snapshot uses one boundary when the auth query crosses UTC month/day rollover", async period => {
  vi.useFakeTimers(); const start = Date.UTC(2026, 8, 30, 23, 59, 59, 900); vi.setSystemTime(start);
  query.mockImplementation(async () => {
    vi.setSystemTime(start + 200); // Already October by the time Convex replies.
    return {totals: emptyGameplay(), startedAt: null};
  });
  const reads: unknown[][] = [];
  const prepare = (sql: string): MetricsStatement => ({
    bind: (...values) => {reads.push([sql, ...values]); return prepare(sql);},
    first: async <T>() => (sql.includes("COUNT") ? {visitors: 0} : {day: null}) as T,
    all: async <T>() => ({results: [] as T[]}), run: async () => undefined,
  });
  const db: MetricsDatabase = {prepare, batch: async () => []};
  const response = await worker.fetch(new Request(`https://stats.clickclacks.app/api/stats?period=${period}`, {headers: {Authorization: "Bearer test"}}),
    {CONVEX_URL: "https://test.convex.cloud", METRICS: db, ASSETS: {fetch: async () => new Response()}});
  expect(response.status).toBe(200);
  expect(query.mock.calls[0]?.[1]).toEqual({period: period === "day" ? "day:2026-09-30" : "month:2026-09"});
  const data = await response.json();
  expect(data.generatedAt).toBe(start); expect(data.daily.at(-1).day).toBe("2026-09-30");
  expect(reads.filter(row => String(row[0]).includes("metrics_visitors")).every(row => row[2] === (period === "day" ? "day:2026-09-30" : "month:2026-09"))).toBe(true);
  expect(reads.filter(row => String(row[0]).includes("GROUP BY country")).every(row => row[3] === "2026-09-30")).toBe(true);
});
