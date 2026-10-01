// SPDX-License-Identifier: MIT
import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Session, AcceptedRoll } from "../src/client";
const backend =
  process.env.POWERROLLER_TEST_BACKEND ??
  "https://nautical-partridge-636.convex.cloud";
const url = "http://127.0.0.1:9591/powerroller/";
const appearance = {
  color: "#42a5ab",
  ink: "#ffffff",
  pattern: "solid",
  font: "serif",
};
async function namedContext(
  browser: Browser,
  name = "Browser Tester",
  prefs: Record<string, unknown> = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(
    ({ name, appearance, prefs }) => {
      try {
        if (!localStorage.getItem("powerroller.preferences.v1"))
          localStorage.setItem(
            "powerroller.preferences.v1",
            JSON.stringify({
              version: 1,
              preferences: {
                name,
                appearance,
                motion: "full",
                hidden: false,
                highContrast: false,
                announcements: "all",
                ...prefs,
              },
            }),
          );
      } catch {}
    },
    { name, appearance, prefs },
  );
  return context;
}
async function ready(page: Page, href = url) {
  await page.goto(href);
  await expect(
    page.getByRole("button", { name: "Roll", exact: true }),
  ).toBeEnabled();
}
async function session(page: Page): Promise<Session> {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("powerroller.session.v1")!),
  );
}
async function snapshot(page: Page) {
  const s = await session(page),
    client = new ConvexHttpClient(backend);
  try {
    return (await client.query(makeFunctionReference<"query">("rooms:view"), {
      roomId: s.roomId,
      credential: s.credential,
    })) as { cursor: number; latest: AcceptedRoll[] };
  } catch {
    throw new Error("Persisted room readback failed.");
  }
}
async function configure(page: Page, mode: string, dice?: string) {
  await page
    .getByRole("button", { name: "Customize dice", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Roll type", exact: true })
    .selectOption(mode);
  if (dice) await page.getByLabel("Dice", { exact: true }).fill(dice);
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
const entries = (page: Page) => page.locator(".roll-log-entry");
// Avoid ever printing private credentials in diagnostics or assertion operands.
const awaitSessionMarker = new WeakMap<Page, string>();
async function mark(page: Page) {
  awaitSessionMarker.set(page, (await session(page)).memberId);
}

test("two isolated clients receive one persisted power result and own clear preserves peer dice", async ({
  browser,
}, info) => {
  const a = await namedContext(browser, "First Player"),
    b = await namedContext(browser, "Second Player");
  try {
    const one = await a.newPage(),
      two = await b.newPage();
    await ready(one);
    await mark(one);
    await ready(two, one.url());
    await mark(two);
    await expect(one.locator(".stage-label")).toContainText("2 / 8");
    await expect(two.locator(".stage-label")).toContainText("2 / 8");
    await one.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(one)).toHaveCount(1);
    await expect(entries(two)).toHaveCount(1);
    const saved = (await snapshot(one)).latest[0]!;
    expect(saved.source).toBe("generated");
    expect(saved.result.dice.map((d) => d.sides)).toEqual([10, 10]);
    for (const page of [one, two]) {
      await expect(page.locator(".roll-total").last()).toHaveText(
        String(saved.result.total),
      );
      await expect(page.locator(".tier").last()).toHaveText(
        `Tier ${saved.result.tier}`,
      );
    }
    await two.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(one)).toHaveCount(2);
    await one.getByRole("button", { name: "Clear my dice" }).click();
    await expect
      .poll(async () => (await snapshot(one)).latest.map((r) => r.memberId))
      .toEqual([awaitSessionMarker.get(two)]);
    await one.screenshot({ path: info.outputPath("desktop-two-clients.png") });
  } finally {
    await a.close();
    await b.close();
  }
});

test("all stock launch dice and percentiles animate and show authoritative numeric results", async ({
  browser,
}, info) => {
  const context = await namedContext(browser);
  try {
    const page = await context.newPage();
    await ready(page);
    await mark(page);
    await expect(page.locator(".canvas-host canvas")).toBeVisible();
    let count = 0;
    for (const sides of [3, 4, 6, 10]) {
      await configure(page, "sum", `1d${sides}`);
      await page.getByRole("button", { name: "Roll", exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: info.outputPath(`animated-d${sides}.png`),
      });
      await expect(entries(page)).toHaveCount(++count);
      const record = (await snapshot(page)).latest[0]!;
      expect(record.result.dice[0]!.sides).toBe(sides);
      expect(record.result.dice[0]!.value).toBeGreaterThanOrEqual(1);
      expect(record.result.dice[0]!.value).toBeLessThanOrEqual(sides);
      await expect(entries(page).last().locator(".roll-total")).toHaveText(
        String(record.result.dice[0]!.value),
      );
    }
    await configure(page, "percentile");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath("animated-percentile.png") });
    await expect(entries(page)).toHaveCount(++count);
    const record = (await snapshot(page)).latest[0]!,
      [tens, ones] = record.result.dice;
    const expected = (tens!.value % 10) * 10 + (ones!.value % 10) || 100;
    expect(record.result.total).toBe(expected);
    await expect(entries(page).last().locator(".roll-total")).toHaveText(
      String(expected),
    );
    await entries(page)
      .last()
      .getByText("Percentile details", { exact: true })
      .click();
    await expect(entries(page).last()).toContainText("tens");
    await expect(entries(page).last()).toContainText("ones");
  } finally {
    await context.close();
  }
});

test("local motion/text/contrast preferences, profile and deduplicated history survive reload", async ({
  browser,
}) => {
  const context = await namedContext(browser, "Remember Me");
  try {
    const page = await context.newPage();
    await ready(page);
    await page
      .getByRole("button", { name: "Customize dice", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Motion", exact: true })
      .selectOption("reduce");
    await page.getByLabel("Hide 3D dice", { exact: true }).check();
    await page.getByLabel("High contrast", { exact: true }).check();
    await page
      .getByRole("combobox", { name: "Numbers", exact: true })
      .selectOption("gothic");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".canvas-host canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(page)).toHaveCount(1);
    const table = new URL(page.url()).searchParams.get("room");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Roll", exact: true }),
    ).toBeEnabled();
    await expect(entries(page)).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get("room")).toBe(table);
    await expect(page.locator(".canvas-host canvas")).toHaveCount(0);
    await expect(page.locator("main.powerroller")).toHaveClass(/high-contrast/);
    await page
      .getByRole("button", { name: "Customize dice", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Motion", exact: true }),
    ).toHaveValue("reduce");
    await expect(
      page.getByLabel("Hide 3D dice", { exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("combobox", { name: "Numbers", exact: true }),
    ).toHaveValue("gothic");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open social menu" }).click();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Remember Me",
    );
  } finally {
    await context.close();
  }
});

test("keyboard menus restore trigger focus; enlarged and narrow views retain reachable controls", async ({
  browser,
}, info) => {
  const context = await namedContext(browser);
  try {
    const page = await context.newPage();
    await ready(page);
    const customize = page.getByRole("button", {
      name: "Customize dice",
      exact: true,
    });
    await customize.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Dice & preferences" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(customize).toBeFocused();
    const social = page.getByRole("button", { name: "Open social menu" });
    await social.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Close social menu" }).click();
    await expect(social).toBeFocused();
    // Browser zoom reflow is represented by shrinking CSS viewport to 1280/4=320px.
    // Text enlargement separately checks 200% of the inherited root font size.
    for (const [width, height, textScale, label] of [
      [640, 400, 2, "200-percent-text"],
      [320, 200, 1, "400-percent-reflow"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Roll", exact: true }),
      ).toBeEnabled();
      await page.evaluate((scale) => {
        const sizes = Array.from(document.querySelectorAll("main,main *"))
          .filter((node): node is HTMLElement => node instanceof HTMLElement)
          .map((node) => ({
            node,
            size: parseFloat(getComputedStyle(node).fontSize),
          }));
        sizes.forEach(
          ({ node, size }) => (node.style.fontSize = `${size * scale}px`),
        );
      }, textScale);
      await expect(
        page.getByRole("button", { name: "Roll", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        .toBe(true);
      await customize.click();
      const dialog = page.getByRole("dialog", { name: "Dice & preferences" });
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: "Done", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "Done", exact: true }),
      ).toBeInViewport();
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
      const rollButton = page.getByRole("button", {
        name: "Roll",
        exact: true,
      });
      await rollButton.scrollIntoViewIfNeeded();
      await expect(rollButton).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: info.outputPath(`${label}.png`),
        fullPage: true,
      });
    }
    await page.emulateMedia({ forcedColors: "active" });
    await customize.click();
    await expect(
      page.getByRole("dialog", { name: "Dice & preferences" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(customize).toBeFocused();
  } finally {
    await context.close();
  }
});

test("blocked persistent storage and unavailable WebGL still permit server-generated rolls", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      Storage.prototype[method] = () => {
        throw new DOMException("Storage disabled", "SecurityError");
      };
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  try {
    const page = await context.newPage();
    await ready(page);
    await expect(page.locator(".canvas-host canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).last().locator(".roll-total")).toHaveText(
      /^\d+$/,
    );
    await page
      .getByRole("button", { name: "Customize dice", exact: true })
      .click();
    await page.getByLabel("Hide 3D dice", { exact: true }).check();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(page)).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test("concurrent and repeated identical result announcements each create a separate DOM update", async ({
  browser,
}) => {
  const a = await namedContext(browser, "Same Name", { hidden: true }),
    b = await namedContext(browser, "Same Name", { hidden: true });
  try {
    const one = await a.newPage(),
      two = await b.newPage();
    await ready(one);
    await ready(two, one.url());
    expect(
      await one.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("/src/three/")),
      ),
    ).toBe(false);
    await configure(one, "sum", "1d2");
    await configure(two, "sum", "1d2");
    await one.evaluate(() => {
      const output: string[] = [];
      (window as unknown as { announcements: string[] }).announcements = output;
      const status = document.querySelector("[role=status]")!;
      new MutationObserver(() => {
        const text = status.textContent?.trim();
        if (text) output.push(text);
      }).observe(status, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    await Promise.all([
      one.getByRole("button", { name: "Roll", exact: true }).click(),
      two.getByRole("button", { name: "Roll", exact: true }).click(),
    ]);
    await one.waitForTimeout(400);
    await one.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(one)).toHaveCount(3);
    await expect(entries(two)).toHaveCount(3);
    await expect
      .poll(() =>
        one.evaluate(
          () =>
            (window as unknown as { announcements: string[] }).announcements
              .length,
        ),
      )
      .toBe(3);
    const spoken = await one.evaluate(
      () => (window as unknown as { announcements: string[] }).announcements,
    );
    expect(new Set(spoken).size).toBeLessThanOrEqual(2);
    expect(
      spoken.every((text) => text.startsWith("Same Name rolled: Total")),
    ).toBe(true);
    // DOM delivery cannot establish actual VoiceOver/NVDA spoken output.
  } finally {
    await a.close();
    await b.close();
  }
});

test("invalid request can be corrected and opener-copied tab receives a separate live identity", async ({
  browser,
}) => {
  const context = await namedContext(browser, "Tab Tester", { hidden: true });
  try {
    const page = await context.newPage();
    await ready(page);
    await configure(page, "sum", "1d1");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("sides");
    await configure(page, "sum", "1d6");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(page)).toHaveCount(1);
    expect((await snapshot(page)).latest[0]!.result.dice[0]!.sides).toBe(6);
    const popupPromise = page.waitForEvent("popup");
    await page.evaluate((href) => window.open(href, "_blank"), page.url());
    const popup = await popupPromise;
    await expect(
      popup.getByRole("button", { name: "Roll", exact: true }),
    ).toBeEnabled();
    const parentSession = await session(page),
      childSession = await session(popup);
    expect(childSession.roomId).toBe(parentSession.roomId);
    expect(childSession.memberId === parentSession.memberId).toBe(false);
    await expect(page.locator(".stage-label")).toContainText("2 / 8");
  } finally {
    await context.close();
  }
});

test("one result announcer remains inside the active modal during a roll", async ({
  browser,
}) => {
  const context = await namedContext(browser, "Modal Tester", { hidden: true });
  try {
    const page = await context.newPage();
    await ready(page);
    await configure(page, "sum", "1d2");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await page.getByRole("button", { name: "Open social menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Your table" });
    await expect(dialog.getByRole("status")).toContainText(
      "Modal Tester rolled:",
    );
    await expect(page.locator("[role=status]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open social menu" }),
    ).toBeFocused();
  } finally {
    await context.close();
  }
});

test("fresh unseeded browser defaults create a working room with sanitized appearance", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await ready(page);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("powerroller.preferences.v1")!)
            .preferences.appearance,
      ),
    ).not.toHaveProperty("id");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(page)).toHaveCount(1);
    const persisted = (await snapshot(page)).latest[0]!;
    expect(Object.keys(persisted.appearance).sort()).toEqual([
      "color",
      "font",
      "ink",
      "pattern",
    ]);
    expect(persisted.source).toBe("generated");
  } finally {
    await context.close();
  }
});

async function visibleMeshRegions(page: Page) {
  const png = await page.locator(".canvas-host canvas").screenshot();
  return page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { width, height } = canvas,
      pixels = ctx.getImageData(0, 0, width, height).data,
      visited = new Uint8Array(width * height),
      regions: {
        size: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[] = [];
    // One-pixel dilation bridges rasterized facet seams without merging separated dice.
    const solid = (index: number) => {
      const x = index % width,
        y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height)
            continue;
          const near = (y + dy) * width + x + dx;
          if (pixels[near * 4 + 1]! > 40 && pixels[near * 4 + 2]! > 40)
            return true;
        }
      return false;
    };
    for (let index = 0; index < visited.length; index++) {
      if (visited[index] || !solid(index)) continue;
      const stack = [index];
      visited[index] = 1;
      let size = 0,
        left = width,
        right = 0,
        top = height,
        bottom = 0;
      while (stack.length) {
        const current = stack.pop()!,
          x = current % width,
          y = Math.floor(current / width);
        size++;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        for (const next of [
          x > 0 ? current - 1 : -1,
          x < width - 1 ? current + 1 : -1,
          y > 0 ? current - width : -1,
          y < height - 1 ? current + width : -1,
        ])
          if (next >= 0 && !visited[next] && solid(next)) {
            visited[next] = 1;
            stack.push(next);
          }
      }
      if (size > 50) regions.push({ size, left, right, top, bottom });
    }
    let brightness = 0;
    for (let i = 1; i < pixels.length; i += 4)
      brightness += Math.max(0, pixels[i]! - 26);
    return { width, height, regions, brightness };
  }, Array.from(png));
}

test("two mixed32 pools fit without overlap; five-second hold fades graphics while logs persist", async ({
  browser,
}, info) => {
  const a = await namedContext(browser, "Mixed One"),
    b = await namedContext(browser, "Mixed Two");
  try {
    const one = await a.newPage(),
      two = await b.newPage();
    await ready(one);
    await ready(two, one.url());
    for (const page of [one, two])
      await configure(page, "sum", "8d3 + 8d4 + 8d6 + 8d10");
    await one.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(one)).toHaveCount(1);
    await two.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(entries(one)).toHaveCount(2);
    await one.waitForTimeout(150);
    const bounds = await visibleMeshRegions(one);
    expect(bounds.regions.length).toBe(64);
    // Composited canvas captures also contain clipped UI/border pixels; bounds are
    // reviewed in the saved screenshot rather than treating those pixels as dice.
    await one.screenshot({ path: info.outputPath("two-mixed32-settled.png") });
    const state = await snapshot(one);
    expect(state.latest).toHaveLength(2);
    expect(state.latest.every((r) => r.result.dice.length === 32)).toBe(true);
    const latestReveal = Math.max(...state.latest.map((r) => r.revealAt));
    await one.waitForTimeout(Math.max(0, latestReveal + 4800 - Date.now()));
    const held = await visibleMeshRegions(one);
    expect(held.brightness).toBeGreaterThan(bounds.brightness * 0.35);
    await one.waitForTimeout(Math.max(0, latestReveal + 5350 - Date.now()));
    const fading = await visibleMeshRegions(one);
    expect(fading.brightness).toBeLessThan(held.brightness * 0.8);
    expect(fading.brightness).toBeGreaterThan(held.brightness * 0.1);
    await one.waitForTimeout(Math.max(0, latestReveal + 5700 - Date.now()));
    await expect
      .poll(async () => (await visibleMeshRegions(one)).brightness, {
        timeout: 5000,
      })
      .toBeLessThan(held.brightness * 0.05);
    await expect(entries(one)).toHaveCount(2);
    await expect(entries(two)).toHaveCount(2);
    expect((await snapshot(one)).latest).toHaveLength(2);
    await one.screenshot({
      path: info.outputPath("mixed32-after-fade-log-persists.png"),
    });
  } finally {
    await a.close();
    await b.close();
  }
});
