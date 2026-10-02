// SPDX-License-Identifier: MIT
// Coordinator only: deterministic real-worker recovery and exhausted fallback on a private backend.
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
if (!process.env.URL) throw new Error('URL must point to the candidate on an isolated backend.');
const browser = await chromium.launch();
try {
  for (const mode of ['recovery', 'exhausted']) {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const workerUrl = new URL(`tests/fixtures/seeded-physics-worker.ts?worker_file&type=module&mode=${mode}`, process.env.URL).href;
    await page.addInitScript(url => {
      window.motionTrace = []; window.rpc = [];
      const NativeWorker = Worker;
      window.Worker = class extends NativeWorker {
        constructor(original, options) {
          const physics = String(original).includes('physics-worker');
          super(physics ? url : original, options);
          if (!physics) return;
          this.addEventListener('message', ({ data }) => window.motionTrace.push({
            seed: data.settlingSeed, id: data.id, error: data.error, motion: Boolean(data.motion),
          }));
          const send = this.postMessage.bind(this);
          this.postMessage = (...args) => {
            if (args[0].faces) window.motionTrace.push({ faces: args[0].faces, id: args[0].id });
            return send(...args);
          };
        }
      };
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        try { const message = JSON.parse(data); if (message.udfPath) window.rpc.push(message.udfPath); } catch {}
        return send.call(this, data);
      };
    }, workerUrl);
    await page.goto(new URL('tests/fixtures/automatic-session.html', process.env.URL).href);
    await expect(page.locator('main')).toHaveAttribute('data-roll-mode', 'local', { timeout: 30000 });
    const roll = page.getByRole('button', { name: 'Roll', exact: true });
    await expect(roll).toBeEnabled();
    const marker = await page.evaluate(() => window.rpc.length);
    await page.getByRole('button', { name: 'Show graphics', exact: true }).click();
    await expect(page.locator('.canvas-host canvas')).toBeVisible({ timeout: 30000 });
    await expect(roll).toBeEnabled(); await roll.click();
    await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 20000 });
    const result = await page.evaluate(async start => ({
      history: await window.fixture.localHistory(), trace: window.motionTrace,
      rpc: window.rpc.slice(start), backend: window.fixture.backend, key: window.fixture.key, identity: window.fixture.identity,
    }), marker);
    expect(result.history.rolls).toHaveLength(1);
    const accepted = result.history.rolls[0], requests = result.trace.filter(event => event.faces);
    expect(requests).toHaveLength(1); expect(accepted.faces).toEqual(requests[0].faces);
    expect(result.rpc.filter(method => !['diceDemoV2:join', 'diceDemoV2:customize'].includes(method))).toEqual([]);
    const http = new ConvexHttpClient(result.backend);
    expect((await http.query(makeFunctionReference('diceDemoV2:events'), { key: result.key, ...result.identity, after: 0 })).rolls).toEqual([]);
    if (mode === 'recovery') {
      expect(accepted.motion).toBeDefined();
      expect(result.trace.some(event => event.seed === 10)).toBe(true);
      expect(result.trace.some(event => event.seed === 1)).toBe(true);
      await expect(page.locator('.tray-roll-result')).toHaveCount(1);
      await expect(page.getByRole('alert')).toHaveCount(0);
    } else {
      expect(accepted.motion).toBeUndefined();
      const failure = page.getByRole('alert').filter({ hasText: '3D motion could not be prepared. Your roll was saved as text.' });
      await expect(failure).toBeVisible();
      await expect(page.locator('.tray-roll-result')).toHaveCount(0);
      const faceReply = result.trace.findIndex(event => event.id === requests[0].id && event.error);
      expect(faceReply).toBeGreaterThan(0);
      const faceRequest = result.trace.findIndex(event => event.faces);
      expect(result.trace.slice(faceRequest, faceReply).filter(event => event.seed === 10)).toHaveLength(3);
    }
    await expect(roll).toBeEnabled(); expect(errors).toEqual([]);
    console.log(`PASS ${mode}: one accepted roll, original faces preserved, real worker exercised, no authority RPC or backend result.`);
    await page.close();
  }
} finally { await browser.close(); }
