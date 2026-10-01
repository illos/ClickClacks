// SPDX-License-Identifier: MIT
import { chromium, webkit, expect } from '@playwright/test';
// Render long-pool log markup in the actual history container: no backend writes needed.
for (const engine of process.env.WEBKIT ? [chromium, webkit] : [chromium]) {
  const browser = await engine.launch();
  try {
    for (const [width, height] of [[430,932], [390,844], [320,225], [1280,900]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      await page.goto('http://127.0.0.1:9594/powerroller/');
      await page.locator('.track-results').waitFor();
      const result = await page.locator('.track-results').evaluate(history => {
        history.innerHTML = Array.from({length: 30}, (_, i) => `<article class="roll-log-entry"><header><strong class="roll-author">Ariadne</strong><time>12:34</time></header><div class="roll-result-line"><span class="roll-equation">${i ? Array(20).fill(20).join(' + ') + ' + 5' : '10 + 10'}</span><span class="roll-outcome"><span>=</span><strong class="roll-total">${i ? 405 : 20}</strong></span></div></article>`).join('');
        history.scrollLeft = 100;
        const equation = history.querySelectorAll('.roll-equation')[1];
        const box = equation.getBoundingClientRect();
        const parent = history.getBoundingClientRect();
        return { horizontal: history.scrollWidth - history.clientWidth, scrollLeft: history.scrollLeft, wraps: box.height > 30, fits: box.right <= parent.right, vertical: history.scrollHeight > history.clientHeight, touch: getComputedStyle(history).touchAction, pageOverflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(result.horizontal).toBe(0);
      expect(result.scrollLeft).toBe(0);
      expect(result.wraps).toBe(true);
      expect(result.fits).toBe(true);
      expect(result.pageOverflow).toBe(0);
      expect(result.touch).toBe('pan-y pinch-zoom');
      if (height > 450) expect(result.vertical).toBe(true);
      if (width === 430) await page.screenshot({ path: `/tmp/history-${engine.name()}.png` });
      await page.close();
    }
    console.log(`PASS ${engine.name()}: 20-die history wraps; vertical-only at phone, short and desktop viewports`);
  } finally { await browser.close(); }
}
