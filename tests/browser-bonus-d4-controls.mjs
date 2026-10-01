// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  for (const [width,height] of [[430,932],[390,844],[320,225],[1280,900]]) {
    const page = await browser.newPage({viewport:{width,height},hasTouch:true});
    await page.goto('http://127.0.0.1:9594/powerroller/');
    await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
    const picker = page.getByRole('button',{name:'Select dice',exact:true});
    await expect(picker.locator('svg text')).toHaveText(['10','10']);
    await expect(page.getByRole('button',{name:'+1d4',exact:true})).toHaveCount(0);
    for (const sides of [20,12,10,8,6]) {
      await picker.click();
      await page.getByRole('menuitemradio',{name:'d'+sides,exact:true}).click();
      const bonus = page.getByRole('button',{name:'+1d4',exact:true});
      await expect(bonus).toHaveAttribute('aria-pressed','false');
      await bonus.click();
      await expect(bonus).toHaveAttribute('aria-pressed','true');
      const positive = page.locator('[data-roll-modifier="edge"]');
      const b = await bonus.boundingBox(), p = await positive.boundingBox();
      expect(b.x+b.width).toBeLessThanOrEqual(p.x);
      await bonus.click();
      await expect(bonus).toHaveAttribute('aria-pressed','false');
    }
    const bounds = await page.locator('.controls').evaluate(el => ({ width:el.clientWidth, scroll:el.scrollWidth, page:document.documentElement.scrollWidth, viewport:innerWidth }));
    expect(bounds.scroll).toBe(bounds.width);
    expect(bounds.page).toBe(bounds.viewport);
    await picker.click();
    await page.getByRole('menuitemradio',{name:'d4',exact:true}).click();
    await expect(page.getByRole('button',{name:'+1d4',exact:true})).toHaveCount(0);
    await expect(picker).toBeFocused();
    expect(await picker.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
    await picker.press('Enter');
    await page.keyboard.press('Escape');
    await expect(picker).toBeFocused();
    expect(await picker.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
    if(width===430) await page.screenshot({path:'/tmp/powerroller-bonus-controls.png'});
    await page.close();
  }
  console.log('PASS: eligible bonus d4 toggles/order/layout; power/d4 exclusion; double10 icon; touch highlight removed, keyboard focus retained');
} finally { await browser.close(); }
