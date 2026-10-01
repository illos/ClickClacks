// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
  await page.goto('http://127.0.0.1:9594/powerroller/');
  await page.getByRole('button', {name:'Customize dice', exact:true}).click();
  const wheel = page.getByRole('slider', {name:'Dice color wheel',exact:true});
  await expect(wheel).toBeVisible();
  await expect(page.locator('.inline-colors input[type="range"]')).toHaveCount(1);
  const swatch = page.locator('.color-choices button').first().locator('.color-swatch');
  const original = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
  await expect(page.locator('.profile-dialog .preview-canvas')).toBeVisible();
  await wheel.scrollIntoViewIfNeeded();
  const box = await wheel.boundingBox();
  await page.touchscreen.tap(box.x+box.width*.85, box.y+box.height*.5);
  expect(await swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(original);
  await wheel.focus();
  const before = Number(await wheel.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  expect(Number(await wheel.getAttribute('aria-valuenow'))).toBe((before+1)%360);
  await page.getByRole('button', {name:'Numbers',exact:true}).click();
  await expect(page.getByRole('slider',{name:'Number color wheel',exact:true})).toBeVisible();
  await page.getByRole('slider',{name:'Number color lightness',exact:true}).fill('0');
  await expect(page.locator('.color-choices button').last().locator('.color-swatch')).toHaveCSS('background-color','rgb(0, 0, 0)');
  await page.getByRole('slider',{name:'Number color lightness',exact:true}).fill('100');
  await expect(page.locator('.color-choices button').last().locator('.color-swatch')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.screenshot({path:'/tmp/powerroller-wheel.png'});
  await page.getByRole('button',{name:'Close customization',exact:true}).click();
  await page.getByRole('button',{name:'Select dice',exact:true}).click();
  await page.getByRole('menuitemradio',{name:'d6',exact:true}).click();
  await expect(page.getByRole('button',{name:'Select dice',exact:true}).locator('svg circle')).toHaveCount(6);
  await expect(page.getByRole('button',{name:'Select dice',exact:true}).locator('svg path')).toHaveCount(2);
  console.log('PASS: touch/keyboard wheel, independent dice/ink, black/white lightness, cube d6 icon');
} finally { await browser.close(); }
