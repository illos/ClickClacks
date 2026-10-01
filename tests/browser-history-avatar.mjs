// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
const url = 'http://127.0.0.1:9594/powerroller/';
try {
  const owner = await browser.newPage({viewport:{width:430,height:932}});
  const peer = await browser.newPage({viewport:{width:430,height:932}});
  for (const page of [owner, peer]) {
    await page.addInitScript(() => {
      if (!localStorage.getItem('powerroller.preferences.v2')) localStorage.setItem('powerroller.preferences.v2', JSON.stringify({version:2, preferences:{hidden:true, motion:'reduce', announcements:'off', highContrast:false}}));
    });
  }
  await owner.goto(url);
  await expect(owner.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await owner.getByRole('button',{name:'Open social menu',exact:true}).click();
  const code = await owner.getByLabel('Table code',{exact:true}).inputValue();
  await owner.getByRole('button',{name:'Close social menu',exact:true}).click();
  await peer.goto(url+'?room='+code.trim());
  await expect(peer.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await owner.getByRole('button',{name:'Roll',exact:true}).click();
  for (const page of [owner,peer]) await expect(page.locator('.roll-log-entry')).toHaveCount(1,{timeout:16000});
  const result = await owner.locator('.roll-result-line').innerText();
  const avatar = page => page.locator('.roll-log-entry .roll-avatar');
  const original = await avatar(owner).locator('path').first().getAttribute('fill');
  await owner.getByRole('button',{name:'Customize dice',exact:true}).click();
  await owner.getByRole('slider',{name:'Dice color lightness',exact:true}).fill('0');
  await expect(avatar(owner).locator('path').first()).toHaveAttribute('fill','#000000');
  await expect(avatar(peer).locator('path').first()).toHaveAttribute('fill','#000000',{timeout:10000});
  expect(original).not.toBe('#000000');
  await owner.getByRole('button',{name:'Numbers',exact:true}).click();
  await owner.getByRole('slider',{name:'Number color lightness',exact:true}).fill('100');
  await expect(avatar(owner).locator('text')).toHaveAttribute('fill','#ffffff');
  await expect(avatar(peer).locator('text')).toHaveAttribute('fill','#ffffff',{timeout:10000});
  await owner.getByRole('combobox',{name:'Font style',exact:true}).selectOption('gothic');
  await expect(avatar(owner).locator('text')).toHaveCSS('font-family','"Dice New Rocker"');
  await expect(avatar(peer).locator('text')).toHaveCSS('font-family','"Dice New Rocker"',{timeout:10000});
  await owner.getByRole('button',{name:'Close customization',exact:true}).click();
  expect(await owner.locator('.roll-result-line').innerText()).toBe(result);
  await owner.reload();
  await expect(owner.locator('.roll-log-entry')).toHaveCount(1,{timeout:10000});
  await expect(avatar(owner).locator('path').first()).toHaveAttribute('fill','#000000');
  await expect(avatar(owner).locator('text')).toHaveAttribute('fill','#ffffff');
  expect(await owner.locator('.roll-result-line').innerText()).toBe(result);
  console.log('PASS: existing history avatars update color/ink/font; peer receives changes; reload preserves current design and roll result');
} finally { await browser.close(); }
