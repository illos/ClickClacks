// SPDX-License-Identifier: MIT
import {chromium,expect} from '@playwright/test';
import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
const backend='https://nautical-partridge-636.convex.cloud',url='http://127.0.0.1:9594/powerroller/';
const browser=await chromium.launch(),http=new ConvexHttpClient(backend);
const view=key=>http.query(makeFunctionReference('diceDemoV2:view'),{key});
async function social(page){await page.getByRole('button',{name:'Open social menu',exact:true}).click();}
async function code(page){await social(page);const value=await page.getByLabel('Table code',{exact:true}).inputValue();await page.getByRole('button',{name:'Close social menu',exact:true}).click();return value.trim();}
try{
  const a=await browser.newPage({viewport:{width:430,height:932}}),b=await browser.newPage({viewport:{width:390,height:844}});
  for(const page of [a,b])await page.addInitScript(()=>{if(!localStorage.getItem('powerroller.preferences.v2'))localStorage.setItem('powerroller.preferences.v2',JSON.stringify({version:2,preferences:{hidden:true,motion:'reduce',announcements:'off',highContrast:false}}));});
  for(const page of [a,b]){await page.goto(url);await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});}
  const shared=await code(a),previous=await code(b);
  const identity=await b.evaluate(endpoint=>JSON.parse(sessionStorage.getItem('powerroller.identity.v1:'+endpoint)),backend);
  await social(b);await b.getByLabel('Display name',{exact:true}).fill('Sappho');
  await b.getByLabel('Room code or link',{exact:true}).fill('ZZZZZZZZ');
  await b.getByRole('button',{name:'Join',exact:true}).click();
  await expect(b.getByRole('alert')).toHaveText('That table is unavailable or has expired.');
  expect((await view(previous)).participants.some(p=>p.id===identity.viewer)).toBe(true);
  await b.getByLabel('Room code or link',{exact:true}).fill(shared);
  await b.getByRole('button',{name:'Join',exact:true}).click();
  await expect(a.getByText('2 / 8 participants',{exact:true})).toBeVisible({timeout:10000});
  expect((await view(previous)).participants.some(p=>p.id===identity.viewer)).toBe(false);
  await b.getByRole('button',{name:'Customize dice',exact:true}).click();
  await b.getByRole('slider',{name:'Die color lightness',exact:true}).fill('0');
  await b.getByRole('button',{name:'Close customization',exact:true}).click();
  await expect(b.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:10000});
  await b.getByRole('button',{name:'Select dice',exact:true}).click();
  await expect(b.getByRole('menu',{name:'Dice to roll',exact:true})).toBeVisible();
  await b.getByRole('button',{name:'Roll',exact:true}).click();
  await expect(b.getByRole('menu',{name:'Dice to roll',exact:true})).toHaveCount(0);
  await expect(a.locator('.roll-log-entry')).toHaveCount(1,{timeout:10000});
  await social(b);await b.getByRole('button',{name:'Leave table',exact:true}).click();
  await expect(b.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:10000});
  const solo=await code(b);expect(solo).not.toBe(shared);
  expect((await view(shared)).participants.some(p=>p.id===identity.viewer)).toBe(false);
  expect(await http.query(makeFunctionReference('diceDemoV2:track'),{key:shared,viewer:identity.viewer})).toBeNull();
  await expect(b.locator('.roll-log-entry')).toHaveCount(0);
  await a.getByRole('button',{name:'Roll',exact:true}).click();
  await expect(a.locator('.roll-log-entry')).toHaveCount(2,{timeout:10000});
  await b.waitForTimeout(11000); // Cross the old 10-second heartbeat interval: leaving must stay left.
  expect((await view(shared)).participants.some(p=>p.id===identity.viewer)).toBe(false);
  await expect(b.locator('.roll-log-entry')).toHaveCount(0);
  await b.reload();await expect(b.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:10000});
  expect(await code(b)).toBe(solo);
  await social(b);await expect(b.getByLabel('Display name',{exact:true})).toHaveValue('Sappho');
  await b.getByRole('button',{name:'Close social menu',exact:true}).click();
  await b.getByRole('button',{name:'Customize dice',exact:true}).click();
  await expect(b.getByRole('tab',{name:'Die color',exact:true}).locator('.color-swatch')).toHaveCSS('background-color','rgb(0, 0, 0)');
  await b.getByRole('button',{name:'Close customization',exact:true}).click();
  await social(b);await b.getByLabel('Room code or link',{exact:true}).fill(shared);await b.getByRole('button',{name:'Join',exact:true}).click();
  await expect(b.locator('.roll-log-entry')).toHaveCount(2,{timeout:10000});
  expect((await view(solo)).participants.some(p=>p.id===identity.viewer)).toBe(false);
  await social(b);await expect(b.getByLabel('Display name',{exact:true})).toHaveValue('Sappho');
  console.log('PASS: joining/leaving removes old membership/track, no heartbeat rejoin, isolated solo log, saved room/profile/design survive reload, original table can be rejoined');
}finally{await browser.close();}
