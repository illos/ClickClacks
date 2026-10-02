// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { type SupportEnv } from "../worker/index";
import { cleanBugContext, parseSubmission } from "../shared/bug-report";

const id = "2a03b414-0339-40b6-8c1c-9a9479945791";
const readerToken = "reader-only-token-with-at-least-32-characters";
const writerToken = "writer-only-token-with-at-least-32-characters";
let db: DatabaseSync, env: SupportEnv;
function request(
  path = "/api/bug-reports",
  value: unknown = { id, description: "Dice did not appear", contact: "" },
  method = "POST",
  token?: string,
  origin = "https://app.clickclacks.app",
) {
  return new Request(`https://app.clickclacks.app${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(value) } : {}),
  });
}
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../worker/migrations/0001_bug_reports.sql", import.meta.url),
      "utf8",
    ),
  );
  env = {
    BUG_REPORTS: {
      prepare(sql) {
        let values: unknown[] = [];
        return {
          bind(...next) {
            values = next;
            return this;
          },
          async first<T>() {
            return (
              (db
                .prepare(sql)
                .get(...(values as (string | number | null)[])) as T) ?? null
            );
          },
          async all<T>() {
            return {
              results: db
                .prepare(sql)
                .all(...(values as (string | number | null)[])) as T[],
            };
          },
          async run() {
            return {
              meta: {
                changes: Number(
                  db.prepare(sql).run(...(values as (string | number | null)[]))
                    .changes,
                ),
              },
            };
          },
        };
      },
    },
    ASSETS: { fetch: async () => new Response("asset") },
    BUG_REPORT_READ_TOKEN: readerToken,
    BUG_REPORT_WRITE_TOKEN: writerToken,
    BUG_REPORT_RATE_SALT: "local-test-salt",
    BUG_REPORT_LIMITER: { limit: async () => ({ success: true }) },
  };
});
afterEach(() => db.close());
describe("private bug reports", () => {
  it("persists the reviewed context, excludes access fields and keeps private reads authenticated", async () => {
    const response = await worker.fetch(
      request(undefined, {
        id,
        description: "Dice did not appear",
        contact: "test@example.invalid",
        credential: "not-for-storage",
        room: "ABCDEFGH",
        diagnostics: {
          path: "/?room=ABCDEFGH",
          context: {
            connected: false,
            pending: true,
            credential: "not-for-storage",
            profile: { name: "Private name" },
            roomKey: "ABCDEFGH",
            selectedDice: 6,
            recentRolls: [{ faces: [2, 6], name: "Private name" }],
          },
        },
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect((await response.json()).id).toBe(id);
    const row = db.prepare("SELECT * FROM bug_reports WHERE id = ?").get(id)!;
    expect(row.description).toBe("Dice did not appear");
    expect(row.contact).toBe("test@example.invalid");
    expect(String(row.diagnostics)).not.toMatch(
      /not-for-storage|Private name|ABCDEFGH/,
    );
    const read = await worker.fetch(
      request(`/api/support/reports/${id}`, null, "GET", readerToken),
      env,
    );
    expect((await read.json()).diagnostics.context).toMatchObject({
      connected: false,
      pending: true,
      selectedDice: 6,
    });
    expect(
      (
        await worker.fetch(
          request(`/api/support/reports/${id}`, null, "GET"),
          env,
        )
      ).status,
    ).toBe(401);
    const list = await worker.fetch(
      request("/api/support/reports", null, "GET", readerToken),
      env,
    );
    expect(JSON.stringify(await list.json())).not.toContain(
      "test@example.invalid",
    );
  });
  it("accepts description-only reports and applies diagnostics opt-out to geographic enrichment", async () => {
    const req = request(undefined, {
      id,
      description: "  Broken  ",
      diagnostics: null,
    });
    Object.assign(req, { cf: { country: "GB", region: "England" } });
    expect((await worker.fetch(req, env)).status).toBe(201);
    const row = db.prepare("SELECT * FROM bug_reports").get()!;
    expect(row).toMatchObject({
      description: "Broken",
      contact: "",
      diagnostics: null,
      country: null,
      region: null,
    });
  });
  it("reconciles a retry after an ambiguous response and refuses reuse with different content", async () => {
    await worker.fetch(request(), env);
    expect((await worker.fetch(request(), env)).status).toBe(201);
    expect(
      db.prepare("SELECT count(*) AS count FROM bug_reports").get()!.count,
    ).toBe(1);
    expect(
      (
        await worker.fetch(
          request(undefined, { id, description: "Different issue" }),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      db.prepare("SELECT description FROM bug_reports").get()!.description,
    ).toBe("Dice did not appear");
  });
  it("rejects cross-origin, spam, invalid and oversized reports without creating rows", async () => {
    expect(
      (
        await worker.fetch(
          request(
            undefined,
            undefined,
            "POST",
            undefined,
            "https://elsewhere.invalid",
          ),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (await worker.fetch(request(undefined, { id, description: " " }), env))
        .status,
    ).toBe(400);
    expect(
      (
        await worker.fetch(
          request(undefined, {
            id,
            description: "Broken",
            unknown: "x".repeat(33000),
          }),
          env,
        )
      ).status,
    ).toBe(400);
    env.BUG_REPORT_LIMITER = { limit: async () => ({ success: false }) };
    expect((await worker.fetch(request(), env)).status).toBe(429);
    expect(
      db.prepare("SELECT count(*) AS count FROM bug_reports").get()!.count,
    ).toBe(0);
  });
  it("prevents a reader writing and a stale writer overwriting another thread’s triage", async () => {
    await worker.fetch(request(), env);
    const patch = {
      status: "in-progress",
      revision: 0,
      owner: "thread-one",
      notes: "Investigating",
      fixCommit: "",
    };
    expect(
      (
        await worker.fetch(
          request(`/api/support/reports/${id}`, patch, "PATCH", readerToken),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          request(`/api/support/reports/${id}`, patch, "PATCH", writerToken),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await worker.fetch(
          request(
            `/api/support/reports/${id}`,
            { ...patch, owner: "thread-two" },
            "PATCH",
            writerToken,
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      db.prepare("SELECT owner, revision FROM bug_reports").get(),
    ).toMatchObject({ owner: "thread-one", revision: 1 });
  });
  it("expires private data on reads and scheduled cleanup while retaining the report", async () => {
    await worker.fetch(
      request(undefined, {
        id,
        description: "Broken",
        contact: "contact",
        diagnostics: { context: { connected: false } },
      }),
      env,
    );
    db.prepare("UPDATE bug_reports SET private_expires_at = 1").run();
    const read = await worker.fetch(
      request(`/api/support/reports/${id}`, null, "GET", readerToken),
      env,
    );
    expect(await read.json()).toMatchObject({
      description: "Broken",
      contact: "",
      diagnostics: null,
    });
    await worker.scheduled(null, env);
    expect(
      db
        .prepare("SELECT description, contact, diagnostics FROM bug_reports")
        .get(),
    ).toMatchObject({ description: "Broken", contact: "", diagnostics: null });
  });
  it("fails honestly on persistence failure and never turns API misses into SPA HTML", async () => {
    env.BUG_REPORTS = {
      prepare() {
        throw new Error("private database credentials");
      },
    };
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private database credentials",
    );
    expect(
      (
        await worker.fetch(
          new Request("https://app.clickclacks.app/api/missing"),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      await (
        await worker.fetch(new Request("https://app.clickclacks.app/"), env)
      ).text(),
    ).toBe("asset");
  });
  it("redacts supplied errors and enforces description/contact limits", () => {
    const context = cleanBugContext({
      error:
        'credential: "secret", URL https://app.clickclacks.app/?room=ABCDEFGH id 2a03b414-0339-40b6-8c1c-9a9479945791',
    });
    expect(context.error).not.toMatch(/secret|ABCDEFGH|2a03b414/);
    expect(() =>
      parseSubmission({ id, description: "x".repeat(4001) }),
    ).toThrow();
    expect(() =>
      parseSubmission({ id, description: "Broken", contact: "x".repeat(301) }),
    ).toThrow();
  });
});
