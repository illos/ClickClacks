// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
const backend = 'https://nautical-partridge-636.convex.cloud',
  base = 'http://127.0.0.1:9594/powerroller/';
const browser = await chromium.launch();
const prefs = {
  room: 'ZZZZZZZZ',
  roomBackend: backend,
  profile: {
    name: 'Saved Room Tester',
    style: { color: '#44aa88', ink: '#ffffff', pattern: 'solid', font: 'serif' },
  },
  motion: 'reduce',
  hidden: true,
  highContrast: false,
  announcements: 'off',
};
async function context() {
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    prefs =>
      localStorage.setItem(
        'powerroller.preferences.v2',
        JSON.stringify({ version: 2, preferences: prefs }),
      ),
    prefs,
  );
  return ctx;
}
try {
  const staleContext = await context(),
    stale = await staleContext.newPage();
  await stale.goto(base);
  await expect(stale.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  const recovered = await stale.evaluate(() => new URL(location.href).searchParams.get('room'));
  expect(recovered).not.toBe('ZZZZZZZZ');
  expect(recovered).toMatch(/^[A-Z2-9]{8}$/);
  const http = new ConvexHttpClient(backend),
    view = await http.query(makeFunctionReference('diceDemoV2:view'), { key: recovered });
  expect(view.code).toBe(recovered);
  expect(view.participants.length).toBe(1);
  await expect(stale.locator('.error')).toHaveCount(0);
  await stale.screenshot({
    path: '/tmp/powerroller-variable-browser/stale-room-recovered.png',
    fullPage: true,
  });
  const inviteContext = await context(),
    invite = await inviteContext.newPage();
  await invite.goto(base + '?room=' + recovered);
  await expect(invite.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  expect(await invite.evaluate(() => new URL(location.href).searchParams.get('room'))).toBe(
    recovered,
  );
  const joined = await http.query(makeFunctionReference('diceDemoV2:view'), { key: recovered });
  expect(joined.participants.length).toBe(2);
  const host = await browser.newPage();
  await host.goto(base + 'tests/fixtures/controlled-preferences.html');
  await expect(host.getByRole('heading', { name: 'Power Roller', exact: true })).toBeVisible();
  expect(await host.locator('canvas').count()).toBe(0);
  await host.locator('#show').click();
  await expect(host.locator('.canvas-host canvas')).toHaveCount(1, { timeout: 15000 });
  await host.locator('#hide').click();
  await expect(host.locator('canvas')).toHaveCount(0);
  await expect(host.locator('.fallback')).toHaveText(
    '3D dice hidden · shared text results still work.',
  );
  console.log(
    JSON.stringify(
      {
        staleSavedRoomRecovered: true,
        recoveredJoinable: true,
        explicitInviteWon: true,
        controlledPreferencesShowHide: true,
      },
      null,
      2,
    ),
  );
  await staleContext.close();
  await inviteContext.close();
  await host.close();
} finally {
  await browser.close();
}
