// SPDX-License-Identifier: MIT
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 225 } });
  await page.goto('http://127.0.0.1:9594/powerroller/');
  await page.getByRole('heading', { name: 'Power Roller', exact: true }).waitFor();
  const checks = [];
  for (const name of ['Add edge', 'Add bane', 'Select dice']) {
    const locator = page.locator(
      name === 'Select dice'
        ? '[aria-label="Select dice"]'
        : name === 'Remove die'
          ? '[aria-label="Remove die"]'
          : name === 'Add die'
            ? '[aria-label="Add die"]'
            : name.includes('bane') || name.includes('−2')
              ? '[data-roll-modifier="bane"]'
              : '[data-roll-modifier="edge"]',
    );
    await locator.scrollIntoViewIfNeeded();
    checks.push({
      name,
      box: await locator.boundingBox(),
      hit: await locator.evaluate(el => {
        const r = el.getBoundingClientRect(),
          hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === el || el.contains(hit);
      }),
    });
  }
  await page.getByRole('button', { name: 'Select dice', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
  for (const name of [
    'Add +2 modifier',
    'Add −2 modifier',
    'Remove die',
    'Add die',
    'Select dice',
  ]) {
    const locator = page.locator(
      name === 'Select dice'
        ? '[aria-label="Select dice"]'
        : name === 'Remove die'
          ? '[aria-label="Remove die"]'
          : name === 'Add die'
            ? '[aria-label="Add die"]'
            : name.includes('bane') || name.includes('−2')
              ? '[data-roll-modifier="bane"]'
              : '[data-roll-modifier="edge"]',
    );
    await locator.scrollIntoViewIfNeeded();
    checks.push({
      name,
      box: await locator.boundingBox(),
      hit: await locator.evaluate(el => {
        const r = el.getBoundingClientRect(),
          hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === el || el.contains(hit);
      }),
    });
  }
  await page.screenshot({
    path: '/tmp/powerroller-variable-browser/short-generic-controls.png',
    fullPage: true,
  });
  console.log(JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
}
