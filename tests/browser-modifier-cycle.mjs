// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:9594/powerroller/');
  await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  const picker = page.getByRole('button', { name: 'Select dice', exact: true });
  const icon = () => picker.locator('svg path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  const powerIcon = await icon();
  await picker.click();
  await page.getByRole('menuitemradio', { name: 'd20', exact: true }).click();
  expect(await icon()).toEqual(powerIcon);
  for (const [name, paths, circles] of [['d6', 1, 5], ['d12', 2, 0], ['d4', 2, 0]]) {
    await picker.click();
    await page.getByRole('menuitemradio', { name, exact: true }).click();
    await expect(picker.locator('svg path')).toHaveCount(paths);
    await expect(picker.locator('svg circle')).toHaveCount(circles);
    await page.screenshot({ path: `/tmp/powerroller-icon-${name}.png`, fullPage: true });
  }
  for (const [selector, sign] of [['edge', '+'], ['bane', '−']]) {
    const button = page.locator(`[data-roll-modifier="${selector}"]`);
    await expect(button).toHaveText(`${sign}0`);
    for (const value of [2, 5, 0]) {
      await button.click();
      await expect(button).toHaveText(`${sign}${value}`);
      await expect(button).toBeEnabled();
      await expect(button).toBeFocused();
    }
    expect(await page.locator(`[data-roll-modifier="${selector}"]`).count()).toBe(1);
  }
  const divider = await picker.evaluate(el => ({ top: getComputedStyle(el, '::after').top, bottom: getComputedStyle(el, '::after').bottom, width: getComputedStyle(el, '::after').width }));
  expect(divider).toEqual({ top: '0px', bottom: '0px', width: '1px' });
  await picker.click();
  await page.getByRole('menuitemradio', { name: 'Power roll (2d10)', exact: true }).click();
  const edge = page.locator('[data-roll-modifier="edge"]').first();
  await edge.click();
  await edge.click();
  await expect(edge).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove edge', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/powerroller-modifier-cycle.png', fullPage: true });
  console.log('PASS: signed 0/2/5 cycles, preserved power controls, d20 power icon, full-height divider');
} finally { await browser.close(); }
