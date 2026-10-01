// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { unpackTrack } from '../web/dice-demo/motion-codec.ts';
const endpoint='https://nautical-partridge-636.convex.cloud', url='http://127.0.0.1:9594/powerroller/';
const browser=await chromium.launch(), http=new ConvexHttpClient(endpoint);
try {
  const owner=await browser.newPage({viewport:{width:430,height:932}}), peer=await browser.newPage({viewport:{width:390,height:844}});
  await owner.goto(url);
  await expect(owner.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  await owner.getByRole('button',{name:'Open social menu',exact:true}).click();
  const key=(await owner.getByLabel('Table code',{exact:true}).inputValue()).trim();
  await owner.getByRole('button',{name:'Close social menu',exact:true}).click();
  await peer.goto(url+'?room='+key);
  await expect(peer.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  const identity=await owner.evaluate(endpoint=>JSON.parse(sessionStorage.getItem('powerroller.identity.v1:'+endpoint)),endpoint);
  for(const [sides,bonus,hidden] of [[20,true,false],[10,true,false],[6,true,true],[6,false,true]]) {
    if(hidden) {
      await owner.getByRole('button',{name:'Customize dice',exact:true}).click();
      if (await owner.locator('details').getAttribute('open') === null) await owner.locator('details summary').click();
      await owner.getByLabel('Hide 3D dice',{exact:true}).check();
      await owner.getByRole('button',{name:'Close customization',exact:true}).click();
    }
    await owner.getByRole('button',{name:'Select dice',exact:true}).click();
    await owner.getByRole('menuitemradio',{name:'d'+sides,exact:true}).click();
    const toggle=owner.getByRole('button',{name:'+1d4',exact:true});
    if((await toggle.getAttribute('aria-pressed')==='true')!==bonus) await toggle.click();
    if (sides===6 && bonus) await owner.locator('[data-roll-modifier="edge"]').click();
    const before=await owner.locator('.roll-log-entry').count();
    await expect(owner.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:16000});
    await owner.getByRole('button',{name:'Roll',exact:true}).click();
    for(const page of [owner,peer]) await expect(page.locator('.roll-log-entry')).toHaveCount(before+1,{timeout:16000});
    const encoded=await http.query(makeFunctionReference('diceDemoV2:track'),{key,viewer:identity.viewer});
    const roll=unpackTrack(encoded).roll;
    expect(roll.dice).toEqual({kind:'dice',sides,count:1,...(bonus?{bonusD4:true}:{})});
    expect(roll.faces).toHaveLength(bonus?2:1);
    expect(roll.faces[0]).toBeGreaterThanOrEqual(1);expect(roll.faces[0]).toBeLessThanOrEqual(sides);
    if(bonus) {expect(roll.faces[1]).toBeGreaterThanOrEqual(1);expect(roll.faces[1]).toBeLessThanOrEqual(4);}
    expect(roll.total).toBe(roll.faces.reduce((sum,n)=>sum+n,0)+(sides===6 && bonus?2:0));
    if(hidden) expect(roll.motion).toBeUndefined();
    else {expect(roll.motion.samples.length).toBeGreaterThan(0);expect(roll.motion.offsets).toHaveLength(4*roll.faces.length);}
    const ownerText=(await owner.locator('.roll-log-entry').first().innerText()).replace(' · you','');
    expect((await peer.locator('.roll-log-entry').first().innerText()).replace(' · you','')).toBe(ownerText);
    console.log(`PASS live: d${sides}${bonus?' +1d4':''}, ${hidden?'text':'animated'}, persisted faces ${roll.faces}, total ${roll.total}`);
  }
  await owner.reload();
  await expect(owner.locator('.roll-log-entry')).toHaveCount(4,{timeout:10000});
  console.log('PASS: four accepted results restored from local history');
}finally{await browser.close();}
