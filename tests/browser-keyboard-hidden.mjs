// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
const browser = await chromium.launch(),
  backend = 'https://nautical-partridge-636.convex.cloud';
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() =>
    localStorage.setItem(
      'powerroller.preferences.v2',
      JSON.stringify({
        version: 2,
        preferences: {
          profile: {
            name: 'Keyboard Tester',
            style: { color: '#227744', ink: '#ffffff', pattern: 'marble', font: 'gothic' },
          },
          motion: 'reduce',
          hidden: true,
          highContrast: true,
          announcements: 'all',
        },
      }),
    ),
  );
  const page = await context.newPage(),
    resources = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('http://127.0.0.1:9594/powerroller/');
  await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  const picker = page.getByRole('button', { name: 'Select dice', exact: true });
  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('menuitemradio', { name: 'Power roll (2d10)', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'd20', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(picker).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.locator('details summary').click();
  await expect(page.getByRole('combobox', { name: /Motion/ })).toHaveValue('reduce');
  await expect(page.getByLabel('High contrast', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Hide 3D dice', { exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open settings', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Pattern', exact: true })).toHaveValue('marble');
  await expect(page.getByRole('combobox', { name: 'Font style', exact: true })).toHaveValue(
    'gothic',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Customize dice', exact: true })).toBeFocused();
  expect(
    resources.filter(url =>
      /three\.js|physics|resting-scene|dice-models|\/renderer\.ts|\/preview\.ts/.test(url),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 10000 });
  const identity = await page.evaluate(
    backend => JSON.parse(sessionStorage.getItem('powerroller.identity.v1:' + backend)),
    backend,
  );
  const http = new ConvexHttpClient(backend);
  const room = await page.evaluate(() => new URL(location.href).searchParams.get('room'));
  const track = await http.query(makeFunctionReference('diceDemoV2:track'), {
    key: room,
    viewer: identity.viewer,
  });
  expect(track.roll.motion).toBeUndefined();
  expect(track.roll.name).toBe('Keyboard Tester');
  expect(track.roll.styles[0]).toMatchObject({ pattern: 'marble', font: 'gothic' });
  await page.reload();
  await expect(page.locator('.roll-log-entry')).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText('');
  await page.screenshot({
    path: '/tmp/powerroller-variable-browser/fresh-hidden-keyboard.png',
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        freshHiddenGraphicsRequests: 0,
        textRollPersisted: true,
        nameStyleRestored: true,
        keyboardArrowEscape: true,
        historicalAnnouncementEmpty: true,
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
}
