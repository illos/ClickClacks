// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  // Fresh profiles exercise random naming, initial membership and clock sync.
  for (const hidden of [false, true]) {
    const context = await browser.newContext({viewport:{width:430,height:932},hasTouch:true});
    const page = await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
    if (hidden) await page.addInitScript(() => localStorage.setItem('powerroller.preferences.v2',JSON.stringify({version:2,preferences:{motion:'device',hidden:true,highContrast:false,announcements:'all'}})));
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const resources=[];page.on('request',r=>resources.push(r.url()));
    await page.goto(process.env.URL||'http://127.0.0.1:9595/powerroller/', {waitUntil:'domcontentloaded'});
    // Click on the first enabled DOM update, without waiting for the load event
    // or Playwright polling, which can hide a renderer/startup race.
    const readyAt=await page.evaluate(()=>new Promise(resolve=>{
      const observer=new MutationObserver(click);
      function click(){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Roll');if(button&&!button.disabled){observer.disconnect();const at=performance.now();button.click();resolve(at);}}
      observer.observe(document,{subtree:true,childList:true,attributes:true});click();
    }));
    const session=await page.evaluate(()=>{
      const backend='https://nautical-partridge-636.convex.cloud';
      return {backend, key:new URL(location.href).searchParams.get('room'),identity:JSON.parse(sessionStorage.getItem(`powerroller.identity.v1:${backend}`))};
    });
    const query=async(path,args)=>{
      const response=await fetch(session.backend+'/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,args,format:'json'})});
      const result=await response.json();expect(result.status).toBe('success');return result.value;
    };
    let track;
    await expect.poll(async()=>{track=await query('diceDemoV2:track',{key:session.key,viewer:session.identity.viewer});return track?.roll?.faces.length;},{timeout:20000}).toBe(2);
    if(hidden){expect(track.roll.motion).toBeUndefined();expect(resources.some(url=>/renderer-|three\.module-|physics-worker-|\.woff2/.test(url))).toBe(false);}
    else {expect(track.roll.motion).toBeDefined();await expect(page.locator('.canvas-host canvas')).toHaveCount(1);}
    await expect(page.locator('.roll-log-entry')).toHaveCount(1,{timeout:20000});expect(errors).toEqual([]);
    console.log(`PASS: ${hidden?'hidden 3D':'full 3D'} Roll enabled at ${Math.round(readyAt)}ms; immediate first roll persisted ${hidden?'without graphics loading':'with original recorded motion'} and reached history.`);
    await context.close();
  }
} finally {await browser.close();}
