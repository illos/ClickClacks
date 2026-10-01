// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  for (const [width,height] of [[430,932],[390,844],[320,225]]) {
    const page = await browser.newPage({viewport:{width,height}});
    await page.goto('http://127.0.0.1:9594/powerroller/');
    await page.getByRole('button',{name:'Customize dice',exact:true}).click();
    await expect(page.locator('.profile-dialog .preview-canvas')).toBeVisible();
    const patterns = page.getByRole('group',{name:'Pattern',exact:true});
    const fonts = page.getByRole('group',{name:'Font style',exact:true});
    for (const name of ['Solid','Speckle','Marble','Frosted']) {
      const button = patterns.getByRole('button',{name,exact:true});
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed','true');
    }
    const snapshots = await patterns.locator('canvas').evaluateAll(canvases => canvases.map(c => c.toDataURL()));
    expect(new Set(snapshots).size).toBe(4);
    await page.getByRole('slider',{name:'Dice color lightness',exact:true}).fill('0');
    await expect.poll(() => patterns.locator('canvas').first().evaluate(c => Array.from(c.getContext('2d').getImageData(128,128,1,1).data))).toEqual([0,0,0,255]);
    expect(await patterns.locator('canvas').evaluateAll(canvases => canvases.map(c => c.toDataURL()))).not.toEqual(snapshots);
    for (const name of ['Serif','Modern','Rune','Gothic']) {
      const button = fonts.getByRole('button',{name,exact:true});
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect(button.locator('svg text')).toHaveText('01');
      expect((await button.locator('svg').boundingBox()).height).toBe(54);
      expect(await button.locator('svg text').evaluate(el => document.fonts.check(`${getComputedStyle(el).fontWeight} 32px ${getComputedStyle(el).fontFamily}`))).toBe(true);
    }
    for (const [dialogClass, closeName, openName] of [['profile-dialog','Close customization','Customize dice'],['social-dialog','Close social menu','Open social menu']]) {
      if (dialogClass === 'social-dialog') await page.getByRole('button',{name:openName,exact:true}).click();
      const dialog = page.locator('.'+dialogClass);
      await dialog.evaluate(el => el.scrollTop = el.scrollHeight);
      const close = page.getByRole('button',{name:closeName,exact:true});
      const bounds = await close.boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);
      expect(await close.evaluate(el => {const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      if (width===430 && dialogClass==='profile-dialog') await page.screenshot({path:'/tmp/powerroller-swatches.png'});
      await close.click();
      await expect(dialog).not.toBeVisible();
    }
    await page.close();
  }
  console.log('PASS: live distinct pattern swatches, selectable SVG font samples, visible close controls after scroll at phone/short sizes');
} finally { await browser.close(); }
