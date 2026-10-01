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
  await reopened.close();
  expect(errors).toEqual([]);
  // Unsupported browsers get a disabled PiP button, without any popup route.
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined }));
  await unsupported.goto(page.url());
  await expect(unsupported.getByRole('button', { name: 'Pop out tray' })).toBeDisabled();
  await expect(unsupported.locator('#status')).toContainText('unavailable');
  console.log('PASS: real Document PiP; tray/controls only; picker/count; animated 2d6 with persisted readback; controls fit; close/reopen; unsupported message.');
} finally {
  await browser?.close();
  display?.kill();
}
