// SPDX-License-Identifier: MIT
// Coordinator-only investigation against an isolated backend. No acceptance claim.
import { chromium, expect } from '@playwright/test';
if (!process.env.URL) throw new Error('URL must point to the candidate on an isolated backend.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.workerTrace = [];
    const OriginalWorker = Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        const worker = String(url);
        this.addEventListener('message', ({ data }) => window.workerTrace.push({
          event: 'reply', worker, at: performance.now(), id: data.id,
          motion: Boolean(data.motion), error: data.error,
        }));
        this.addEventListener('error', error => window.workerTrace.push({
          event: 'error', worker, at: performance.now(), error: error.message,
        }));
        const send = this.postMessage.bind(this);
        this.postMessage = (...args) => {
          const data = args[0];
          window.workerTrace.push({ event: 'request', worker, at: performance.now(), id: data.id, faces: data.faces, scene: data.scene });
          return send(...args);
        };
      }
    };
  });
  await page.goto(new URL('tests/fixtures/automatic-session.html', process.env.URL).href);
  await expect(page.locator('main')).toHaveAttribute('data-roll-mode', 'local', { timeout: 30000 });
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeEnabled(); await roll.click();
  await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 15000 });
  let missingMotion = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.getByRole('button', { name: 'Show graphics', exact: true }).click();
    await expect(page.locator('.canvas-host canvas')).toBeVisible({ timeout: 30000 });
    await expect(roll).toBeEnabled();
    const marker = await page.evaluate(() => window.workerTrace.length);
    await roll.click();
    await expect(page.locator('.roll-log-entry')).toHaveCount(attempt + 2, { timeout: 20000 });
    const result = await page.evaluate(async start => {
      const latest = (await window.fixture.localHistory()).rolls.at(-1);
      return { motion: Boolean(latest.motion), roll: latest.id, workerTrace: window.workerTrace.slice(start), alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent) };
    }, marker);
    console.log(JSON.stringify({ attempt, ...result }));
    if (!result.motion) { missingMotion = true; break; }
    await page.getByRole('button', { name: 'Hide graphics', exact: true }).click();
    await expect(page.locator('.canvas-host canvas')).toHaveCount(0);
  }
  console.log(JSON.stringify({ missingMotion, pageErrors: errors }));
} finally { await browser.close(); }
