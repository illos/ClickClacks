// SPDX-License-Identifier: MIT
import {DatabaseSync, type SQLInputValue} from "node:sqlite";
import {readFileSync} from "node:fs";
import {afterEach, expect, test, vi} from "vitest";
import {metricsRequest, trafficSummary, expireVisitorMarkers, injectMetrics, type MetricsDatabase, type MetricsStatement} from "../worker/metrics";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../worker/migrations/0003_metrics.sql", import.meta.url), "utf8"));
  const prepare = (sql: string, values: SQLInputValue[] = []): MetricsStatement => ({
    bind: (...next) => prepare(sql, next as SQLInputValue[]),
    first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
    all: async <T>() => ({results: sqlite.prepare(sql).all(...values) as T[]}),
    run: async () => sqlite.prepare(sql).run(...values),
  });
  const db: MetricsDatabase = {prepare, batch: async statements => {
    sqlite.exec("BEGIN");
    try {const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results;}
    catch (error) {sqlite.exec("ROLLBACK"); throw error;}
  }};
  return {db, sqlite};
}
function visit(host: string, cookie?: string, country = "US", extra: Record<string, string> = {}) {
  const request = new Request(`https://${host}/api/metrics/visit`, {method: "POST", headers: {Origin: `https://${host}`, ...(cookie ? {Cookie: cookie} : {}), ...extra}});
  Object.defineProperty(request, "cf", {value: {country}});
  return request;
}
afterEach(() => vi.useRealTimers());

test("real SQL deduplicates refreshes, retains distinct browsers across days, and separates website/app", async () => {
  vi.useFakeTimers(); const start = Date.UTC(2026, 9, 2, 12); vi.setSystemTime(start);
  const {db, sqlite} = database();
  const first = await metricsRequest(visit("clickclacks.app"), {METRICS: db}, "website");
  const cookie = first!.headers.get("set-cookie")!.split(";")[0]!;
  expect(first?.status).toBe(204); expect(first?.headers.get("set-cookie")).toContain("HttpOnly");
  await metricsRequest(visit("clickclacks.app", cookie), {METRICS: db}, "website");
  await metricsRequest(visit("dice.clickclacks.app", cookie, "GB"), {METRICS: db}, "app");
  let totals = await trafficSummary(db, "all", start);
  expect(totals.traffic.website).toEqual({visitors: 1, visits: 1, countries: [{country: "US", visits: 1}]});
  expect(totals.traffic.app.visitors).toBe(1);
  vi.setSystemTime(start + 86400000);
  await metricsRequest(visit("clickclacks.app", cookie, "CA"), {METRICS: db}, "website");
  await metricsRequest(visit("clickclacks.app", undefined, "CA"), {METRICS: db}, "website");
  totals = await trafficSummary(db, "month", Date.now());
  expect(totals.traffic.website.visitors).toBe(2); expect(totals.traffic.website.visits).toBe(3);
  expect((await trafficSummary(db, "day", Date.now())).traffic.website.visitors).toBe(2);
  expect(totals.daily.at(-1)?.website).toBe(2);
  const rows = JSON.stringify(sqlite.prepare("SELECT * FROM metrics_visitors").all());
  expect(rows).not.toContain(cookie.split("=")[1]); expect(rows).not.toContain("US");
  await expireVisitorMarkers(db, Date.now() + 100 * 86400000);
  expect((await trafficSummary(db, "all", Date.now() + 100 * 86400000)).traffic.website.visits).toBe(3);
  expect((await trafficSummary(db, "all", Date.now() + 100 * 86400000)).traffic.website.visitors).toBe(2);
  sqlite.close();
});

test("cross-origin submissions and privacy opt-outs cannot increment traffic", async () => {
  const {db, sqlite} = database();
  expect((await metricsRequest(visit("clickclacks.app", undefined, "US", {Origin: "https://elsewhere.example"}), {METRICS: db}, "website"))?.status).toBe(403);
  expect((await metricsRequest(visit("clickclacks.app", undefined, "US", {DNT: "1"}), {METRICS: db}, "website"))?.status).toBe(204);
  expect((await metricsRequest(visit("clickclacks.app", undefined, "US", {"Sec-GPC": "1"}), {METRICS: db}, "website"))?.status).toBe(204);
  expect((await trafficSummary(db, "all", Date.now())).traffic.website.visits).toBe(0);
  sqlite.close();
});

test("beacon injection preserves navigation and omits tray/demo documents", async () => {
  const response = () => new Response("<html><head></head><body>Roller</body></html>", {headers: {"Content-Type": "text/html", ETag: "old-body", "Content-Length": "100"}});
  const root = await injectMetrics(new Request("https://dice.clickclacks.app/"), response());
  expect(await root.text()).toContain("/api/metrics/beacon.js"); expect(root.headers.has("ETag")).toBe(false);
  const tray = await injectMetrics(new Request("https://dice.clickclacks.app/web/popout/tray.html"), response());
  expect(await tray.text()).not.toContain("beacon.js");
  const script = await metricsRequest(new Request("https://clickclacks.app/api/metrics/beacon.js"), {}, "website");
  expect(await script!.text()).toContain("window.top===window&&!window.opener");
});
