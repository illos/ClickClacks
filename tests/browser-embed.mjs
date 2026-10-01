// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const origin = process.env.ORIGIN || 'https://presidium-iv.tail41404c.ts.net:9598';
const backend = 'https://nautical-partridge-636.convex.cloud';
const room = crypto.randomUUID();
const blockedRoom = crypto.randomUUID();
// The containing page is on a different site from the HTTPS embed, not merely
// another path or port. It uses the exact iframe HTML offered to site owners.
const host = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Independent site</title><h1>Our game night</h1>
    <iframe src="${origin}/embed/index.html?room=${request.url === '/isolated' ? blockedRoom : room}" title="Power Roller dice tray"
      width="480" height="420" style="max-width:100%;border:0;border-radius:16px"></iframe>`);
});
await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
const hostUrl = `http://127.0.0.1:${host.address().port}`;
const browser = await chromium.launch();
const errors = [];
async function visitor(blockStorage = false) {
  const context = await browser.newContext();
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  if (blockStorage) await context.addInitScript(() => {
    for (const storage of ['localStorage', 'sessionStorage', 'indexedDB'])
      Object.defineProperty(window, storage, { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  const page = await context.newPage();
  await page.goto(blockStorage ? `${hostUrl}/isolated` : hostUrl);
  const tray = page.frameLocator('iframe');
  await expect(tray.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(tray.locator('.stage canvas')).toBeVisible();
  await expect(tray.locator('.lab-header')).toBeHidden();
  await expect(tray.locator('.track-results')).toBeHidden();
  return { context, page, tray };
}
try {
  const first = await visitor();
  const second = await visitor();
  await expect(first.tray.locator('.stage-label')).toContainText('2 / 8');
  const firstFrame = first.page.frames().find(frame => frame.url().includes('/embed/index.html'));
  const secondFrame = second.page.frames().find(frame => frame.url().includes('/embed/index.html'));
  const firstIdentity = await firstFrame.evaluate(url => JSON.parse(sessionStorage.getItem(`powerroller.identity.v1:${url}`)), backend);
  const secondIdentity = await secondFrame.evaluate(url => JSON.parse(sessionStorage.getItem(`powerroller.identity.v1:${url}`)), backend);
  expect(firstIdentity.viewer).not.toBe(secondIdentity.viewer);
  await first.tray.getByRole('button', { name: 'Select dice', exact: true }).click();
  await first.tray.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
  await first.tray.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(first.tray.locator('.tray-history .roll-total').first()).toBeVisible({ timeout: 15000 });
  const http = new ConvexHttpClient(backend);
  const track = await http.query(makeFunctionReference('diceDemoV2:track'), { key: room, viewer: firstIdentity.viewer });
  expect(track.roll.dice.sides).toBe(6);
  expect(track.roll.faces).toHaveLength(1);
  expect(track.roll.motion).toBeDefined();
  for (const { tray } of [first, second])
    await expect(tray.locator('.tray-history .roll-total').first()).toHaveText(String(track.roll.total), { timeout: 15000 });
  await first.page.reload();
  await expect(first.page.frameLocator('iframe').locator('.tray-history .roll-total').first()).toHaveText(String(track.roll.total), { timeout: 30000 });
  await first.context.close();
  await second.context.close();

  const blocked = await visitor(true);
  const blockedRows = blocked.tray.locator('.tray-history-row');
  const previous = await blockedRows.count() ? await blockedRows.first().getAttribute('data-history-key') : null;
  await blocked.tray.getByRole('button', { name: 'Roll', exact: true }).click();
  const latestRow = blocked.tray.locator('.tray-history-row').first();
  if (previous) await expect(latestRow).not.toHaveAttribute('data-history-key', previous, { timeout: 15000 });
  else await expect(latestRow).toBeVisible({ timeout: 15000 });
  const blockedOwner = (await latestRow.getAttribute('data-history-key')).split(':')[0];
  const blockedTrack = await http.query(makeFunctionReference('diceDemoV2:track'), { key: blockedRoom, viewer: blockedOwner });
  expect(blockedTrack.roll.roller).not.toBe(firstIdentity.viewer);
  await expect(latestRow.locator('.roll-total')).toHaveText(String(blockedTrack.roll.total ?? blockedTrack.roll.power.total));
  await blocked.context.close();

  const demoContext = await browser.newContext({ viewport: { width: 1120, height: 800 } });
  demoContext.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  const demo = await demoContext.newPage();
  await demo.goto(`${origin}/examples/embed/index.html`);
  const snippet = await demo.locator('#snippet').inputValue();
  expect(snippet).toContain(`${origin}/embed/index.html`);
  expect(snippet).not.toContain('room=');
  await demo.locator('#room').fill(room);
  await demo.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(demo.locator('#snippet')).toHaveValue(new RegExp(`room=${room}`));
  await expect(demo.frameLocator('iframe').getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  await demo.locator('#room').fill('not a room');
  await demo.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(demo.locator('#room')).toHaveAttribute('aria-invalid', 'true');
  mkdirSync('.cache/embed', { recursive: true });
  await demo.screenshot({ path: '.cache/embed/demo.png', fullPage: true });
  await demoContext.close();
  expect(errors).toEqual([]);
  console.log('PASS: cross-site iframe; distinct viewers/shared room; animated d6 with persisted readback; overlay/reload; storage blocked roll; copyable snippet/room validation.');
} finally {
  await browser.close();
  await new Promise(resolve => host.close(resolve));
}
