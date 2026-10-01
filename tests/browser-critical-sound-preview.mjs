// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Context = window.AudioContext;
    window.demoCues = [];
    window.AudioContext = class extends Context {
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args) => {
          if (source.buffer?.duration > .3) {
            const samples = source.buffer.getChannelData(0);
            window.demoCues.push({ rms: Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length),
              beginning: Array.from(samples.slice(0, 128)) });
          }
          return start(...args);
        };
        return source;
      }
    };
  });
  await page.goto(process.env.URL || 'https://presidium-iv.tail41404c.ts.net:9597/web/site/critical-sounds.html');
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  // This exercises the built page, catching the former imported-app startup crash.
  await expect(roll).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('canvas')).toHaveCount(1);
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await roll.click();
  await expect(page.locator('#demo-status')).toContainText('Crit · 2d10 | 9 + 10 = 19', { timeout: 15000 });
  await expect(roll).toBeEnabled();
  await roll.click();
  await expect(page.locator('#demo-status')).toContainText('Crit fail · 2d10 | 1 + 1 = 2', { timeout: 15000 });
  const cues = await page.evaluate(() => window.demoCues);
  expect(cues).toHaveLength(2);
  expect(cues.every(cue => cue.rms > .08)).toBe(true);
  expect(cues[0].beginning).not.toEqual(cues[1].beginning);
  await page.getByRole('slider', { name: /Crit volume/ }).fill('35');
  await expect(page.locator('#demo-volume-value')).toHaveText('35%');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await expect(roll).toBeEnabled();
  await roll.click();
  await expect(page.locator('#demo-status')).toContainText('Crit · 2d10 | 9 + 10 = 19', { timeout: 15000 });
  expect(await page.evaluate(() => window.demoCues.length)).toBe(2);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
  expect(errors).toEqual([]);
  console.log('PASS: built Tailscale HTTPS demo loads; alternating natural crit/fail use original renderer and distinct non-silent cues; volume/mute work; preferences unchanged; no startup errors.');
} finally { await browser.close(); }
