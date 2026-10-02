// SPDX-License-Identifier: MIT
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const url = process.env.CLICKCLACKS_TEST_URL ?? "http://127.0.0.1:9695";
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("This check requires an isolated local Worker.");
const readToken =
  process.env.BUG_REPORT_READ_TOKEN ??
  "local-reader-token-at-least-32-characters";
const artifacts =
  process.env.SUPPORT_TEST_ARTIFACT_DIR ?? ".preview/bug-reports";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [1440, 900],
    [430, 932],
    [320, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    // This is an intake/popup check, not a gameplay run against the shared backend.
    await page.routeWebSocket(/convex\.cloud/, (socket) => socket.close());
    await page.route("**/*.convex.cloud/**", (route) => route.abort());
    await page.addInitScript(() =>
      localStorage.setItem(
        "powerroller.preferences.v2",
        JSON.stringify({
          version: 2,
          preferences: { hidden: true, motion: "reduce", theme: "dark" },
        }),
      ),
    );
    await page.goto(url);
    const trigger = page
      .getByRole("button", { name: "Report a bug", exact: true })
      .first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Report a bug" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("What went wrong?")).toBeFocused();
    await expect(
      dialog.getByRole("button", { name: "Send report" }),
    ).toBeDisabled();
    const description = `Popup ${width} ${crypto.randomUUID()}`;
    await dialog.getByLabel("What went wrong?").fill(description);
    if (width === 1440)
      await dialog.getByLabel("Contact info").fill("reporter@example.invalid");
    if (width === 320)
      await dialog.getByLabel("Include app and browser diagnostics").uncheck();
    await expect(
      dialog.getByRole("button", { name: "Send report" }),
    ).toBeEnabled();
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `${artifacts}/popup-${width}.png` });
    let savedId;
    if (width === 1440) {
      let first = true;
      await page.route("**/api/bug-reports", async (route) => {
        if (first) {
          first = false;
          const response = await route.fetch();
          expect(response.status()).toBe(201);
          savedId = (await response.json()).id;
          await route.abort("failed");
        } else await route.continue();
      });
      await dialog.getByRole("button", { name: "Send report" }).click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.getByLabel("What went wrong?")).toHaveValue(
        description,
      );
      await expect(dialog.getByLabel("What went wrong?")).toBeDisabled();
      const download = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Download report" }).click();
      expect((await download).suggestedFilename()).toContain(savedId);
      await dialog.getByRole("button", { name: "Retry", exact: true }).click();
    } else await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(
      dialog.getByText("Thanks—your report was saved."),
    ).toBeVisible();
    const id = await dialog.locator("code").textContent();
    if (savedId) expect(id).toBe(savedId);
    const response = await page.request.get(
      `${url}/api/support/reports/${id}`,
      { headers: { Authorization: `Bearer ${readToken}` } },
    );
    expect(response.status()).toBe(200);
    const row = await response.json();
    expect(row.description).toBe(description);
    expect(row.contact).toBe(width === 1440 ? "reporter@example.invalid" : "");
    if (width === 320) {
      expect(row.diagnostics).toBeNull();
      expect(row.country).toBeNull();
    } else {
      expect(row.diagnostics.viewport.width).toBe(width);
      expect(row.diagnostics.context.surface).toBe("roller");
      expect(JSON.stringify(row.diagnostics)).not.toMatch(
        /credential|roomKey|viewer/,
      );
    }
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByLabel("What went wrong?").fill("Cancelled report");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    const list = await page.request.get(`${url}/api/support/reports`, {
      headers: { Authorization: `Bearer ${readToken}` },
    });
    const rows = (await list.json()).reports;
    expect(rows.filter((row) => row.description === description)).toHaveLength(
      1,
    );
    expect(rows.some((row) => row.description === "Cancelled report")).toBe(
      false,
    );
    await page.close();
  }
  console.log(
    "PASS: desktop/mobile popup, focus/escape, optional contact, opt-out, persisted readback, ambiguous-response retry and download",
  );
} finally {
  await browser.close();
}
