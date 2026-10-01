// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const folder = '/tmp/powerroller-variable-browser';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const outputs = [];
const base = 'http://127.0.0.1:9594/powerroller/';
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole('heading', { name: 'Power Roller', exact: true }).waitFor();
  await page.waitForTimeout(1200);

  await page.screenshot({ path: folder + '/desktop-default.png', fullPage: true });
  outputs.push({
    desktop: await page.locator('.lab-header').boundingBox(),
    roll: await page.getByRole('button', { name: /^Roll/ }).boundingBox(),
  });
  await page.getByRole('button', { name: 'Select dice', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Dice to roll' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(7);
  outputs.push({ options: await menu.getByRole('menuitemradio').allTextContents() });
  for (const name of await menu.getByRole('menuitemradio').allTextContents()) {
    if (!(await menu.isVisible()))
      await page.getByRole('button', { name: 'Select dice', exact: true }).click();
    await menu.getByRole('menuitemradio', { name, exact: true }).click();
    if (!/Power/.test(name)) {
      await expect(page.getByRole('group', { name: 'Dice count', exact: true })).toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Add die', exact: true }).click();
  await expect(page.getByLabel('Number of dice', { exact: true })).toHaveText('2');
  await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
  const details = page.locator('details');
  await expect(details).not.toHaveAttribute('open');
  await details.locator('summary').click();
  await page.screenshot({ path: folder + '/accessibility-before-change.png', fullPage: true });
  await page.getByRole('combobox', { name: /Motion/ }).selectOption('reduce');
  await page.getByLabel('High contrast', { exact: true }).check();
  await page.getByLabel('Hide 3D dice', { exact: true }).check();
  await page.screenshot({ path: folder + '/accessibility-expanded.png', fullPage: true });
  await page.getByRole('button', { name: 'Close customization', exact: true }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'Power Roller', exact: true }).waitFor();
  outputs.push({
    hiddenCanvas: await page.locator('.canvas-host canvas').count(),
    highContrast: await page.locator('main').getAttribute('class'),
  });
  await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
  await page.locator('details summary').click();
  await expect(page.getByRole('combobox', { name: /Motion/ })).toHaveValue('reduce');
  await expect(page.getByLabel('High contrast', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Hide 3D dice', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Close customization', exact: true }).click();
  await context.close();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 640, height: 450 },
    { width: 320, height: 225 },
  ]) {
    const ctx = await browser.newContext({ viewport }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.getByRole('heading', { name: 'Power Roller', exact: true }).waitFor();
    await p.waitForTimeout(400);
    const roll = p.getByRole('button', { name: /^Roll/ });
    await roll.scrollIntoViewIfNeeded();
    const box = await roll.boundingBox();
    const hit = await roll.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el === document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    });
    outputs.push({
      viewport,
      roll: box,
      reachable: hit,
      overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    });
    await p.screenshot({
      path: `${folder}/viewport-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await ctx.close();
  }
  console.log(JSON.stringify(outputs, null, 2));
} finally {
  await browser.close();
}
