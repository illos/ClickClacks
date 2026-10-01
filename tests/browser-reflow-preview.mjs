// SPDX-License-Identifier: MIT
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const css = `.powerroller .lab.v2{height:auto;min-height:100dvh;display:block;overflow:visible}.powerroller .v2 .roll-area{display:block}.powerroller .v2 .lab-header{margin-bottom:16px}.powerroller .v2 .dice-card{display:block;margin:16px 0;overflow:hidden}.powerroller .v2 .dice-card .stage{height:180px;min-height:180px;flex:none}.powerroller .v2 .dice-card .controls{flex-wrap:wrap;justify-content:flex-start}.powerroller .v2 .dice-card .power-modifiers{flex:0 0 auto}.powerroller .v2 .track-results{margin-top:16px;max-height:none}`;
try {
  for (const viewport of [
    { width: 320, height: 225 },
    { width: 640, height: 450 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:9594/powerroller/');
    await page.getByRole('heading', { name: 'Power Roller', exact: true }).waitFor();
    await page.addStyleTag({ content: css });
    await page.getByRole('button', { name: 'Select dice', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'd6', exact: true }).click();
    await page.locator('.controls').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/tmp/powerroller-variable-browser/proposed-reflow-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        viewport,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        buttons: await page.locator('.controls button').evaluateAll(elements =>
          elements.map(el => {
            const r = el.getBoundingClientRect();
            return {
              name: el.getAttribute('aria-label'),
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
            };
          }),
        ),
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
