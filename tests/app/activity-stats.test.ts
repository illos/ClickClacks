// SPDX-License-Identifier: MIT
import {afterEach, expect, test, vi} from "vitest";
import {makeFunctionReference} from "convex/server";
import {api} from "../../component/_generated/api";
import {backend, componentBackend} from "./fixtures/table";
import {emptyGameplay, type GameplayStats} from "../../shared/stats";
const summary = makeFunctionReference<"query", {period: string}, {totals: GameplayStats; startedAt: number | null}>("activity:summary");
const flush = makeFunctionReference<"mutation", {}, number>("activity:flush");
const authenticatedSummary = makeFunctionReference<"query", {period: "day" | "month" | "all"}, {totals: GameplayStats; startedAt: number | null}>("stats:summary");
const key = "12345678-1234-1234-1234-123456789010";
const a = "12345678-1234-1234-1234-123456789011";
const b = "12345678-1234-1234-1234-123456789012";
const c = "12345678-1234-1234-1234-123456789013";
const credential = "test-private-credential-at-least-32-characters";
const style = {color: "#aabbcc", ink: "#112233", pattern: "solid" as const};
const args = (viewer: string, room = key) => ({key: room, viewer, credential, name: "Anonymous player", style, ready: true, uncertainty: 0});
afterEach(() => vi.useRealTimers());

test("solo and unchanged heartbeats add no counters; multiplayer arrivals, leaves and reopens are exact", async () => {
  vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 2));
  const t = componentBackend();
  const start = Date.now();
  await t.mutation(api.diceDemoV2.join, args(a));
  expect((await t.query(summary, {period: "all"})).totals).toEqual(emptyGameplay());
  vi.setSystemTime(start + 1000); await t.mutation(api.diceDemoV2.join, args(b));
  const writes = await t.run(ctx => ctx.db.query("activityTotals").collect());
  vi.setSystemTime(start + 6000); await t.mutation(api.diceDemoV2.join, args(b)); // PiP / heartbeat
  expect(await t.run(ctx => ctx.db.query("activityTotals").collect())).toEqual(writes);
  vi.setSystemTime(start + 11000); await t.mutation(api.diceDemoV2.join, args(c));
  vi.setSystemTime(start + 16000); await t.mutation(api.diceDemoV2.leave, {key, viewer: c, credential});
  vi.setSystemTime(start + 21000); await t.mutation(api.diceDemoV2.leave, {key, viewer: b, credential});
  expect((await t.query(summary, {period: "all"})).totals).toEqual({
    multiplayerTables: 1, sessionsStarted: 1, sessionsCompleted: 1, playerArrivals: 3,
    peakPlayers: 3, multiplayerMs: 20000, playerMs: 45000, completedMs: 20000,
  });
  vi.setSystemTime(start + 22000); await t.mutation(api.diceDemoV2.join, args(b));
  const reopened = (await t.query(summary, {period: "all"})).totals;
  expect(reopened.multiplayerTables).toBe(1); expect(reopened.sessionsStarted).toBe(2);
  expect(reopened.playerArrivals).toBe(5);
});

test("silence finishes at the presence deadline; expiry cleanup retains summaries", async () => {
  vi.useFakeTimers(); const start = Date.UTC(2026, 9, 2); vi.setSystemTime(start);
  const t = componentBackend();
  await t.mutation(api.diceDemoV2.join, args(a));
  vi.setSystemTime(start + 1000); await t.mutation(api.diceDemoV2.join, args(b));
  // Last heartbeat from A remains at t=0, so overlap ends at t=30s.
  vi.setSystemTime(start + 90000); await t.mutation(flush, {});
  const totals = (await t.query(summary, {period: "all"})).totals;
  expect(totals.multiplayerMs).toBe(29000); expect(totals.playerMs).toBe(58000);
  expect(totals.completedMs).toBe(29000); expect(totals.sessionsCompleted).toBe(1);
  await t.mutation(flush, {});
  expect((await t.query(summary, {period: "all"})).totals).toEqual(totals);
  vi.setSystemTime(start + 86400001); await t.mutation(api.cleanup.expired, {});
  expect((await t.query(summary, {period: "all"})).totals).toEqual(totals);
  expect(await t.run(ctx => ctx.db.query("diceDemoV2Rooms").collect())).toHaveLength(0);
});

test("UTC month/day boundaries split duration and count a table once in each period", async () => {
  vi.useFakeTimers(); const start = Date.UTC(2026, 8, 30, 23, 59, 50); vi.setSystemTime(start);
  const t = componentBackend();
  await t.mutation(api.diceDemoV2.join, args(a)); await t.mutation(api.diceDemoV2.join, args(b));
  vi.setSystemTime(start + 20000); await t.mutation(api.diceDemoV2.leave, {key, viewer: b, credential});
  const old = (await t.query(summary, {period: "month:2026-09"})).totals;
  const next = (await t.query(summary, {period: "day:2026-10-01"})).totals;
  expect(old.multiplayerMs).toBe(10000); expect(old.multiplayerTables).toBe(1);
  expect(next.multiplayerMs).toBe(10000); expect(next.multiplayerTables).toBe(1);
  expect(next.sessionsStarted).toBe(0); expect(next.completedMs).toBe(20000);
  expect((await t.query(summary, {period: "all"})).totals.multiplayerTables).toBe(1);
});

test("automated demo rooms are excluded and unauthenticated readers cannot obtain stats", async () => {
  const t = componentBackend(); const demo = "de000000-1234-1234-1234-123456789010";
  await t.mutation(api.diceDemoV2.join, args(a, demo)); await t.mutation(api.diceDemoV2.join, args(b, demo));
  expect((await t.query(summary, {period: "all"})).totals).toEqual(emptyGameplay());
  const host = backend();
  await expect(host.query(authenticatedSummary, {period: "all"})).rejects.toThrow("Sign in");
  const user = await host.run(ctx => ctx.db.insert("users", {email: "viewer@example.com"}));
  const readback = await host.withIdentity({subject: `${user}|test-session`}).query(authenticatedSummary, {period: "all"});
  expect(readback.totals).toEqual(emptyGameplay());
  expect(JSON.stringify(readback)).not.toContain("example.com");
});
