// SPDX-License-Identifier: MIT
import {
  parseSubmission,
  reportBodyLimit,
  reportStatuses,
} from "../shared/bug-report";
import { canonicalPage } from './canonical';
import {metricsRequest, injectMetrics, expireVisitorMarkers, type MetricsEnv} from './metrics';
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface SupportEnv extends MetricsEnv {
  BUG_REPORTS: { prepare(sql: string): Statement };
  ASSETS: { fetch(request: Request): Promise<Response> };
  BUG_REPORT_READ_TOKEN?: string;
  BUG_REPORT_WRITE_TOKEN?: string;
  BUG_REPORT_RATE_SALT?: string;
  BUG_REPORT_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
type ReportRow = {
  id: string;
  content_hash: string;
  description: string;
  contact: string;
  diagnostics: string | null;
  created_at: number;
  private_expires_at: number;
  status: string;
  revision: number;
  owner: string | null;
  fix_commit: string | null;
  notes: string;
  country: string | null;
  region: string | null;
};
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function matchesToken(request: Request, token: string | undefined) {
  if (!token || token.length < 32) return false;
  const supplied = request.headers.get("authorization");
  if (!supplied?.startsWith("Bearer ")) return false;
  const [a, b] = await Promise.all([digest(supplied.slice(7)), digest(token)]);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Send a JSON report.");
  if (Number(request.headers.get("content-length") ?? 0) > reportBodyLimit)
    throw new Error("Report is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing report.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > reportBodyLimit) {
      await reader.cancel();
      throw new Error("Report is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Invalid JSON report.");
  }
}
function privateView(row: ReportRow, now = Date.now()) {
  const expired = row.private_expires_at <= now;
  const { content_hash: _, ...report } = row;
  return {
    ...report,
    contact: expired ? "" : row.contact,
    country: expired ? null : row.country,
    region: expired ? null : row.region,
    diagnostics:
      expired || !row.diagnostics ? null : JSON.parse(row.diagnostics),
  };
}
async function handle(request: Request, env: SupportEnv): Promise<Response> {
  const redirect = canonicalPage(request);
  if (redirect) return redirect;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!env.BUG_REPORTS)
    return json(
      {
        error:
          "Reporting is temporarily unavailable. Please retry or download your report.",
      },
      503,
    );
  if (url.pathname === "/api/bug-reports" && request.method === "POST") {
    // Staff headless callers can use the write token; browsers must submit from this origin.
    const staff = await matchesToken(request, env.BUG_REPORT_WRITE_TOKEN);
    if (!staff && request.headers.get("origin") !== url.origin)
      return json({ error: "Report origin is not allowed." }, 403);
    if (!staff) {
      if (!env.BUG_REPORT_LIMITER || !env.BUG_REPORT_RATE_SALT)
        return json({ error: "Reporting is temporarily unavailable." }, 503);
      const key = await digest(
        `${env.BUG_REPORT_RATE_SALT}:${Math.floor(Date.now() / 86400000)}:${request.headers.get("cf-connecting-ip") ?? "local"}`,
      );
      if (!(await env.BUG_REPORT_LIMITER.limit({ key })).success)
        return json(
          { error: "Too many reports. Please try again in a minute." },
          429,
        );
    }
    let report;
    try {
      report = parseSubmission(await body(request));
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Invalid report." },
        400,
      );
    }
    if (report.website)
      return json({ error: "Report could not be accepted." }, 400);
    const hash = await digest(
      JSON.stringify({
        description: report.description,
        contact: report.contact,
        diagnostics: report.diagnostics,
      }),
    );
    const now = Date.now(),
      cf = (request as Request & { cf?: { country?: string; region?: string } })
        .cf;
    const country =
      report.diagnostics && /^[A-Z]{2}$/.test(cf?.country ?? "")
        ? cf!.country
        : null;
    const region =
      report.diagnostics && cf?.region ? cf.region.slice(0, 80) : null;
    await env.BUG_REPORTS.prepare(
      "INSERT INTO bug_reports (id, content_hash, description, contact, diagnostics, country, region, created_at, private_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
    )
      .bind(
        report.id,
        hash,
        report.description,
        report.contact,
        report.diagnostics ? JSON.stringify(report.diagnostics) : null,
        country,
        region,
        now,
        now + 30 * 86400000,
      )
      .run();
    // Read the persisted row: an accepted response is never just an optimistic mutation result.
    const saved = await env.BUG_REPORTS.prepare(
      "SELECT id, content_hash, created_at FROM bug_reports WHERE id = ?",
    )
      .bind(report.id)
      .first<{ id: string; content_hash: string; created_at: number }>();
    if (!saved)
      return json({ error: "Report was not saved. Please retry." }, 503);
    if (saved.content_hash !== hash)
      return json(
        { error: "This report ID was already used with different content." },
        409,
      );
    return json(
      { id: saved.id, createdAt: saved.created_at, saved: true },
      201,
    );
  }
  if (url.pathname.startsWith("/api/support/reports")) {
    const writer = await matchesToken(request, env.BUG_REPORT_WRITE_TOKEN);
    if (!writer && !(await matchesToken(request, env.BUG_REPORT_READ_TOKEN)))
      return json({ error: "Support access required." }, 401);
    if (url.pathname === "/api/support/reports" && request.method === "GET") {
      const status = url.searchParams.get("status") ?? "new";
      if (!(reportStatuses as readonly string[]).includes(status))
        return json({ error: "Invalid status." }, 400);
      const rows = await env.BUG_REPORTS.prepare(
        "SELECT id, description, created_at, status, revision, owner, fix_commit FROM bug_reports WHERE status = ? ORDER BY created_at DESC LIMIT 50",
      )
        .bind(status)
        .all();
      return json({ reports: rows.results });
    }
    const id = /^\/api\/support\/reports\/([a-f\d-]{36})$/i.exec(
      url.pathname,
    )?.[1];
    if (!id) return json({ error: "Not found." }, 404);
    if (request.method === "GET") {
      const row = await env.BUG_REPORTS.prepare(
        "SELECT * FROM bug_reports WHERE id = ?",
      )
        .bind(id)
        .first<ReportRow>();
      return row ? json(privateView(row)) : json({ error: "Not found." }, 404);
    }
    if (request.method === "PATCH") {
      if (!writer) return json({ error: "Triage access required." }, 403);
      let update;
      try {
        update = await body(request);
      } catch {
        return json({ error: "Invalid update." }, 400);
      }
      if (
        !update ||
        typeof update !== "object" ||
        !(reportStatuses as readonly unknown[]).includes(update.status) ||
        !Number.isSafeInteger(update.revision) ||
        typeof update.owner !== "string" ||
        update.owner.length > 100 ||
        typeof update.notes !== "string" ||
        update.notes.length > 4000 ||
        typeof update.fixCommit !== "string" ||
        (update.fixCommit && !/^[a-f\d]{7,40}$/i.test(update.fixCommit))
      )
        return json({ error: "Invalid triage update." }, 400);
      const result = await env.BUG_REPORTS.prepare(
        "UPDATE bug_reports SET status = ?, owner = ?, notes = ?, fix_commit = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
      )
        .bind(
          update.status,
          update.owner || null,
          update.notes,
          update.fixCommit || null,
          id,
          update.revision,
        )
        .run();
      if (!result.meta.changes)
        return json(
          {
            error:
              "Report changed or does not exist. Read it again before updating.",
          },
          409,
        );
      const row = await env.BUG_REPORTS.prepare(
        "SELECT * FROM bug_reports WHERE id = ?",
      )
        .bind(id)
        .first<ReportRow>();
      return json(row ? privateView(row) : null);
    }
    return json({ error: "Method not allowed." }, 405);
  }
  return json({ error: "Not found." }, 404);
}
export default {
  async fetch(request: Request, env: SupportEnv) {
    try {
      const metrics = await metricsRequest(request, env, 'app');
      return metrics ?? await injectMetrics(request, await handle(request, env));
    } catch {
      return json(
        {
          error:
            "Reporting is temporarily unavailable. Please retry or download your report.",
        },
        503,
      );
    }
  },
  async scheduled(_event: unknown, env: SupportEnv) {
    if (env.METRICS) await expireVisitorMarkers(env.METRICS, Date.now());
    await env.BUG_REPORTS.prepare(
      "UPDATE bug_reports SET contact = '', diagnostics = NULL, country = NULL, region = NULL WHERE private_expires_at <= ? AND (diagnostics IS NOT NULL OR contact != '' OR country IS NOT NULL OR region IS NOT NULL)",
    )
      .bind(Date.now())
      .run();
  },
};
