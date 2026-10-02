// SPDX-License-Identifier: MIT
// Test coordinator: focused owned embed proof, in fresh visitor rooms.
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { mkdir } from 'node:fs/promises';
const artifacts = process.env.LANDING_DEMO_ARTIFACTS ?? '/tmp/clickclacks-landing-mini';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 430, height: 932 }, { width: 320, height: 568 }]) {
    const page = await browser.newPage({ viewport, colorScheme: 'dark' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.LANDING_DEMO_URL ?? 'http://127.0.0.1:9615/landing.html');
    const tray = page.frameLocator('.hero-tray');
    const roll = tray.getByRole('button', { name: 'Roll', exact: true });
    await expect(roll).toBeEnabled({ timeout: 30000 });
    await tray.getByRole('button', { name: 'Open tray settings', exact: true }).click();
    const room = await tray.getByLabel('Table code', { exact: true }).inputValue();
    await tray.getByRole('button', { name: 'Close settings', exact: true }).click();
    await roll.click();
    await expect(tray.locator('.tray-history .roll-log-entry').first()).toBeVisible({ timeout: 20000 });
    const frame = page.frames().find(candidate => candidate.url().includes('/web/landing/mini.html'));
    const backend = process.env.LANDING_ROLLER_BACKEND ?? 'https://nautical-partridge-636.convex.cloud';
    const viewer = await frame.locator('#root').getAttribute('data-viewer');
    const stored = await new ConvexHttpClient(backend).query(makeFunctionReference('diceDemoV2:track'), { key: room.trim(), viewer });
    expect(stored?.roll.faces.length).toBeGreaterThan(0);
    await expect(tray.locator('.canvas-host canvas')).toBeVisible();
    expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.hero-tray').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${artifacts}/mini-${viewport.width}.png` });
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ viewport, result: 'PASS', persistedFaces: stored.roll.faces, errors }));
    await page.close();
  }
} finally { await browser.close(); }
