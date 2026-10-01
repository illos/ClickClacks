// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
  const touch = await page.context().newCDPSession(page);
  const send = (type, x, y) => touch.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
  });
  await page.goto(process.env.POWERROLLER_TEST_URL || 'http://127.0.0.1:9597/powerroller/');
  await page.getByRole('button', { name: 'Customize dice', exact: true }).click();
  for (const label of ['Die color', 'Text color']) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    const slider = page.getByRole('slider', { name: `${label} lightness`, exact: true });
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    const geometry = await slider.evaluate(el => {
      const style = getComputedStyle(el);
      return { left: parseFloat(style.borderLeftWidth) || 0, right: parseFloat(style.borderRightWidth) || 0 };
    });
    const y = box.y + box.height / 2;
    const x = value => box.x + geometry.left + 16 + (box.width - geometry.left - geometry.right - 32) * value / 100;
    await slider.fill('5');
    // Starting far from the current thumb must jump immediately, then drag
    // continuously with the same touch instead of requiring a second gesture.
    await send('touchStart', x(85), y);
    await expect(slider).toHaveValue('85');
    await send('touchMove', x(40), y);
    await expect(slider).toHaveValue('40');
    await send('touchMove', box.x - 20, y);
    await expect(slider).toHaveValue('0');
    await send('touchMove', box.x + box.width + 20, y);
    await expect(slider).toHaveValue('100');
    await send('touchEnd');
    await expect(page.getByRole('tab', { name: label, exact: true }).locator('.color-swatch')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Capture is released when the browser cancels a touch, and another
    // gesture can start normally. The native range retains keyboard behavior.
    await slider.evaluate(el => el.addEventListener('pointerdown', event => { el.dataset.pointerId = String(event.pointerId); }, { once: true }));
    await send('touchStart', x(25), y);
    await expect(slider).toHaveValue('25');
    expect(await slider.evaluate(el => el.hasPointerCapture(Number(el.dataset.pointerId)))).toBe(true);
    await send('touchCancel');
    expect(await slider.evaluate(el => el.hasPointerCapture(Number(el.dataset.pointerId)))).toBe(false);
    await send('touchStart', x(60), y);
    await send('touchEnd');
    await expect(slider).toHaveValue('60');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('61');
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('100');
  }
  console.log('PASS: phone touch starts anywhere on both lightness tracks, continuous captured drag, clamped endpoints, pointer cancel/restart, native arrow/Home/End keys');
} finally { await browser.close(); }
