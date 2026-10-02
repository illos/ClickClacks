// SPDX-License-Identifier: MIT
import {dayOf, monthOf, periodKeys, type StatsPeriod, type TrafficStats} from "../shared/stats";
export interface MetricsStatement {
  bind(...values: unknown[]): MetricsStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{results: T[]}>;
  run(): Promise<unknown>;
}
export interface MetricsDatabase {
  prepare(sql: string): MetricsStatement;
  batch(statements: MetricsStatement[]): Promise<unknown>;
}
export type MetricsEnv = {
  METRICS?: MetricsDatabase;
  METRICS_LIMITER?: {limit(options: {key: string}): Promise<{success: boolean}>};
};
const visitorCookie = "cc_stats_browser";
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/;
const beacon = `if(window.top===window&&!window.opener&&!navigator.globalPrivacyControl&&navigator.doNotTrack!=="1"){fetch("/api/metrics/visit",{method:"POST",credentials:"same-origin",keepalive:true}).catch(()=>{});}`;
const noStore = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"};

/** Browser entries only; iframe demos and PiP documents never send a visit. */
export async function metricsRequest(request: Request, env: MetricsEnv, scope: "website" | "app") {
  const url = new URL(request.url);
  if (url.pathname === "/api/metrics/beacon.js" && request.method === "GET")
    return new Response(beacon, {headers: {"Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"}});
  if (url.pathname !== "/api/metrics/visit") return undefined;
  if (request.method !== "POST") return new Response(null, {status: 405, headers: noStore});
  if (request.headers.get("Origin") !== url.origin) return new Response(null, {status: 403, headers: noStore});
  if (!env.METRICS) return new Response(null, {status: 503, headers: noStore});
  const cf = (request as Request & {cf?: {country?: string; botManagement?: {verifiedBot?: boolean}}}).cf;
  if (cf?.botManagement?.verifiedBot || request.headers.get("DNT") === "1" || request.headers.get("Sec-GPC") === "1")
    return new Response(null, {status: 204, headers: noStore});
  if (env.METRICS_LIMITER) {
    const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!(await env.METRICS_LIMITER.limit({key})).success) return new Response(null, {status: 429, headers: noStore});
  }
  const cookies = new Map((request.headers.get("Cookie") ?? "").split(";").map(part => {
    const at = part.indexOf("="); return [part.slice(0, at).trim(), part.slice(at + 1)];
  }));
  const candidate = cookies.get(visitorCookie) ?? "";
  const browser = uuid.test(candidate) ? candidate : crypto.randomUUID();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(browser)))].map(n => n.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const country = /^[A-Z]{2}$/.test(cf?.country ?? "") ? cf!.country! : "XX";
  // Fixed half-hour windows deduplicate refreshes and concurrent tabs atomically.
  // The INSERT trigger increments country/day totals only for a newly accepted visit.
  await env.METRICS.batch([
    ...periodKeys(now).map(period => env.METRICS!.prepare(
      "INSERT OR IGNORE INTO metrics_visitors (scope, period, browser_hash) VALUES (?, ?, ?)"
    ).bind(scope, period, hash)),
    env.METRICS.prepare("INSERT OR IGNORE INTO metrics_sessions (scope, browser_hash, window, day, country, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(scope, hash, Math.floor(now / 1800000), dayOf(now), country, now),
  ]);
  const headers = new Headers(noStore);
  const domain = url.hostname === "clickclacks.app" || url.hostname.endsWith(".clickclacks.app") ? "; Domain=clickclacks.app" : "";
  headers.set("Set-Cookie", `${visitorCookie}=${browser}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}${domain}`);
  return new Response(null, {status: 204, headers});
}

export async function injectMetrics(request: Request, response: Response) {
  const url = new URL(request.url);
  if (request.method !== "GET" || !["/", "/index.html", "/landing.html"].includes(url.pathname) ||
      !response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("Content-Length"); headers.delete("ETag"); headers.delete("Content-Encoding");
  return new Response(html.replace(/<\/head>/i, '<script defer src="/api/metrics/beacon.js"></script></head>'),
    {status: response.status, statusText: response.statusText, headers});
}

export async function trafficSummary(db: MetricsDatabase, period: StatsPeriod, now: number) {
  const day = dayOf(now), month = monthOf(now), key = period === "all" ? "all" : `${period}:${period === "day" ? day : month}`;
  const since = period === "all" ? "0000" : period === "day" ? day : `${month}-01`;
  const scopes = ["website", "app"] as const;
  const summaries = await Promise.all(scopes.map(async scope => {
    const [count, countries] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS visitors FROM metrics_visitors WHERE scope = ? AND period = ?").bind(scope, key).first<{visitors: number}>(),
      db.prepare("SELECT country, SUM(visits) AS visits FROM metrics_counts WHERE scope = ? AND day >= ? AND day <= ? GROUP BY country ORDER BY visits DESC, country ASC").bind(scope, since, day).all<{country: string; visits: number}>(),
    ]);
    return {visitors: count?.visitors ?? 0, visits: countries.results.reduce((sum, row) => sum + row.visits, 0), countries: countries.results} satisfies TrafficStats;
  }));
  const chartSince = dayOf(now - 29 * 86400000);
  const [daily, first] = await Promise.all([
    db.prepare("SELECT day, scope, SUM(visits) AS visits FROM metrics_counts WHERE day >= ? AND day <= ? GROUP BY day, scope ORDER BY day").bind(chartSince, day).all<{day: string; scope: "website" | "app"; visits: number}>(),
    db.prepare("SELECT MIN(day) AS day FROM metrics_counts").first<{day: string | null}>(),
  ]);
  const points = Array.from({length: 30}, (_, i) => ({day: dayOf(now - (29 - i) * 86400000), website: 0, app: 0}));
  for (const row of daily.results) {const point = points.find(p => p.day === row.day); if (point) point[row.scope] = row.visits;}
  return {traffic: {website: summaries[0]!, app: summaries[1]!}, daily: points, startedAt: first?.day ? Date.parse(first.day) : null};
}

export async function expireVisitorMarkers(db: MetricsDatabase, now: number) {
  // Keep summaries indefinitely, all-time hashes for deduplication, and recent
  // daily/monthly markers for the available dashboard windows.
  await db.batch([
    db.prepare("DELETE FROM metrics_sessions WHERE created_at < ?").bind(now - 2 * 86400000),
    db.prepare("DELETE FROM metrics_visitors WHERE period LIKE 'day:%' AND period < ?").bind(`day:${dayOf(now - 90 * 86400000)}`),
    db.prepare("DELETE FROM metrics_visitors WHERE period LIKE 'month:%' AND period < ?").bind(`month:${monthOf(now - 730 * 86400000)}`),
  ]);
}
