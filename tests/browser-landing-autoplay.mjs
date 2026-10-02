// SPDX-License-Identifier: MIT
// Focused real-backend proof; fake time only for the three-minute expiry.
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { mkdir } from 'node:fs/promises';
const artifacts = process.env.LANDING_DEMO_ARTIFACTS ?? '/tmp/clickclacks-landing-autoplay';
await mkdir(artifacts, { recursive: true });
const client = new ConvexHttpClient(process.env.LANDING_ROLLER_BACKEND ?? 'https://nautical-partridge-636.convex.cloud');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(process.env.LANDING_DEMO_URL ?? 'http://127.0.0.1:9615/landing.html');
  const frame = await expect.poll(() => page.frames().some(f => f.url().includes('/web/landing/mini.html'))).toBe(true).then(() => page.frames().find(f => f.url().includes('/web/landing/mini.html')));
  const root = frame.locator('#root');
  const roll = frame.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeEnabled({ timeout: 30000 });
  const key = await root.getAttribute('data-room');
  const viewer = await root.getAttribute('data-viewer');
  const view = () => client.query(makeFunctionReference('diceDemoV2:view'), { key });
  const track = id => client.query(makeFunctionReference('diceDemoV2:track'), { key, viewer: id });
  await expect.poll(async () => (await view()).participants.map(p => p.name), { timeout: 30000 }).toEqual(expect.arrayContaining(['Alex', 'Sam', 'You']));
  const actors = (await view()).participants.filter(p => ['Alex', 'Sam'].includes(p.name));
  for (const actor of actors) await expect.poll(async () => (await track(actor.id))?.roll.faces.length ?? 0, { timeout: 30000 }).toBeGreaterThan(0);
  const before = await Promise.all(actors.map(actor => track(actor.id)));
  await roll.click();
  await expect.poll(async () => (await track(viewer))?.roll.faces.length ?? 0, { timeout: 20000 }).toBeGreaterThan(0);
  for (let i = 0; i < actors.length; i++) await expect.poll(async () => (await track(actors[i].id))?.roll.id, { timeout: 30000 }).not.toBe(before[i].roll.id);
  await page.locator('#customize').scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-autoplay', 'paused');
  await expect.poll(async () => (await view()).participants.filter(p => ['Alex', 'Sam'].includes(p.name)).length).toBe(0);
  await page.locator('.hero-tray').scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-autoplay', 'active');
  await expect.poll(async () => (await view()).participants.filter(p => ['Alex', 'Sam'].includes(p.name)).length, { timeout: 15000 }).toBe(2);
  await page.clock.fastForward(180001);
  await expect(root).toHaveAttribute('data-autoplay', 'expired');
  await expect.poll(async () => (await view()).participants.filter(p => ['Alex', 'Sam'].includes(p.name)).length).toBe(0);
  await page.locator('#customize').scrollIntoViewIfNeeded();
  await page.locator('.hero-tray').scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-autoplay', 'expired');
  await expect(roll).toBeEnabled();
  await page.screenshot({ path: `${artifacts}/autoplay-expired.png` });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ result: 'PASS', actors: actors.map(p => p.name), manualRollDuringAutoplay: true, offscreenPause: true, expiryNoReset: true, errors }));
} finally { await browser.close(); }
