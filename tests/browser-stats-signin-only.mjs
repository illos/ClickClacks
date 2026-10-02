// SPDX-License-Identifier: MIT
// Coordinator only: seed against pre-change auth, then verify the candidate on the
// SAME isolated backend. The private artifact contains fixture credentials/tokens.
import {chromium, expect} from "@playwright/test";
import {ConvexHttpClient} from "convex/browser";
import {makeFunctionReference} from "convex/server";
import {mkdir, readFile, writeFile, chmod} from "node:fs/promises";
import {join} from "node:path";
const statsUrl = process.env.STATS_URL, backend = process.env.TEST_CONVEX_URL;
for (const url of [statsUrl, backend])
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Explicit isolated local stats/backend URLs are required.");
const artifacts = process.env.STATS_ARTIFACT_DIR;
if (!artifacts) throw new Error("Explicit private STATS_ARTIFACT_DIR required.");
await mkdir(artifacts, {recursive: true});
const fixturePath = join(artifacts, "private-account.json");
const browser = await chromium.launch();
const client = new ConvexHttpClient(backend);
const signIn = makeFunctionReference("auth:signIn");
try {
  if (process.env.STATS_AUTH_PHASE === "seed") {
    const email = `stats-${crypto.randomUUID()}@example.invalid`, password = crypto.randomUUID();
    await client.action(signIn, {provider: "password", params: {flow: "signUp", email, password}});
    const context = await browser.newContext(), page = await context.newPage();
    await page.goto(statsUrl);
    await page.getByLabel("Email", {exact: true}).fill(email);
    await page.getByLabel("Password", {exact: true}).fill(password);
    await page.getByRole("button", {name: "Sign in", exact: true}).click();
    await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});
    await expect(page.getByText("Website visitors", {exact: true})).toBeVisible({timeout: 15000});
    await writeFile(fixturePath, JSON.stringify({email, password, state: await context.storageState()}), {mode: 0o600});
    await chmod(fixturePath, 0o600);
    console.log("PASS: isolated existing account/session prepared against pre-change auth.");
  } else {
    const {email, password, state} = JSON.parse(await readFile(fixturePath, "utf8"));
    const context = await browser.newContext({storageState: state}), page = await context.newPage();
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(statsUrl);
    await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});
    await expect(page.getByText("Website visitors", {exact: true})).toBeVisible({timeout: 15000});
    await page.getByRole("button", {name: "Sign out", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Sign in", exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: /Create.*account/i})).toHaveCount(0);
    await expect(client.action(signIn, {provider: "password", params: {
      flow: "signUp", email: `refused-${crypto.randomUUID()}@example.invalid`, password,
    }})).rejects.toThrow("Account registration is closed.");
    // An old page can also attempt signUp for an existing email: never overwrite it.
    await expect(client.action(signIn, {provider: "password", params: {
      flow: "signUp", email, password: "replacement-password",
    }})).rejects.toThrow("Account registration is closed.");
    await page.getByLabel("Email", {exact: true}).fill(email);
    await page.getByLabel("Password", {exact: true}).fill("incorrect-password");
    await page.getByRole("button", {name: "Sign in", exact: true}).click();
    await expect(page.getByRole("alert")).toContainText("Could not sign in");
    await page.getByLabel("Password", {exact: true}).fill(password);
    await page.getByRole("button", {name: "Sign in", exact: true}).click();
    await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});
    await expect(page.getByText("Website visitors", {exact: true})).toBeVisible({timeout: 15000});
    await page.reload();
    await expect(page.getByRole("button", {name: "Sign out", exact: true})).toBeVisible({timeout: 30000});
    expect(errors).toEqual([]);
    console.log("PASS: prior session retained, signup UI absent, direct new/existing-email signup refused, wrong password refused, original password signin and reload retained.");
  }
} finally {await browser.close();}
