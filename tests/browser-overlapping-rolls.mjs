// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // A genuinely slow first preparation must not extend the button cooldown.
    // Preserve the original worker motion; only delay delivering one reply.
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      delayedId;
      set onmessage(handler) {
        super.onmessage = event => {
          if (event.data.id === this.delayedId) setTimeout(() => handler.call(this, event), 4000);
          else handler.call(this, event);
        };
      }
      postMessage(message, ...rest) {
        if (message.faces && !window.delayedPreparation) {
          window.delayedPreparation = true;
          this.delayedId = message.id;
        }
        return super.postMessage(message, ...rest);
      }
    };
  });
  await page.goto(process.env.URL || 'http://127.0.0.1:9594/powerroller/');
  const button = page.locator('.roll-button-group > .primary');
  await expect(button).toBeEnabled({ timeout: 30000 });
  const tappedAt = Date.now();
  await button.click();
  await expect(button).toBeDisabled();
  const enabledAt = await button.evaluate(el => new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (!el.disabled) { observer.disconnect(); resolve(Date.now()); }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['disabled'] });
    if (!el.disabled) { observer.disconnect(); resolve(Date.now()); }
  }));
  expect(enabledAt - tappedAt).toBeGreaterThanOrEqual(1900);
  expect(enabledAt - tappedAt).toBeLessThan(2300);
  expect(await page.evaluate(() => window.delayedPreparation)).toBe(true);
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await button.click(); // This tap queues exactly one submission while preparing.
  await expect(page.locator('.canvas-host .tray-roll-result')).toHaveCount(2, { timeout: 20000 });
  const session = await page.evaluate(() => {
    const backend = 'https://nautical-partridge-636.convex.cloud';
    return { backend, key: new URL(location.href).searchParams.get('room'),
      identity: JSON.parse(sessionStorage.getItem(`powerroller.identity.v1:${backend}`)) };
  });
  const query = async (path, args) => {
    const response = await fetch(session.backend + '/api/query', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, args, format: 'json' }) });
    const result = await response.json(); expect(result.status).toBe('success'); return result.value;
  };
  const track = await query('diceDemoV2:track', { key: session.key, viewer: session.identity.viewer });
  expect(track.activeRolls).toHaveLength(2);
  const [first, second] = track.activeRolls;
  expect(second.startsAt).toBeLessThan(first.startsAt + first.duration);
  expect(await page.locator('.canvas-host .tray-roll-result').evaluateAll(elements => elements.map(el => el.dataset.rollId).sort()))
    .toEqual([first.id, second.id].sort());
  await expect(page.locator('.roll-log-entry')).toHaveCount(2, { timeout: 15000 });
  const history = await query('diceDemoV2:events', { key: session.key, ...session.identity, after: 0 });
  expect(history.rolls.map(roll => roll.id)).toEqual([first.id, second.id]);
  expect(history.rolls.every(roll => !roll.motion)).toBe(true);

  // A fresh observer must recover both still-visible paths, not only the latest.
  const peerContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const peer = await peerContext.newPage();
  peer.on('pageerror', error => errors.push(error.message));
  await peer.goto(page.url());
  await expect(peer.locator(`.tray-roll-result[data-roller="${session.identity.viewer}"]`)).toHaveCount(2, { timeout: 20000 });
  await page.getByRole('button', { name: 'Clear tray', exact: true }).click();
  await expect(page.locator('.canvas-host .tray-roll-result')).toHaveCount(0);
  await expect(peer.locator('.canvas-host .tray-roll-result')).toHaveCount(0);
  await expect(page.locator('.roll-log-entry')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('.canvas-host .tray-roll-result')).toHaveCount(0);
  await expect(page.locator('.roll-log-entry')).toHaveCount(2);
  expect(errors).toEqual([]);
  console.log(`PASS: ${enabledAt - tappedAt}ms tap cooldown during delayed preparation; exactly two accepted overlapping rolls and history events; fresh observer restores both; clear/reload retain history and prevent dice resurrection.`);
  await peerContext.close(); await context.close();
} finally { await browser.close(); }
