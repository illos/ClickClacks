// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const resources = [];
  page.on('request', request => resources.push(request.url()));
  await page.goto('http://127.0.0.1:9594/powerroller/examples/react-isolation/index.html');
  await expect(page.getByRole('heading', { name: 'Power Roller', exact: true })).toHaveCount(2);
  await page.waitForTimeout(400);
  const result = await page.evaluate(() => {
    const button = getComputedStyle(document.getElementById('host-button')),
      lab = getComputedStyle(document.getElementById('host-lab'));
    return {
      hostButton: {
        font: button.fontFamily,
        size: button.fontSize,
        color: button.color,
        padding: button.padding,
      },
      hostLab: { padding: lab.padding, border: lab.borderTopColor },
      body: getComputedStyle(document.body).backgroundColor,
      duplicateIds: [...document.querySelectorAll('[id]')]
        .map(el => el.id)
        .filter((id, i, ids) => ids.indexOf(id) !== i),
    };
  });
  expect(result.hostButton.size).toBe('13px');
  expect(result.hostButton.color).toBe('rgb(17, 34, 51)');
  expect(result.hostButton.padding).toBe('5px');
  expect(result.hostLab.padding).toBe('7px');
  expect(result.body).toBe('rgb(255, 255, 255)');
  expect(result.duplicateIds).toEqual([]);
  expect(
    resources.some(url =>
      /three\.js|\/three\/|physics|resting-scene|dice-models|\/renderer\.ts|\/preview\.ts/.test(
        url,
      ),
    ),
  ).toBe(false);
  const first = page.locator('#first'),
    second = page.locator('#second');
  await first.getByRole('button', { name: 'Select dice', exact: true }).click();
  await first.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
  await expect(first.getByRole('group', { name: 'Dice count', exact: true })).toBeVisible();
  await expect(second.getByRole('group', { name: 'Dice count', exact: true })).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/powerroller-variable-browser/two-instances.png',
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        graphicsRequests: resources.filter(url =>
          /three\.js|\/three\/|physics|resting-scene|dice-models|\/renderer\.ts|\/preview\.ts/.test(
            url,
          ),
        ),
        independentSelection: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
