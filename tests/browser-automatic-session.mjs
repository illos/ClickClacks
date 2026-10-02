// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
const base = process.env.URL;
if (!base) throw new Error('URL must point to the candidate on an isolated backend.');
const fixture = new URL('tests/fixtures/automatic-session.html', base).href;
const browser = await chromium.launch();
const errors = [];
function trace(page) {
  page.on('pageerror', error => errors.push(error.message));
  return page.addInitScript(skew => {
    const wall = Date.now; Date.now = () => wall() + skew;
    window.rpc = [];
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
      try {
        const message = JSON.parse(data);
        if (message.udfPath) window.rpc.push({ type: message.type, method: message.udfPath });
        for (const modification of message.modifications ?? []) if (modification.udfPath) window.rpc.push({ type: modification.type, method: modification.udfPath });
      } catch {}
      return send.call(this, data);
    };
  }, Number(process.env.CLOCK_SKEW_MS ?? 0));
}
try {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage(); await trace(page); await page.goto(fixture);
  const main = page.locator('main[data-roll-mode]'), roll = page.getByRole('button', { name: 'Roll', exact: true });
  await expect(main).toHaveAttribute('data-roll-mode', 'local', { timeout: 30000 });
  await expect(roll).toBeEnabled();
  const session = await page.evaluate(() => ({ key: window.fixture.key, backend: window.fixture.backend, identity: window.fixture.identity }));
  const http = new ConvexHttpClient(session.backend);
  const events = () => http.query(makeFunctionReference('diceDemoV2:events'), { key: session.key, ...session.identity, after: 0 });
  const marker = await page.evaluate(() => window.rpc.length);
  await roll.click(); await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 15000 });
  // Show the original physics and repeat locally; neither path reaches authority.
  await page.getByRole('button', { name: 'Show graphics' }).click();
  // Roll stays usable during lazy renderer loading; wait for the actual 3D tray.
  await expect(page.locator('.canvas-host canvas')).toBeVisible({ timeout: 30000 });
  await expect(roll).toBeEnabled(); await roll.click();
  await expect(page.locator('.tray-roll-result')).toHaveCount(1, { timeout: 20000 });
  await expect(page.locator('.roll-log-entry')).toHaveCount(2, { timeout: 15000 });
  await page.getByRole('button', { name: 'Clear tray', exact: true }).click();
  await expect(page.locator('.tray-roll-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open social menu', exact: true }).click();
  await page.getByLabel('Display name').fill('Edited solo');
  const ownProfile = async () => (await http.query(makeFunctionReference('diceDemoV2:view'), { key: session.key })).participants.find(p => p.id === session.identity.viewer);
  await expect.poll(async () => (await ownProfile()).name).toBe('Edited solo');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
  await page.getByRole('slider', { name: 'Die color lightness', exact: true }).fill('0');
  await expect.poll(async () => (await ownProfile()).style.color).toBe('#000000');
  await page.keyboard.press('Escape');
  await expect(roll).toBeEnabled(); await roll.click();
  await expect(page.locator('.roll-log-entry')).toHaveCount(3, { timeout: 15000 });
  const edited = await page.evaluate(async () => (await window.fixture.localHistory()).rolls.at(-1));
  expect(edited.name).toBe('Edited solo'); expect(edited.styles.every(style => style.color === '#000000')).toBe(true);
  const localCalls = await page.evaluate(start => window.rpc.slice(start), marker);
  expect(localCalls.filter(call => !['diceDemoV2:join', 'diceDemoV2:customize'].includes(call.method))).toEqual([]);
  expect((await events()).rolls).toEqual([]); // Persisted readback: local rolls were never accepted.

  const peerContext = await browser.newContext(); const peer = await peerContext.newPage(); await trace(peer);
  const peerUrl = new URL(fixture); peerUrl.searchParams.set('room', session.key);
  await peer.goto(peerUrl.href);
  await expect(main).toHaveAttribute('data-roll-mode', 'shared', { timeout: 5000 });
  await expect(peer.locator('main')).toHaveAttribute('data-roll-mode', 'shared');
  await expect(roll).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('.roll-log-entry')).toHaveCount(0); // Local history is discarded.
  await roll.click();
  await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 20000 });
  await expect(peer.locator('.roll-log-entry')).toHaveCount(1, { timeout: 20000 });
  const persisted = (await events()).rolls;
  expect(persisted).toHaveLength(1); expect(persisted[0].roller).toBe(session.identity.viewer);
  expect(persisted[0].local).toBeUndefined();
  await expect(page.locator('.roll-log-entry .roll-total').first()).toHaveText(String(persisted[0].total));
  expect(await page.evaluate(() => window.rpc.some(call => call.method === 'diceDemo:sampleFaces'))).toBe(true);
  expect(await page.evaluate(() => window.rpc.some(call => call.method === 'diceDemoV2:throwDice'))).toBe(true);

  // Explicit membership removal, then the full production ten-minute delay.
  const peerSession = await peer.evaluate(() => ({ key: window.fixture.key, identity: window.fixture.identity }));
  await http.mutation(makeFunctionReference('diceDemoV2:leave'), { key: peerSession.key, ...peerSession.identity });
  await peerContext.close();
  await expect.poll(async () => (await http.query(makeFunctionReference('diceDemoV2:view'), { key: session.key })).participants.length).toBe(1);
  await expect.poll(() => page.evaluate(() => window.fixture.participantCount())).toBe(1);
  await page.evaluate(() => window.fixture.advanceSolo(599000));
  await expect(main).toHaveAttribute('data-roll-mode', 'shared');
  await page.evaluate(() => window.fixture.advanceSolo(1000));
  await expect(main).toHaveAttribute('data-roll-mode', 'local');
  await expect(page.locator('.roll-log-entry')).toHaveCount(0);
  await expect(roll).toBeEnabled();
  const afterSwitch = await page.evaluate(() => window.rpc.length);
  await roll.click(); await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 15000 });
  const returnCalls = await page.evaluate(start => window.rpc.slice(start), afterSwitch);
  expect(returnCalls.filter(call => !['diceDemoV2:join', 'diceDemoV2:customize'].includes(call.method))).toEqual([]);
  expect((await events()).rolls).toHaveLength(1);
  expect(errors).toEqual([]);
  console.log('PASS: local text/3D/clear produce zero roll/clock/delivery RPCs and zero persisted rolls; second participant switches both to shared; shared persisted readback matches both logs; ten-minute return drops local history and resumes zero-RPC solo rolling.');
  await context.close();
} finally { await browser.close(); }
