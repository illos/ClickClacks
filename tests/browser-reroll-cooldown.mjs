// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
  await page.goto(process.env.URL || 'http://127.0.0.1:9594/powerroller/');
  const button = page.locator('.roll-button-group > .primary');
  await expect(button).toBeEnabled({ timeout: 30000 });
  await button.click();
  await expect(button).toBeDisabled();
  // Observe the exact DOM transition rather than waiting for the result flash.
  const enabledAt = await button.evaluate(el => new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (!el.disabled) { observer.disconnect(); resolve(Date.now()); }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['disabled'] });
    if (!el.disabled) { observer.disconnect(); resolve(Date.now()); }
  }));
  const session = await page.evaluate(() => {
    const backend = 'https://nautical-partridge-636.convex.cloud';
    return { backend, key: new URL(location.href).searchParams.get('room'),
      identity: JSON.parse(sessionStorage.getItem(`powerroller.identity.v1:${backend}`)) };
  });
  const response = await fetch(session.backend + '/api/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'diceDemoV2:track', args: { key: session.key, viewer: session.identity.viewer }, format: 'json' }),
  });
  const result = await response.json();
  expect(result.status).toBe('success');
  const roll = result.value.roll;
  expect(roll.motion).toBeDefined();
  expect(enabledAt - roll.startsAt).toBeGreaterThanOrEqual(1900);
  expect(enabledAt - roll.startsAt).toBeLessThan(2300);
  expect(enabledAt).toBeLessThan(roll.startsAt + roll.duration);
  await expect(page.locator('.roll-log-entry')).toHaveCount(1);
  console.log(`PASS: Roll re-enabled ${enabledAt - roll.startsAt}ms after the persisted throw started, before its ${roll.duration}ms animation finished.`);
} finally { await browser.close(); }
