// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Document PiP requires a headed browser; a private display keeps the host's
// interactive sessions untouched when this check runs without DISPLAY.
let display, browser;
if (!process.env.DISPLAY) {
  const number = Array.from({ length: 100 }, (_, i) => i + 170)
    .find(i => !existsSync(`/tmp/.X11-unix/X${i}`));
  if (!number) throw new Error('No free test display.');
  process.env.DISPLAY = `:${number}`;
  display = spawn('Xvfb', [process.env.DISPLAY, '-screen', '0', '1280x900x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${number}`); i++)
    await new Promise(resolve => setTimeout(resolve, 100));
}
try {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:9596/examples/popout/index.html');
  await page.getByRole('button', { name: 'Pop out tray' }).click();
  await expect(page.locator('#status')).toContainText('Tray is open');
  const mini = context.pages().find(p => p !== page);
  expect(mini).toBeTruthy();
  // Playwright applies the context's default viewport to new windows, including
  // PiP; explicitly test the mini-player size requested by the demo.
  await mini.setViewportSize({ width: 480, height: 420 });
  const tray = mini.frameLocator('iframe');
  const roll = tray.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeEnabled({ timeout: 30000 });
  await expect(tray.locator('.stage canvas')).toBeVisible();
  await expect(tray.locator('.lab-header')).toBeHidden();
  await expect(tray.getByRole('region', { name: 'Roll log', includeHidden: true })).toBeHidden();

  await tray.getByRole('button', { name: 'Select dice', exact: true }).click();
  await tray.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
  await tray.getByRole('button', { name: 'Add die', exact: true }).click();
  const background = await context.newPage();
  await background.goto('about:blank');
  await background.bringToFront();
  await roll.click();
  await expect(tray.locator('.tray-roll-result strong').first()).toBeVisible({ timeout: 15000 });
  const frame = mini.frames().find(f => f.url().includes('/tray.html'));
  const session = await frame.evaluate(() => ({
    key: new URL(location.href).searchParams.get('room'),
    identity: JSON.parse(sessionStorage.getItem('powerroller.identity.v1:https://nautical-partridge-636.convex.cloud')),
  }));
  const http = new ConvexHttpClient('https://nautical-partridge-636.convex.cloud');
  const persisted = await http.query(makeFunctionReference('diceDemoV2:track'), {
    key: session.key, viewer: session.identity.viewer,
  });
  expect(persisted.roll.faces).toHaveLength(2);
  expect(persisted.roll.dice.sides).toBe(6);
  expect(persisted.roll.motion).toBeDefined();
  expect(persisted.roll.total).toBe(persisted.roll.faces.reduce((a, b) => a + b, 0));
  await expect(tray.locator('.tray-roll-result strong').first()).toHaveText(String(persisted.roll.total));
  const history = tray.getByRole('region', { name: 'Recent tray rolls' });
  await expect(history.locator('.roll-total').first()).toHaveText(String(persisted.roll.total));
  const firstKey = await history.locator('.tray-history-row').first().getAttribute('data-history-key');
  // Exercise seven real revealed rolls: cap the chat overlay at six and retain
  // descending order without repeating the current roll on presence refreshes.
  for (let i = 0; i < 6; i++) {
    const previous = await history.locator('.tray-history-row').first().getAttribute('data-history-key');
    await expect(roll).toBeEnabled({ timeout: 15000 });
    await roll.click();
    await expect(history.locator('.tray-history-row').first())
      .not.toHaveAttribute('data-history-key', previous, { timeout: 15000 });
    await expect(history.locator('.tray-history-row')).toHaveCount(Math.min(i + 2, 6));
  }
  expect(await history.locator('.tray-history-row').evaluateAll(rows =>
    rows.map(row => row.dataset.historyKey))).not.toContain(firstKey);
  const latest = await http.query(makeFunctionReference('diceDemoV2:track'), {
    key: session.key, viewer: session.identity.viewer,
  });
  await expect(history.locator('.roll-total').first()).toHaveText(String(latest.roll.total));
  expect(await frame.evaluate(() => {
    const canvas = document.querySelector('.stage canvas');
    const host = document.querySelector('.canvas-host');
    const overlay = document.querySelector('.tray-history');
    const rows = [...overlay.querySelectorAll('.tray-history-row')];
    return canvas.getContext('webgl2').getContextAttributes().alpha &&
      Number(getComputedStyle(host).zIndex) > Number(getComputedStyle(overlay).zIndex) &&
      getComputedStyle(overlay).pointerEvents === 'none' &&
      getComputedStyle(overlay).maskImage.includes('linear-gradient') &&
      rows.every((row, i) => !i || Number(getComputedStyle(row).opacity) < Number(getComputedStyle(rows[i - 1]).opacity));
  })).toBe(true);
  const fits = await frame.evaluate(() => {
    const r = document.querySelector('.roll-button-group').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  });
  expect(fits).toBe(true);
  mkdirSync('.cache/popout', { recursive: true });
  await mini.screenshot({ path: '.cache/popout/tray.png' });
  await mini.setViewportSize({ width: 360, height: 320 });
  expect(await frame.evaluate(() => {
    const r = document.querySelector('.roll-button-group').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  })).toBe(true);
  await mini.close();
  await expect(page.locator('#status')).toContainText('Tray closed');
  await page.getByRole('button', { name: 'Pop out tray' }).click();
  await expect(page.locator('#status')).toContainText('Tray is open');
  const reopened = context.pages().find(p => p !== page && p !== background);
  await expect(reopened.frameLocator('iframe').getByRole('button', { name: 'Roll', exact: true }))
    .toBeEnabled({ timeout: 30000 });
  await expect(reopened.frameLocator('iframe').locator('.tray-history-row')).toHaveCount(6);
  await reopened.close();
  expect(errors).toEqual([]);
  // Unsupported browsers get a disabled PiP button, without any popup route.
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined }));
  await unsupported.goto(page.url());
  await expect(unsupported.getByRole('button', { name: 'Pop out tray' })).toBeDisabled();
  await expect(unsupported.locator('#status')).toContainText('unavailable');
  const failedContext = await browser.newContext();
  await failedContext.route(/(\/assets\/main-[^/]+\.js|\/web\/site\/main\.tsx)(?:\?|$)/,
    route => route.abort('failed'));
  const failedPage = await failedContext.newPage();
  await failedPage.goto(page.url());
  await failedPage.getByRole('button', { name: 'Pop out tray' }).click();
  await expect(failedPage.locator('#status')).toContainText('could not load');
  const failedMini = failedContext.pages().find(p => p !== failedPage);
  await expect(failedMini.frameLocator('iframe').getByRole('alert')).toContainText('could not load');
  await failedContext.close();
  console.log('PASS: real Document PiP; animated 2d6/readback; six latest revealed rolls beneath transparent dice canvas; fading/order/cap; history restored on reopen; sizes; unsupported and failed-module messages.');
} finally {
  await browser?.close();
  display?.kill();
}
