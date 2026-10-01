// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
const url = 'http://127.0.0.1:9594/powerroller/',
  backend = 'https://nautical-partridge-636.convex.cloud',
  artifacts = '/tmp/powerroller-variable-browser';
const browser = await chromium.launch(),
  http = new ConvexHttpClient(backend);
try {
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
    secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const first = await firstContext.newPage(),
    second = await secondContext.newPage();
  const failures = [];
  for (const page of [first, second]) page.on('pageerror', error => failures.push(error.message));
  await first.goto(url);
  const rollButton = first.getByRole('button', { name: 'Roll', exact: true });
  await expect(rollButton).toBeEnabled({ timeout: 30000 });
  await first.getByRole('button', { name: 'Open social menu', exact: true }).click();
  const code = await first.getByLabel('Table code', { exact: true }).inputValue();
  await first.getByRole('button', { name: 'Close social menu', exact: true }).click();
  await second.goto(url + '?room=' + code.trim());
  await expect(second.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await first.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(first.locator('.roll-log-entry')).toHaveCount(1, { timeout: 16000 });
  await expect(second.locator('.roll-log-entry')).toHaveCount(1, { timeout: 16000 });
  const identity = await first.evaluate(
    backend => JSON.parse(sessionStorage.getItem('powerroller.identity.v1:' + backend)),
    backend,
  );
  const track = await http.query(makeFunctionReference('diceDemoV2:track'), {
    key: code.trim(),
    viewer: identity.viewer,
  });
  expect(track.roll.faces).toHaveLength(2);
  expect(track.roll.dice.kind).toBe('power');
  expect(track.roll.motion.samples.length).toBeGreaterThan(0);
  expect((await first.locator('.roll-log-entry').first().innerText()).replace(' · you', '')).toBe(
    (await second.locator('.roll-log-entry').first().innerText()).replace(' · you', ''),
  );
  await first.screenshot({ path: artifacts + '/live-power-desktop.png', fullPage: true });
  await second.screenshot({ path: artifacts + '/live-power-mobile.png', fullPage: true });
  const models = [];
  for (const sides of [20, 12, 10, 8, 6, 4]) {
    await expect(first.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
      timeout: 16000,
    });
    await first.getByRole('button', { name: 'Select dice', exact: true }).click();
    await first.getByRole('menuitemradio', { name: 'd' + sides, exact: true }).click();
    const before = await first.locator('.roll-log-entry').count();
    await first.getByRole('button', { name: 'Roll', exact: true }).click();
    await expect(first.locator('.roll-log-entry')).toHaveCount(before + 1, { timeout: 16000 });
    const read = await http.query(makeFunctionReference('diceDemoV2:track'), {
      key: code.trim(),
      viewer: identity.viewer,
    });
    expect(read.roll.dice.sides).toBe(sides);
    expect(read.roll.faces).toHaveLength(1);
    expect(read.roll.faces[0]).toBeGreaterThanOrEqual(1);
    expect(read.roll.faces[0]).toBeLessThanOrEqual(sides);
    expect(read.roll.motion).toBeDefined();
    models.push({
      sides,
      face: read.roll.faces[0],
      motionSamples: read.roll.motion.samples.length,
    });
    await first.screenshot({ path: artifacts + '/live-d' + sides + '.png', fullPage: true });
  }
  await first.getByRole('button', { name: 'Customize dice', exact: true }).click();
  await first.locator('details summary').click();
  await first.getByRole('combobox', { name: /Motion/ }).selectOption('reduce');
  await first.getByLabel('High contrast', { exact: true }).check();
  await first.getByLabel('Hide 3D dice', { exact: true }).check();
  await first.getByRole('button', { name: 'Close customization', exact: true }).click();
  await first.reload();
  await expect(first.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await expect(first.locator('.roll-log-entry')).toHaveCount(7, { timeout: 10000 });
  expect(await first.locator('canvas').count()).toBe(0);
  const loaded = [];
  first.on('request', request => loaded.push(request.url()));
  await first.reload();
  await expect(first.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  expect(
    loaded.some(u =>
      /three\.js|physics|resting-scene|dice-models|\/renderer\.ts|\/preview\.ts/.test(u),
    ),
  ).toBe(false);
  const before = await first.locator('.roll-log-entry').count();
  await first.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(first.locator('.roll-log-entry')).toHaveCount(before + 1, { timeout: 10000 });
  const hiddenRead = await http.query(makeFunctionReference('diceDemoV2:track'), {
    key: code.trim(),
    viewer: identity.viewer,
  });
  expect(hiddenRead.roll.motion).toBeUndefined();
  await expect(second.locator('.roll-log-entry')).toHaveCount(8, { timeout: 10000 });
  expect(failures).toEqual([]);
  console.log(
    JSON.stringify(
      {
        persistedPowerFaces: track.roll.faces,
        models,
        sharedLog: true,
        hiddenGraphicsRequests: 0,
        textOnlyRollAccepted: true,
        reloadedHistory: 7,
        pageErrors: failures,
      },
      null,
      2,
    ),
  );
  await firstContext.close();
  await secondContext.close();
} finally {
  await browser.close();
}
