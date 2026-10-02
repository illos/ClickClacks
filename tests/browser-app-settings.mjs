// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.URL ?? 'http://127.0.0.1:9695/';
const artifacts = process.env.SUPPORT_TEST_ARTIFACT_DIR ?? '.preview/app-settings';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [width, height, path] of [[1440, 900, '/'], [430, 932, '/'], [320, 568, '/'], [480, 320, '/web/popout/tray.html']]) {
    const tray = path !== '/';
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' });
    await context.route(/https:\/\/.*\.convex\.(cloud|site)\//, route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { if (!localStorage.getItem('powerroller.preferences.v2')) localStorage.setItem('powerroller.preferences.v2', JSON.stringify({
      version: 2, preferences: { hidden: true, motion: 'reduce', theme: 'dark' },
    })); });
    await page.goto(new URL(path, url).href);
    const trigger = page.getByRole('button', { name: tray ? 'Open tray settings' : 'Open settings', exact: true });
    async function openSettings() {
      await trigger.click();
      if (tray) await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      return page.getByRole('dialog', { name: 'Settings', exact: true });
    }
    if (!tray) {
      await expect(page.locator('.lab-header').getByRole('button', { name: 'Report a bug', exact: true })).toHaveCount(0);
      await expect(page.locator('.lab-header').getByRole('button', { name: /^Color theme:/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
      const dice = page.getByRole('dialog', { name: 'Customize dice', exact: true });
      await expect(dice.getByRole('group', { name: 'Appearance' })).toHaveCount(0);
      await expect(dice.getByText('Accessibility', { exact: true })).toHaveCount(0);
      await dice.press('Escape');
      await page.getByRole('button', { name: 'Open social menu', exact: true }).click();
      const sharing = page.getByRole('dialog', { name: 'Sharing', exact: true });
      await expect(sharing.getByLabel('Table code', { exact: true })).toBeVisible();
      await expect(sharing.getByRole('button', { name: 'Report a bug', exact: true })).toHaveCount(0);
      await sharing.press('Escape');
    }
    const settings = await openSettings();
    if (tray) {
      const tab = settings.getByRole('tab', { name: 'Settings', exact: true });
      await tab.press('Home');
      await expect(settings.getByRole('tab', { name: 'Sharing', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(settings.getByRole('tab', { name: 'Dice', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(settings.getByRole('tabpanel', { name: 'Dice', exact: true }).getByRole('group', { name: 'Appearance' })).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(settings.getByRole('tabpanel', { name: 'Sharing', exact: true })).toBeHidden();
      await tab.press('ArrowRight');
      await expect(settings.getByRole('tab', { name: 'Sharing', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(tab).toBeFocused();
    }
    await settings.getByRole('radio', { name: 'Dark', exact: true }).check();
    await expect(page.locator('.lab.v2')).toHaveAttribute('data-theme', 'dark');
    await settings.getByRole('radio', { name: 'System', exact: true }).check();
    await expect(page.locator('.lab.v2')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('.lab.v2')).toHaveAttribute('data-theme', 'dark');
    await settings.getByRole('radio', { name: 'Light', exact: true }).check();
    await expect(page.locator('.lab.v2')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.theme)).toBe('light');
    await settings.getByText('Accessibility', { exact: true }).click();
    await settings.getByRole('checkbox', { name: 'High contrast', exact: true }).check();
    await expect(page.locator('.lab.v2')).toHaveClass(/high-contrast/);
    await settings.getByRole('combobox', { name: 'Motion', exact: true }).selectOption('device');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.motion)).toBe('device');
    for (const input of await settings.getByRole('combobox').all()) await expect(input).toHaveCSS('font-size', '16px');
    expect(await settings.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
        && dialog.scrollWidth <= dialog.clientWidth && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await page.screenshot({ path: `${artifacts}/settings-${width}.png` });
    await settings.getByRole('button', { name: 'Report a bug', exact: true }).click();
    await expect(settings).not.toBeVisible();
    const report = page.getByRole('dialog', { name: 'Report a bug', exact: true });
    await expect(report.getByLabel('What went wrong?')).toBeFocused();
    await expect(report.getByLabel('What went wrong?')).toHaveCSS('font-size', '16px');
    await expect(report.getByLabel('Contact info')).toHaveCSS('font-size', '16px');
    await report.press('Escape');
    await expect(trigger).toBeFocused();
    await openSettings();
    await settings.press('Escape');
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(page.locator('.lab.v2')).toHaveAttribute('data-theme', 'light');
    await openSettings();
    await expect(settings.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    await expect(settings.getByRole('combobox', { name: 'Motion', exact: true })).toHaveValue('device');
    await expect(settings.getByRole('checkbox', { name: 'High contrast', exact: true })).toBeChecked();
    expect(errors).toEqual([]);
    await context.close();
  }
  console.log('PASS: Settings menu consolidation, theme/accessibility persisted, three tray tabs and keyboard wrap, report handoff/focus, 16px fields, desktop/mobile/tray fit. Game backend blocked; no reports sent.');
} finally { await browser.close(); }
