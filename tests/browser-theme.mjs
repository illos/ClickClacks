// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit, expect } from '@playwright/test';
let display, browser;
if (!process.env.DISPLAY) {
  const number = Array.from({length:100}, (_,i) => i + 170).find(i => !existsSync(`/tmp/.X11-unix/X${i}`));
  if (!number) throw new Error('No free test display');
  process.env.DISPLAY = `:${number}`;
  display = spawn('Xvfb', [process.env.DISPLAY, '-screen', '0', '1280x900x24', '-nolisten', 'tcp'], {stdio:'ignore'});
  for (let i=0;i<50&&!existsSync(`/tmp/.X11-unix/X${number}`);i++) await new Promise(resolve=>setTimeout(resolve,100));
}
const address = process.env.URL || 'http://127.0.0.1:9604/powerroller/';
const engine = process.env.ENGINE || 'chromium';
try {
  browser = await ({chromium,firefox,webkit}[engine]).launch({headless:engine!=='chromium'});
  const context = await browser.newContext({colorScheme:'light'});
  const errors = [];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const page = await context.newPage();
  await page.goto(address);
  const main = page.locator('.lab.v2');
  await expect(main).toHaveAttribute('data-theme','light');
  await expect(page.getByRole('button',{name:'Open settings',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  const stored = () => page.evaluate(()=>JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences);
  const original = await stored();
  expect(original.theme).toBe('system');
  async function select(choice) {
    await page.getByRole('button',{name:'Open settings',exact:true}).click();
    const settings = page.getByRole('dialog',{name:'Settings',exact:true});
    await settings.getByRole('radio',{name:choice,exact:true}).check();
    await settings.getByRole('button',{name:'Close settings',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open settings',exact:true})).toBeFocused();
  }
  await expect(page.locator('.canvas-host canvas')).toBeVisible({timeout:30000});
  await page.evaluate(()=>{window.themeCanvas=document.querySelector('.canvas-host canvas');});
  await select('Dark');
  await expect(main).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(main).toHaveAttribute('data-theme','dark');
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(17, 20, 21)');
  await select('System');
  await expect(main).toHaveAttribute('data-theme','light');
  await page.emulateMedia({colorScheme:'dark'});
  await expect(main).toHaveAttribute('data-theme','dark');
  await select('Light');
  await expect(main).toHaveAttribute('data-theme','light');
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(244, 241, 235)');
  await expect(page.locator('.stage')).toHaveCSS('background-color','rgb(247, 248, 244)');
  expect(await page.evaluate(()=>window.themeCanvas===document.querySelector('.canvas-host canvas'))).toBe(true);
  const final = await stored();
  expect(final).toMatchObject({theme:'light',profile:original.profile,selectedDice:original.selectedDice,room:original.room});
  // Hold the application bundle: saved appearance must already be applied by the head bootstrap.
  const pattern=/\/assets\/index-[^/]+\.js(?:\?|$)/;
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  await page.route(pattern,async route=>{await gate;await route.continue();});
  await page.reload({waitUntil:'commit'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  release();
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await page.unroute(pattern);
  await page.getByRole('button',{name:'Open settings',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog',{name:'Settings',exact:true}).press('Escape');
  await expect(page.getByRole('button',{name:'Open settings',exact:true})).toBeFocused();
  // Surface checks include real dialogs and menus, rather than just the document background.
  await page.getByRole('button',{name:'Open settings',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});
  await expect(dialog).toHaveCSS('background-color','rgb(255, 253, 248)');
  await expect(dialog.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
  await dialog.getByRole('radio',{name:'Dark',exact:true}).check();
  await expect(main).toHaveAttribute('data-theme','dark');
  await dialog.getByRole('radio',{name:'Light',exact:true}).check();
  await dialog.getByText('Accessibility',{exact:true}).click();
  await dialog.getByRole('checkbox',{name:'High contrast',exact:true}).check();
  await expect(main).toHaveClass(/high-contrast/);
  await dialog.getByRole('checkbox',{name:'High contrast',exact:true}).uncheck();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.getByRole('button',{name:'Select dice',exact:true}).click();
  await expect(page.getByRole('menu',{name:'Dice to roll',exact:true})).toHaveCSS('background-color','rgb(255, 253, 248)');
  await page.getByRole('menuitemradio',{name:'d6',exact:true}).click();
  if (engine==='chromium') {
    // Palette changes must preserve ongoing playback and its final history result.
    await page.getByRole('button',{name:'Roll',exact:true}).click();
    await select('Dark');
    await select('Light');
    const entry=page.locator('.track-results .roll-log-entry');
    await expect(entry).toHaveCount(1,{timeout:30000});
    await expect(entry.locator('.roll-dice-notation')).toHaveText('1d6');
    const total=Number(await entry.locator('.roll-total').textContent());
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(6);
    await expect(page.locator('.canvas-host canvas')).toBeVisible();
  }
  if (engine==='chromium') {
    await page.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
    const mini=context.pages().find(p=>p!==page);
    const tray=mini.frameLocator('iframe');
    await expect(tray.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
    await expect(tray.locator('.lab.v2')).toHaveAttribute('data-theme','light');
    await expect(mini.locator('html')).toHaveAttribute('data-theme','light');
    await tray.getByRole('button',{name:'Open tray settings',exact:true}).click();
    await tray.getByRole('tab',{name:'Settings',exact:true}).click();
    await tray.getByRole('radio',{name:'Dark',exact:true}).check();
    await expect(main).toHaveAttribute('data-theme','dark');
    await expect(mini.locator('html')).toHaveAttribute('data-theme','dark');
    await tray.getByRole('button',{name:'Close settings',exact:true}).click();
    await select('Light');
    await expect(tray.locator('.lab.v2')).toHaveAttribute('data-theme','light');
    await mini.setViewportSize({width:360,height:320});
    expect(await tray.locator('.lab.v2').evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await mini.close();
  }
  for (const [width,height] of [[1280,900],[430,932],[320,568],[320,225]]) {
    await page.setViewportSize({width,height});
    const layout=await page.locator('.lab-header').evaluate(header=>{
      const r=header.getBoundingClientRect();
      return [...header.querySelectorAll('h1, .theme-control, button.customize-trigger')].every(el=>{
        const box=el.getBoundingClientRect();return box.left>=r.left-1&&box.right<=r.right+1;
      })&&document.documentElement.scrollWidth<=innerWidth;
    });
    expect(layout,`header and page fit ${width}x${height}`).toBe(true);
    await page.getByRole('button',{name:'Open settings',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'Settings',exact:true});
    await expect(menu).toBeVisible();
    expect(await menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})).toBe(true);
    await menu.press('Escape');
  }
  expect(errors).toEqual([]);
  console.log(`PASS ${engine}: default System/live OS changes, explicit override and reload/bootstrap, storage/profile retention, keyboard/focus, light dialogs/picker/highcontrast, no canvas recreation, four viewport fit${engine==='chromium'?', native PiP two-way theme sync':''}.`);
} finally {await browser?.close();display?.kill();}
