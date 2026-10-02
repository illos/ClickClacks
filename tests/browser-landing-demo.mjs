// SPDX-License-Identifier: MIT
// Run through the test coordinator. No Convex connection or shared app state.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.LANDING_DEMO_URL ?? 'http://127.0.0.1:9615/landing.html';
const artifacts = process.env.LANDING_DEMO_ARTIFACTS ?? '/tmp/clickclacks-landing-demo';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 430, height: 932 }, { width: 320, height: 568 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'A collaborative dice roller' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#customize').scrollIntoViewIfNeeded();
    await expect(page.locator('.landing-preview canvas')).toBeVisible();
    await expect(page.locator('.preview-status')).toHaveCount(0);
    await page.screenshot({ path: `${artifacts}/landing-${viewport.width}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Pause rotation', exact: true }).click();
    const die = page.locator('.landing-preview');
    const originalLabel = await die.getAttribute('aria-label');
    const before = await die.screenshot();
    await page.getByRole('slider', { name: 'Die color wheel', exact: true }).focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(die).not.toHaveAttribute('aria-label', originalLabel);
    // The paused canvas must actually repaint, not just the DOM color label.
    await page.waitForTimeout(150);
    expect((await die.screenshot()).equals(before)).toBe(false);
    await page.getByRole('button', { name: 'Numbers', exact: true }).click();
    const beforeInk = await die.getAttribute('aria-label');
    await page.getByRole('slider', { name: 'Text color lightness', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(die).not.toHaveAttribute('aria-label', beforeInk);
    await page.getByRole('button', { name: 'Rose quartz', exact: true }).click();
    await expect(die).toHaveAttribute('aria-label', /#eaa0b3 body, #492233 numbers, marble finish/);
    await expect(page.getByRole('combobox', { name: 'Finish', exact: true })).toHaveValue('marble');
    await page.getByRole('combobox', { name: 'Finish', exact: true }).selectOption('speckle');
    await expect(die).toHaveAttribute('aria-label', /speckle finish/);
    await page.getByRole('combobox', { name: 'Numbers', exact: true }).selectOption('rune');
    await page.locator('.customizer').screenshot({ path: `${artifacts}/customizer-${viewport.width}.png` });

    await page.getByRole('button', { name: 'Use the framework', exact: true }).click();
    await expect(page.locator('#framework-code')).toBeVisible();
    await expect(page.locator('#embed-code')).toBeHidden();
    await page.getByRole('button', { name: 'Embed the roller', exact: true }).click();
    await expect(page.locator('#embed-code')).toBeVisible();
    await page.locator('#hero-title').scrollIntoViewIfNeeded();
    await expect(page.locator('.landing-preview canvas')).toHaveCount(0);
    await page.locator('.landing-preview').scrollIntoViewIfNeeded();
    await expect(page.locator('.landing-preview canvas')).toBeVisible();
    await expect(die).toHaveAttribute('aria-label', /speckle finish/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ viewport, result: 'PASS', errors }));
    await page.close();
  }
} finally {
  await browser.close();
}
