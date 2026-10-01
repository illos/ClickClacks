// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

let display;
if (!process.env.DISPLAY) {
  const number = Array.from({length:100}, (_,i) => i + 170).find(i => !existsSync(`/tmp/.X11-unix/X${i}`));
  process.env.DISPLAY = `:${number}`;
  display = spawn('Xvfb', [process.env.DISPLAY, '-screen', '0', '1280x900x24', '-nolisten', 'tcp'], {stdio:'ignore'});
  for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${number}`); i++) await new Promise(resolve => setTimeout(resolve,100));
}
const browser = await chromium.launch({headless:false});
try {
  const context = await browser.newContext();
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.addInitScript(() => {
    window.profileWrites = [];
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'powerroller.preferences.v2') {
        const profile = JSON.parse(value)?.preferences?.profile;
        window.profileWrites.push({time:performance.now(), profile});
      }
      return write.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const address = process.env.URL ?? 'http://127.0.0.1:9605/powerroller/';
  await page.goto(address);
  await expect(page.getByRole('button', {name:'Roll', exact:true})).toBeEnabled({timeout:30000});
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.profile);
  const initial = await read();
  expect(initial.name).not.toBe('Player');
  await page.getByRole('button', {name:'Pop out dice tray', exact:true}).click();
  const mini = context.pages().find(candidate => candidate !== page);
  expect(mini).toBeTruthy();
  await expect(mini.frameLocator('iframe').getByRole('button', {name:'Roll', exact:true})).toBeEnabled({timeout:30000});
  const miniFrame = mini.frames().find(frame => frame.url().includes('/pip/web/popout/tray.html'));
  expect(miniFrame).toBeTruthy();
  await page.getByRole('button', {name:'Customize dice', exact:true}).click();
  const lightness = page.getByRole('slider', {name:'Die color lightness', exact:true});
  const lightnessBox = await lightness.boundingBox();
  await lightness.click({position:{x:lightnessBox.width / 2, y:lightnessBox.height / 2}});
  const wheel = page.getByRole('slider', {name:'Die color wheel', exact:true});
  const box = await wheel.boundingBox();
  expect(box).toBeTruthy();
  await page.evaluate(() => { window.profileWrites = []; });
  // Real pointer capture and rapid pointermove events reproduce the reported A→B drag.
  const start = {x:box.x + box.width * .5, y:box.y + box.height * .3};
  const end = {x:box.x + box.width * .85, y:box.y + box.height * .6};
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, {steps:40});
  const input = await context.newCDPSession(page);
  await Promise.all(Array.from({length:100}, (_,index) => {
    const portion = (index + 1) / 100;
    return input.send('Input.dispatchMouseEvent', {type:'mouseMoved', buttons:1,
      x:start.x + (end.x - start.x) * portion, y:start.y + (end.y - start.y) * portion});
  }));
  await page.mouse.up();
  await page.waitForTimeout(500);
  const final = await read();
  const count = await page.evaluate(() => window.profileWrites.length);
  await page.waitForTimeout(500);
  const after = await read();
  const countAfter = await page.evaluate(() => window.profileWrites.length);
  console.log('Drag settlement', {count, countAfter, finalColor:final.style.color, afterColor:after.style.color});
  expect(countAfter, 'released drag must stop writing preferences').toBe(count);
  expect(after).toEqual(final);
  expect(final.style.color).not.toBe(initial.style.color);
  await expect(wheel).toHaveAttribute('aria-valuenow', '106');
  await expect(mini.frameLocator('iframe').locator('.roll-button-group')).toHaveCSS('background-color',
    await page.locator('.roll-button-group').evaluate(element => getComputedStyle(element).backgroundColor));

  // A second document sends actual queued storage events. Receiving settings must
  // update the UI without emitting another local profile write.
  const sender = await context.newPage();
  await sender.goto(new URL('dice-font-licenses.txt', address).href);
  const beforeExternal = await page.evaluate(() => window.profileWrites.length);
  const miniBeforeExternal = await miniFrame.evaluate(() => window.profileWrites.length);
  const external = {...final, name:'Athena', style:{...final.style, color:'#1267ab'}};
  await sender.evaluate(profile => {
    const key = 'powerroller.preferences.v2';
    const value = JSON.parse(localStorage.getItem(key));
    value.preferences.profile = profile;
    localStorage.setItem(key, JSON.stringify(value));
  }, external);
  await expect(page.locator('.roll-button-group')).toHaveCSS('background-color', 'rgb(18, 103, 171)');
  await expect(mini.frameLocator('iframe').locator('.roll-button-group')).toHaveCSS('background-color', 'rgb(18, 103, 171)');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.profileWrites.length), 'incoming profile must not echo to storage').toBe(beforeExternal);
  expect(await read()).toEqual(external);
  expect(await miniFrame.evaluate(() => window.profileWrites.length), 'PiP receives profile snapshots without writing them back').toBe(miniBeforeExternal);
  await page.getByRole('button', {name:'Close customization', exact:true}).click();
  await page.getByRole('button', {name:'Open social menu', exact:true}).click();
  await expect(page.getByRole('textbox', {name:'Display name', exact:true})).toHaveValue('Athena');
  await page.getByRole('textbox', {name:'Display name', exact:true}).fill('Hector');
  const renamed = {...external, name:'Hector'};
  expect(await read()).toEqual(renamed);
  expect(await page.evaluate(() => window.profileWrites.length), 'one local name edit is saved once under StrictMode').toBe(beforeExternal + 1);
  await page.getByRole('button', {name:'Close social menu', exact:true}).click();
  await page.reload();
  await expect(page.locator('.roll-button-group')).toHaveCSS('background-color', 'rgb(18, 103, 171)');
  await page.waitForTimeout(500);
  expect(await read()).toEqual(renamed);
  expect(errors).toEqual([]);
  console.log('PASS: real wheel drag settles, generated/local names persist, external and PiP profile updates without echo, reload restores final profile');
} finally {
  await browser.close();
  display?.kill();
}
