// SPDX-License-Identifier: MIT
// Coordinator only: real local Convex Auth + local Workers sharing an isolated D1.
import {chromium, expect} from "@playwright/test";
import {ConvexHttpClient} from "convex/browser";
import {makeFunctionReference} from "convex/server";
import {mkdir} from "node:fs/promises";
const statsUrl = process.env.STATS_URL, appUrl = process.env.APP_URL, websiteUrl = process.env.WEBSITE_URL, backend = process.env.TEST_CONVEX_URL;
for (const url of [statsUrl, appUrl, websiteUrl, backend])
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Explicit isolated local stats/app/website/backend URLs are required.");
const artifacts = process.env.STATS_ARTIFACT_DIR ?? ".preview/stats";
await mkdir(artifacts, {recursive: true});
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport: {width: 1280, height: 1000}});
  const page = await context.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  expect((await page.request.get(`${statsUrl}/api/stats`)).status()).toBe(401);
  await page.goto(statsUrl);
  await expect(page.getByRole("heading", {name: "Sign in", exact: true})).toBeVisible();
  const email = `stats-${crypto.randomUUID()}@example.invalid`, password = crypto.randomUUID();
  await page.getByRole("button", {name: "Create an account", exact: true}).click();
  await page.getByLabel("Email", {exact: true}).fill(email); await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Create account", exact: true}).click();
  await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});
  await expect(page.getByText("Website visitors", {exact: true})).toBeVisible({timeout: 15000});
  await page.getByRole("button", {name: "Sign out", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Sign in", exact: true})).toBeVisible();
  await page.getByLabel("Email", {exact: true}).fill(email); await page.getByLabel("Password", {exact: true}).fill("incorrect-password");
  await page.getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.getByRole("alert")).toContainText("Could not sign in");
  await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});

  // Actual entry documents execute the injected beacon; repeat entries stay one visit.
  const app = await context.newPage();
  await app.addInitScript(() => localStorage.setItem("powerroller.preferences.v2", JSON.stringify({version: 2, preferences: {hidden: true, motion: "reduce", theme: "dark"}})));
  for (const url of [appUrl, appUrl, websiteUrl]) {
    const recorded = app.waitForResponse(r => r.url().endsWith("/api/metrics/visit") && r.status() === 204);
    await app.goto(url); await recorded;
  }
  // The website's automatic actors use excluded rooms. Human table lifecycle is seeded
  // through the real public API and read back, without storing display names in stats.
  const client = new ConvexHttpClient(backend);
  const key = crypto.randomUUID(), a = crypto.randomUUID(), b = crypto.randomUUID(), credential = crypto.randomUUID() + crypto.randomUUID();
  const join = makeFunctionReference("diceDemoV2:join"), leave = makeFunctionReference("diceDemoV2:leave"), view = makeFunctionReference("diceDemoV2:view");
  const joined = viewer => ({key, viewer, credential, name: "Test player", style: {color: "#aabbcc", ink: "#112233", pattern: "solid"}, ready: true, uncertainty: 0});
  await client.mutation(join, joined(a)); await client.mutation(join, joined(b));
  expect((await client.query(view, {key})).participants).toHaveLength(2);
  await new Promise(resolve => setTimeout(resolve, 1200));
  await client.mutation(leave, {key, viewer: b, credential});
  expect((await client.query(view, {key})).participants).toHaveLength(1);
  await page.getByRole("button", {name: "All time", exact: true}).click();
  await expect(page.getByRole("button", {name: "Refresh", exact: true})).toBeEnabled({timeout: 15000});
  const readback = page.waitForResponse(r => r.url().includes("/api/stats?period=all") && r.status() === 200);
  await page.getByRole("button", {name: "Refresh", exact: true}).click();
  const totals = await (await readback).json();
  expect(totals.traffic.website.visitors).toBe(1); expect(totals.traffic.website.visits).toBe(1);
  expect(totals.traffic.app.visitors).toBe(1); expect(totals.traffic.app.visits).toBe(1);
  expect(totals.traffic.website.countries[0].country).toMatch(/^[A-Z]{2}$/);
  expect(totals.gameplay).toMatchObject({multiplayerTables: 1, sessionsStarted: 1, sessionsCompleted: 1, playerArrivals: 2, peakPlayers: 2});
  expect(totals.gameplay.multiplayerMs).toBeGreaterThanOrEqual(1000);
  expect(JSON.stringify(totals)).not.toContain(key); expect(JSON.stringify(totals)).not.toContain("Test player");
  await page.reload(); await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible();
  await expect(page.getByText("Website visitors", {exact: true})).toBeVisible();
  await page.screenshot({path: `${artifacts}/desktop.png`, fullPage: true});
  await page.setViewportSize({width: 360, height: 800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `${artifacts}/mobile.png`, fullPage: true});
  expect(errors).toEqual([]);
  await client.mutation(leave, {key, viewer: a, credential});
  console.log("PASS: real password signup/signin, wrong-password refusal, reload persistence, anonymous API refusal, actual Worker beacons with refresh dedup, countries, persisted multiplayer metrics, demo exclusion, desktop/mobile layout.");
} finally {await browser.close();}
