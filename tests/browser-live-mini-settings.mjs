// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
let display, browser;
if (!process.env.DISPLAY) {
  const number = Array.from({length:100}, (_,i) => i + 170).find(i => !existsSync(`/tmp/.X11-unix/X${i}`));
  if (!number) throw new Error('No free test display');
  process.env.DISPLAY = `:${number}`;
  display = spawn('Xvfb', [process.env.DISPLAY, '-screen', '0', '1280x900x24', '-nolisten', 'tcp'], {stdio:'ignore'});
  for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${number}`); i++) await new Promise(resolve => setTimeout(resolve,100));
}
try {
  browser = await chromium.launch({headless:false});
  const context = await browser.newContext();
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const address = process.env.URL || 'http://127.0.0.1:9604/powerroller/';
  const page = await context.newPage();
  await page.goto(address);
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  const initialRoom = new URL(page.url()).searchParams.get('room');
  const http = new ConvexHttpClient('https://nautical-partridge-636.convex.cloud');
  const view = key => http.query(makeFunctionReference('diceDemoV2:view'),{key});
  async function openTray() {
    await page.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
    const mini = context.pages().find(p => p !== page && !p.isClosed());
    const tray = mini.frameLocator('iframe');
    await expect(tray.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
    return {mini,tray};
  }
  let {mini,tray} = await openTray();
  const cog = tray.getByRole('button',{name:'Open tray settings',exact:true});
  await cog.click();
  const menu = tray.getByRole('dialog',{name:'Settings',exact:true});
  const sharing = menu.getByRole('tab',{name:'Sharing',exact:true});
  const dice = menu.getByRole('tab',{name:'Dice',exact:true});
  await expect(sharing).toHaveAttribute('aria-selected','true');
  await expect(menu.getByLabel('Table code',{exact:true})).toHaveValue(initialRoom);
  await expect(menu.getByLabel('Table link',{exact:true})).toHaveValue(page.url());
  await menu.getByRole('textbox',{name:'Display name'}).fill('PiP Settings Check');
  await expect.poll(async () => (await view(initialRoom)).participants.some(p => p.name === 'PiP Settings Check')).toBe(true);
  await sharing.press('ArrowRight');
  await expect(dice).toBeFocused();
  await expect(menu.getByRole('tabpanel',{name:'Sharing',exact:true})).toBeHidden();
  await menu.getByRole('tab',{name:'Design',exact:true}).click();
  await menu.getByRole('button',{name:'Marble',exact:true}).click();
  await menu.getByRole('button',{name:'Rune',exact:true}).click();
  await expect.poll(async () => {
    const members = (await view(initialRoom)).participants;
    return members.length === 1 && members[0].style.pattern === 'marble' && members[0].style.font === 'rune';
  }).toBe(true);
  await page.getByRole('button',{name:'Customize dice',exact:true}).click();
  await page.getByRole('tab',{name:'Design',exact:true}).click();
  await expect(page.getByRole('button',{name:'Marble',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Rune',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Close customization',exact:true}).click();
  await menu.getByText('Accessibility',{exact:true}).click();
  await menu.getByRole('combobox',{name:/Motion/}).selectOption('reduce');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.motion)).toBe('reduce');
  await dice.press('ArrowLeft');
  await expect(sharing).toBeFocused();
  await sharing.press('Escape');
  await expect(menu).toBeHidden();
  await expect(cog).toBeFocused();
  await mini.setViewportSize({width:360,height:320});
  expect(await tray.locator('.stage-label').evaluate(label => {
    const sound = document.querySelector('.sound-toggle').getBoundingClientRect();
    const settings = document.querySelector('.mini-settings-trigger').getBoundingClientRect();
    return label.getBoundingClientRect().right <= sound.left && sound.right < settings.left && settings.right <= innerWidth;
  })).toBe(true);
  await cog.click();
  await dice.click();
  await menu.getByRole('tab',{name:'Design',exact:true}).click();
  expect(await menu.evaluate(dialog => {
    const r = dialog.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && dialog.scrollHeight > dialog.clientHeight;
  })).toBe(true);
  await menu.getByRole('button',{name:'Rune',exact:true}).scrollIntoViewIfNeeded();
  await menu.getByRole('button',{name:'Close settings',exact:true}).click();
  await cog.click();
  await expect(sharing).toHaveAttribute('aria-selected','true');
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(address);
  await expect(other.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  const destination = new URL(other.url()).searchParams.get('room');
  await menu.getByRole('textbox',{name:'Room code or link'}).fill(destination);
  await menu.getByRole('button',{name:'Join',exact:true}).click();
  await expect.poll(() => mini.isClosed()).toBe(true);
  await expect(page.locator('.stage-label')).toContainText('2 / 8',{timeout:30000});
  await expect.poll(async () => (await view(initialRoom)).participants.some(p => p.name === 'PiP Settings Check')).toBe(false);
  await expect.poll(async () => (await view(destination)).participants.some(p => p.name === 'PiP Settings Check')).toBe(true);
  expect(new URL(page.url()).searchParams.get('room')).toBe(destination);
  ({mini,tray} = await openTray());
  await tray.getByRole('button',{name:'Open tray settings',exact:true}).click();
  await tray.getByRole('button',{name:'Leave table',exact:true}).click();
  await expect.poll(() => mini.isClosed()).toBe(true);
  await expect(page.locator('.stage-label')).toContainText('1 / 8',{timeout:30000});
  await expect.poll(async () => (await view(destination)).participants.some(p => p.name === 'PiP Settings Check')).toBe(false);
  expect(new URL(page.url()).searchParams.get('room')).not.toBe(destination);
  await otherContext.close();
  expect(errors).toEqual([]);
  console.log('PASS: built native PiP cog/tabs/Escape/focus; canonical table links; name/design/preference persisted and shared with main; small-window spacing/scroll/reopen; PiP join/leave closes floating tray and switches main table with persisted membership readback; no page errors.');
} finally { await browser?.close(); display?.kill(); }
