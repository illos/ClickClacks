// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of [{ width: 320, height: 225 }, { width: 640, height: 450 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:9594/powerroller/');
    await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
    const pickerStyle = await page.getByRole('button', { name: 'Select dice', exact: true }).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, divider: getComputedStyle(el, '::after').width }));
    expect(pickerStyle.background).toBe('rgba(0, 0, 0, 0.12)');
    expect(pickerStyle.divider).toBe('1px');
    const short = viewport.height <= 450;
    expect(await page.locator('main').evaluate(el => getComputedStyle(el).display)).toBe(short ? 'block' : 'grid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (short) {
      expect(await page.locator('.stage').evaluate(el => el.getBoundingClientRect().height)).toBe(180);
      for (const label of ['Add edge', 'Add bane', 'Select dice']) {
        const control = label === 'Add edge' ? page.locator('[data-roll-modifier="edge"]') : label === 'Add bane' ? page.locator('[data-roll-modifier="bane"]') : page.getByRole('button', { name: label, exact: true });
        await control.scrollIntoViewIfNeeded();
        expect(await control.evaluate(el => { const box = el.getBoundingClientRect(); const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return target === el || el.contains(target); })).toBe(true);
      }
      await page.getByRole('button', { name: 'Select dice', exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
      for (const label of ['Add die', 'Remove die', 'Roll']) {
        const control = page.getByRole('button', { name: label, exact: true });
        await control.scrollIntoViewIfNeeded();
        expect(await control.evaluate(el => { const box = el.getBoundingClientRect(); const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return target === el || el.contains(target); })).toBe(true);
      }
      await page.getByRole('button', { name: 'Add die', exact: true }).click();
      await expect(page.getByLabel('Number of dice', { exact: true })).toHaveText('2');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: `/tmp/powerroller-approved-reflow-${viewport.width}x${viewport.height}.png`, fullPage: true });
    }
    results.push({ viewport, layout: short ? 'scrolling' : 'original grid', horizontalOverflow: false });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
