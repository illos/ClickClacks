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
  await context.addInitScript(() => {
    window.logMoves = [];
    window.audioContexts = 0; window.audioStarts = 0;
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      constructor(...args) { super(...args); window.audioContexts++; }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args) => { window.audioStarts++; return start(...args); };
        return source;
      }
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      if (this.classList.contains('roll-log-row')) window.logMoves.push({key:this.dataset.logKey, frames, options});
      return animate.call(this, frames, options);
    };
  });
  const page = await context.newPage();
  const address = process.env.URL || 'http://127.0.0.1:9603/powerroller/';
  await page.goto(address);
  const rollMain = page.getByRole('button',{name:'Roll',exact:true});
  await expect(rollMain).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Select dice',exact:true}).click();
  await page.getByRole('menuitemradio',{name:'d6',exact:true}).click();
  await page.getByRole('button',{name:'Add die',exact:true}).click();
  await page.getByRole('button',{name:/Positive modifier/}).click();
  const session = await page.evaluate(() => ({
    key:new URL(location.href).searchParams.get('room'),
    identity:JSON.parse(sessionStorage.getItem('powerroller.identity.v1:https://nautical-partridge-636.convex.cloud')),
  }));
  const http = new ConvexHttpClient('https://nautical-partridge-636.convex.cloud');
  await page.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
  await expect(page.getByRole('button',{name:'Focus dice tray',exact:true})).toHaveAttribute('aria-pressed','true');
  const mini = context.pages().find(p => p !== page);
  expect(mini).toBeTruthy();
  await mini.setViewportSize({width:480,height:420});
  const tray = mini.frameLocator('iframe');
  const roll = tray.getByRole('button',{name:'Roll',exact:true});
  await expect(roll).toBeEnabled({timeout:30000});
  const frame = mini.frames().find(f => f.url().includes('/pip/web/popout/tray.html'));
  expect(frame).toBeTruthy();
  await expect(tray.locator('.stage canvas')).toBeVisible();
  await expect(tray.locator('.lab-header')).toBeHidden();
  await expect(tray.getByRole('region',{name:'Roll log',includeHidden:true})).toBeHidden();
  const room = await http.query(makeFunctionReference('diceDemoV2:view'),{key:session.key});
  expect(room.participants).toHaveLength(1);
  expect(room.participants[0].id).toBe(session.identity.viewer);
  await expect(tray.getByRole('status',{name:'Number of dice',exact:true})).toHaveText('2');
  await expect(tray.getByRole('button',{name:/Positive modifier/})).toHaveText('+2');
  await tray.getByRole('button',{name:'Add die',exact:true}).click();
  await expect(page.getByRole('status',{name:'Number of dice',exact:true})).toHaveText('3');
  await page.getByRole('button',{name:'Remove die',exact:true}).click();
  await expect(tray.getByRole('status',{name:'Number of dice',exact:true})).toHaveText('2');
  await tray.getByRole('button',{name:'+1d4',exact:true}).click();
  await expect(page.getByRole('button',{name:'+1d4',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'+1d4',exact:true}).click();
  await expect(tray.getByRole('button',{name:'+1d4',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Customize dice',exact:true}).click();
  await page.getByRole('tab',{name:'Design',exact:true}).click();
  await page.getByRole('button',{name:'Marble',exact:true}).click();
  await page.getByRole('button',{name:'Close customization',exact:true}).click();
  await expect.poll(async () => (await http.query(makeFunctionReference('diceDemoV2:view'),{key:session.key})).participants[0].style.pattern).toBe('marble');
  await tray.getByRole('button',{name:'Dice sounds',exact:true}).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('powerroller.preferences.v2')).preferences.selectedDice)).toBe(6);
  const history = tray.getByRole('region',{name:'Recent tray rolls'});
  // Seven actual backend rolls prove the PiP cap and the uncapped main log together.
  let firstKey;
  for (let i = 0; i < 7; i++) {
    const previous = i ? await history.locator('.tray-history-row').first().getAttribute('data-history-key') : null;
    await expect(roll).toBeEnabled({timeout:15000});
    await roll.click();
    // The accessible name changes to "Roll (cooldown)" while disabled.
    await expect(page.locator('.roll-button-group .primary')).toBeDisabled();
    if (previous) {
      try { await expect(history.locator('.tray-history-row').first()).not.toHaveAttribute('data-history-key',previous,{timeout:15000}); }
      catch (error) {
        const current = await http.query(makeFunctionReference('diceDemoV2:track'),{key:session.key,viewer:session.identity.viewer});
        console.log('Roll diagnostic', {index:i, previous, current:current?.roll?.id, startsAt:current?.roll?.startsAt,
          duration:current?.roll?.duration, errors:await tray.getByRole('alert').allTextContents(), parentErrors:await page.getByRole('alert').allTextContents(),
          hidden:await frame.evaluate(() => document.hidden)});
        throw error;
      }
    }
    await expect(history.locator('.tray-history-row')).toHaveCount(Math.min(i+1,6),{timeout:15000});
    if (!i) firstKey = await history.locator('.tray-history-row').first().getAttribute('data-history-key');
    await expect(page.locator('.track-results .roll-log-entry')).toHaveCount(i+1,{timeout:15000});
  }
  expect(await history.locator('.tray-history-row').evaluateAll(rows => rows.map(row => row.dataset.historyKey))).not.toContain(firstKey);
  const persisted = await http.query(makeFunctionReference('diceDemoV2:track'),{key:session.key,viewer:session.identity.viewer});
  expect(persisted.roll.faces).toHaveLength(2);
  expect(persisted.roll.dice.sides).toBe(6);
  expect(persisted.roll.styles[0].pattern).toBe('marble');
  expect(persisted.roll.total).toBe(persisted.roll.faces.reduce((a,b) => a+b,0));
  await expect(history.locator('.roll-total').first()).toHaveText(String(persisted.roll.total));
  expect(await frame.evaluate(() => window.audioStarts)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.audioContexts)).toBe(0); // Only the floating window owns audio.
  expect(await frame.evaluate(() => {
    const host = document.querySelector('.canvas-host'), overlay = document.querySelector('.tray-history');
    return document.querySelector('.stage canvas').getContext('webgl2').getContextAttributes().alpha
      && Number(getComputedStyle(host).zIndex) > Number(getComputedStyle(overlay).zIndex)
      && getComputedStyle(overlay).pointerEvents === 'none';
  })).toBe(true);
  await page.setViewportSize({width:430,height:600});
  const log = page.getByRole('region',{name:'Roll log',exact:true});
  await expect(log).toHaveAttribute('data-bottom-fade','true');
  expect(await log.evaluate(el => getComputedStyle(el).maskImage)).toContain('calc(100% - 48px)');
  expect(await page.evaluate(() => window.logMoves.some(move => move.frames[0].transform.includes('translateY(-') && move.options.duration === 360))).toBe(true);
  expect(await log.locator('.roll-log-row').evaluateAll(rows => rows.every(row => getComputedStyle(row).opacity === '1'))).toBe(true);
  expect(await log.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await log.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(log).toHaveAttribute('data-bottom-fade','false');
  expect(await log.evaluate(el => getComputedStyle(el).maskImage)).toBe('none');
  await mini.setViewportSize({width:360,height:320});
  expect(await frame.evaluate(() => {
    const rect = document.querySelector('.roll-button-group').getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
  })).toBe(true);
  await mini.close();
  await expect(page.getByRole('button',{name:'Pop out dice tray',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
  const reopened = context.pages().find(p => p !== page);
  await expect(reopened.frameLocator('iframe').getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await expect(reopened.frameLocator('iframe').locator('.tray-history-row')).toHaveCount(6);
  expect((await http.query(makeFunctionReference('diceDemoV2:view'),{key:session.key})).participants).toHaveLength(1);
  await reopened.close();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => { window.logMoves = []; });
  await expect(rollMain).toBeEnabled({timeout:15000});
  await rollMain.click();
  await expect(log.locator('.roll-log-entry')).toHaveCount(8,{timeout:15000});
  expect(await page.evaluate(() => window.logMoves)).toHaveLength(0);
  await page.getByRole('button',{name:'Open settings',exact:true}).click();
  await page.getByText('Accessibility',{exact:true}).click();
  await page.getByRole('checkbox',{name:'High contrast',exact:true}).check();
  await page.getByRole('combobox',{name:'Motion',exact:true}).selectOption('reduce');
  await expect(page.locator('.lab.v2')).toHaveClass(/high-contrast/);
  expect(await log.evaluate(el => getComputedStyle(el).maskImage)).toBe('none');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
  const departing = context.pages().find(p => p !== page);
  await expect(departing.frameLocator('iframe').getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await expect(departing.frameLocator('iframe').locator('.tray-history')).toHaveAttribute('data-motion','reduce');
  expect(await departing.frameLocator('iframe').locator('.tray-history-row').evaluateAll(rows => rows.every(row => getComputedStyle(row).opacity === '1'))).toBe(true);
  await page.getByRole('button',{name:'Open social menu',exact:true}).click();
  await page.getByRole('button',{name:'Leave table',exact:true}).click();
  await expect.poll(() => departing.isClosed()).toBe(true);
  await expect(log.locator('.roll-log-entry')).toHaveCount(0);
  await expect(rollMain).toBeEnabled({timeout:30000});
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => Object.defineProperty(window,'documentPictureInPicture',{value:undefined}));
  await unsupported.goto(address);
  await expect(unsupported.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await expect(unsupported.getByRole('button',{name:/Pop out dice tray|Focus dice tray/})).toHaveCount(0);
  const mobile = await browser.newContext({isMobile:true,hasTouch:true,viewport:{width:430,height:932}});
  const phone = await mobile.newPage();
  await phone.goto(address);
  await expect(phone.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await expect(phone.getByRole('button',{name:/Pop out dice tray|Focus dice tray/})).toHaveCount(0);
  await mobile.close();
  const failedContext = await browser.newContext();
  const modulePattern = /\/pip\/assets\/main-[^/]+\.js(?:\?|$)/;
  await failedContext.route(modulePattern, route => route.abort('failed'));
  const failedPage = await failedContext.newPage();
  await failedPage.goto(address);
  await expect(failedPage.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await failedPage.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
  await expect(failedPage.getByRole('alert')).toContainText('could not load');
  await failedContext.unroute(modulePattern);
  await failedPage.getByRole('button',{name:'Pop out dice tray',exact:true}).click();
  const retried = failedContext.pages().find(p => p !== failedPage);
  await expect(retried.frameLocator('iframe').getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await failedContext.close();
  expect(errors).toEqual([]);
  console.log('PASS: built live Document PiP; current table and one player; transient controls/shared cooldown/design sync and one audio owner; seven real rolls/readback; six-row overlay and full main log; slide/down motion and bottom-only fade; vertical containment; reduced-motion/high-contrast; close/reopen/table departure; mobile/unsupported icon hidden; module failure/retry; no startup errors.');
} finally {
  await browser?.close(); display?.kill();
}
