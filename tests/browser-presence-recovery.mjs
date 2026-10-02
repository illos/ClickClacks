// SPDX-License-Identifier: MIT
// Coordinator only: URL must use an isolated backend, never the shared app.
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
if (!process.env.URL) throw new Error('URL must point to the candidate on an isolated backend.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('tests/fixtures/presence-recovery.html', process.env.URL).href);
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  const clear = page.getByRole('button', { name: 'Clear tray', exact: true });
  await expect(roll).toBeEnabled({ timeout: 30000 }); await expect(clear).toBeEnabled();
  const session = await page.evaluate(() => ({ backend: window.fixture.backend, key: window.fixture.key, identity: window.fixture.identity }));
  const http = new ConvexHttpClient(session.backend);
  const member = async () => (await http.query(makeFunctionReference('diceDemoV2:view'), { key: session.key })).participants.find(p => p.id === session.identity.viewer);

  // Same-client mutations are serialized: Leave reaches the real backend first,
  // then Clear fails while the browser still shows its previous membership.
  await page.evaluate(async () => {
    const leaving = window.fixture.leave();
    document.querySelector('button[aria-label="Clear tray"]').click();
    await leaving;
  });
  const reconnect = page.getByText('Reconnect to this room before throwing.', { exact: true });
  await expect(reconnect).toBeVisible({ timeout: 5000 });
  await expect.poll(async () => (await member())?.ready, { timeout: 20000 }).toBe(true);
  await expect(reconnect).toHaveCount(0, { timeout: 20000 });
  await expect(roll).toBeEnabled();
  await roll.click(); await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 15000 });
  const events = await http.query(makeFunctionReference('diceDemoV2:events'), { key: session.key, ...session.identity, after: 0 });
  expect(events.rolls).toHaveLength(1); expect(events.rolls[0].roller).toBe(session.identity.viewer);

  // Another UNAUTHORIZED error has a different cause; a heartbeat must retain it.
  const seenAt = (await member()).seenAt;
  await page.evaluate(() => window.fixture.failNextClear()); await clear.click();
  const unrelated = page.getByText('Invalid private session credential.', { exact: true });
  await expect(unrelated).toBeVisible();
  await expect.poll(async () => (await member())?.seenAt, { timeout: 20000 }).toBeGreaterThan(seenAt);
  await expect(unrelated).toBeVisible(); expect(errors).toEqual([]);
  console.log('PASS: real membership loss produces reconnect error; successful heartbeat clears it, Roll recovers and persists; unrelated credential error survives a successful heartbeat.');
} finally { await browser.close(); }
