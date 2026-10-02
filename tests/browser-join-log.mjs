// SPDX-License-Identifier: MIT
// Coordinator only, against a private backend.
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
if (!process.env.URL) throw new Error('URL must point to the candidate on an isolated backend.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = new URL('tests/fixtures/presence-recovery.html', process.env.URL); url.searchParams.set('name', 'Ariadne');
  await page.goto(url.href);
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.join-log-message')).toHaveText('Ariadne joined');
  const session = await page.evaluate(() => ({ backend: window.fixture.backend, key: window.fixture.key, identity: window.fixture.identity }));
  const http = new ConvexHttpClient(session.backend);
  await roll.click(); await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 15000 });
  const readEvents = () => http.query(makeFunctionReference('diceDemoV2:events'), { key: session.key, ...session.identity, after: 0 });
  const persisted = await readEvents(); expect(persisted.rolls).toHaveLength(1);
  await page.evaluate(start => window.fixture.setHistorySince(start), persisted.rolls[0].startsAt);
  await expect(page.locator('.join-log-entry')).toHaveCount(0); // Existing demo boundary also filters notices.

  const peer = await browser.newPage(); peer.on('pageerror', error => errors.push(error.message));
  const peerUrl = new URL(url); peerUrl.searchParams.set('room', session.key); peerUrl.searchParams.set('name', 'Cato');
  await peer.goto(peerUrl.href);
  await expect(peer.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  const peerIdentity = await peer.evaluate(() => window.fixture.identity);
  const notices = page.locator(`.join-log-entry[data-participant="${peerIdentity.viewer}"]`);
  await expect(notices).toHaveCount(1); await expect(notices.locator('.join-log-message')).toHaveText('Cato joined');
  await expect(peer.locator('.join-log-message')).toHaveText('Cato joined'); // Existing Ariadne is a baseline, not a new arrival.
  const own = async () => (await http.query(makeFunctionReference('diceDemoV2:view'), { key: session.key })).participants.find(p => p.id === peerIdentity.viewer);
  const seenAt = (await own()).seenAt;
  await expect.poll(async () => (await own())?.seenAt, { timeout: 20000 }).toBeGreaterThan(seenAt);
  await expect(notices).toHaveCount(1); // Heartbeat does not duplicate the row.
  await peer.getByRole('button', { name: 'Open social menu', exact: true }).click();
  await peer.getByLabel('Display name').fill('Cato Renamed');
  await expect.poll(async () => (await own())?.name).toBe('Cato Renamed');
  await expect(notices).toHaveCount(1); await expect(notices.locator('.join-log-message')).toHaveText('Cato joined');
  await peer.keyboard.press('Escape');
  await peer.evaluate(() => window.fixture.leave());
  await expect(page.locator('.stage-label')).toContainText('1 / 8 participants');
  await peer.evaluate(() => window.fixture.rejoin());
  await expect(notices).toHaveCount(2); // Actual departure/rejoin produces a new notice.
  expect((await readEvents()).rolls).toHaveLength(1); // Notices are not dice or backend history.
  await page.evaluate(() => window.fixture.setHistorySince(Infinity));
  await expect(page.locator('.join-log-entry')).toHaveCount(0); await expect(page.locator('.roll-log-entry')).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.locator(`.join-log-entry[data-participant="${peerIdentity.viewer}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS: arrivals appear once in the mixed log; heartbeats/name edits do not duplicate; departure/rejoin adds a notice; notices respect historySince/reset, disappear on reload and create no backend roll records.');
} finally { await browser.close(); }
