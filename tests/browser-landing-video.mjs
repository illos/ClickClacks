// SPDX-License-Identifier: MIT
// Focused playback check for the optional video build; run through Test.
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ viewport: reducedMotion === 'reduce' ? { width: 430, height: 932 } : { width: 1440, height: 1000 }, reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.LANDING_DEMO_URL ?? 'http://127.0.0.1:9615/landing.html');
    const video = page.locator('.video-placeholder video');
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveJSProperty('playsInline', true);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    if (reducedMotion === 'reduce') {
      await expect(video).toHaveJSProperty('paused', true);
      await page.getByRole('button', { name: 'Play demo', exact: true }).click();
    }
    await expect(video).toHaveJSProperty('paused', false);
    await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
    await expect(video).toHaveJSProperty('paused', true);
    await video.evaluate(element => { element.currentTime = 16; });
    await page.waitForTimeout(250);
    expect(await video.evaluate(element => element.duration)).toBeGreaterThan(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ reducedMotion, result: 'PASS', duration: await video.evaluate(element => element.duration), errors }));
    await page.close();
  }
} finally { await browser.close(); }
