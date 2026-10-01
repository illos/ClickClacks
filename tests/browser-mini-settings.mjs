// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const origin = process.env.ORIGIN || 'https://presidium-iv.tail41404c.ts.net:9598';
const backend = 'https://nautical-partridge-636.convex.cloud';
const room = crypto.randomUUID(), otherRoom = crypto.randomUUID();
const host = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Settings embed check</title><iframe title="Dice tray"
    width="480" height="420" style="border:0" src="${origin}/embed/index.html?room=${room}"></iframe>`);
});
await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${host.address().port}`);
  const tray = page.frameLocator('iframe');
  const cog = tray.getByRole('button', { name: 'Open tray settings' });
  await expect(tray.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  await cog.click();
  const menu = tray.getByRole('dialog', { name: 'Settings', exact: true });
  const sharing = menu.getByRole('tab', { name: 'Sharing', exact: true });
  const dice = menu.getByRole('tab', { name: 'Dice', exact: true });
  await expect(sharing).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByLabel('Table code', { exact: true })).toHaveValue(/^[A-Z2-9]{8}$/);
  await expect(menu.getByLabel('Table link', { exact: true })).toHaveValue(new RegExp(`${origin}/embed/index.html`));
  await menu.getByRole('textbox', { name: 'Display name' }).fill('Mini Roller Check');
  const http = new ConvexHttpClient(backend);
  const view = key => http.query(makeFunctionReference('diceDemoV2:view'), { key });
  await expect.poll(async () => (await view(room)).participants.some(member => member.name === 'Mini Roller Check')).toBe(true);

  await sharing.press('ArrowRight');
  await expect(dice).toBeFocused();
  await expect(dice).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByRole('tabpanel', { name: 'Sharing', exact: true })).toBeHidden();
  await menu.getByRole('tab', { name: 'Design', exact: true }).click();
  await menu.getByRole('button', { name: 'Marble', exact: true }).click();
  await menu.getByRole('button', { name: 'Rune', exact: true }).click();
  await expect.poll(async () => {
    const member = (await view(room)).participants.find(member => member.name === 'Mini Roller Check');
    return member?.style.pattern === 'marble' && member.style.font === 'rune';
  }).toBe(true);
  await menu.getByText('Accessibility', { exact: true }).click();
  await menu.getByRole('combobox', { name: /Motion/ }).selectOption('reduce');
  const frame = page.frames().find(frame => frame.url().includes('/embed/index.html'));
  expect(await frame.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.motion)).toBe('reduce');
  await dice.press('ArrowLeft');
  await expect(sharing).toBeFocused();
  await sharing.press('Escape');
  await expect(menu).toBeHidden();
  await expect(cog).toBeFocused();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(`${origin}/embed/index.html?room=${otherRoom}`);
  await expect(other.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  const destination = (await view(otherRoom)).code;
  await cog.click();
  await menu.getByRole('textbox', { name: 'Room code or link' }).fill(destination);
  await menu.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(tray.locator('.stage-label')).toContainText('2 / 8', { timeout: 30000 });
  await expect.poll(async () => (await view(otherRoom)).participants.some(member => member.name === 'Mini Roller Check')).toBe(true);
  await cog.click();
  await menu.getByRole('button', { name: 'Leave table', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(tray.locator('.stage-label')).toContainText('1 / 8', { timeout: 30000 });
  await expect.poll(async () => (await view(otherRoom)).participants.some(member => member.name === 'Mini Roller Check')).toBe(false);
  await otherContext.close();

  await page.locator('iframe').evaluate(frame => { frame.width = '360'; frame.height = '320'; });
  expect(await frame.evaluate(() => {
    const label = document.querySelector('.stage-label').getBoundingClientRect();
    const sound = document.querySelector('.sound-toggle').getBoundingClientRect();
    const settings = document.querySelector('.mini-settings-trigger').getBoundingClientRect();
    return label.right <= sound.left && sound.right < settings.left && settings.right <= innerWidth;
  })).toBe(true);
  await cog.click();
  await menu.getByRole('tab', { name: 'Dice', exact: true }).click();
  await menu.getByRole('tab', { name: 'Design', exact: true }).click();
  expect(await menu.evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && dialog.scrollHeight > dialog.clientHeight;
  })).toBe(true);
  await menu.getByRole('button', { name: 'Rune', exact: true }).scrollIntoViewIfNeeded();
  mkdirSync('.cache/embed', { recursive: true });
  await page.screenshot({ path: '.cache/embed/settings-small.png' });
  await menu.getByRole('button', { name: 'Close settings' }).click();
  await expect(menu).toBeHidden();
  await cog.click();
  await expect(menu.getByRole('tab', { name: 'Sharing', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
  console.log('PASS: cross-site settings cog; tabs/keyboard/Escape/focus; name and dice design persisted; accessibility preference; join/leave readback; 360x320 layout/scroll/reopen.');
} finally {
  await browser.close();
  await new Promise(resolve => host.close(resolve));
}
