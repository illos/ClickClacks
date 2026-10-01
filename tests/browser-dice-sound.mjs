// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  // Observe real AudioContext scheduling without replacing its audio graph/runtime.
  await page.addInitScript(() => {
    window.audioStarts=[];window.audioStops=0;window.audioContexts=[];
    const Context=window.AudioContext;
    window.AudioContext=class extends Context {
      constructor(...args){super(...args);window.audioContexts.push(this);}
      createBufferSource(){
        const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source);
        source.start=(when,...args)=>{const data=source.buffer.getChannelData(0);window.audioStarts.push({when,current:this.currentTime,mono:performance.now(),peak:Math.max(...data.map(Math.abs)),rms:Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length)});return start(when,...args);};
        source.stop=(...args)=>{window.audioStops++;return stop(...args);};return source;
      }
    };
  });
  await page.goto('http://127.0.0.1:9594/powerroller/');
  const toggle=page.getByRole('button',{name:'Dice sounds',exact:true});
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  expect(await page.evaluate(()=>window.audioContexts.length)).toBe(0);
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Roll',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.audioStarts.length),{timeout:20000}).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.audioStarts.every(s=>s.when>=s.current))).toBe(true);
  const eraser=page.getByRole('button',{name:'Clear tray',exact:true});await expect(eraser).toBeVisible();
  const soundBox=await toggle.boundingBox(),eraserBox=await eraser.boundingBox();
  expect(eraserBox.x+eraserBox.width).toBeLessThan(soundBox.x);
  expect(soundBox.y).toBe(eraserBox.y);
  await page.screenshot({path:'/tmp/powerroller-sound-toggle.png'});
  await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','false');
  const starts=await page.evaluate(()=>window.audioStarts.length);
  await page.getByRole('button',{name:'Roll',exact:true}).click();
  await page.waitForTimeout(4500);expect(await page.evaluate(()=>window.audioStarts.length)).toBe(starts);
  await toggle.click();await page.reload();await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
  expect(await page.evaluate(()=>window.audioStarts.length)).toBe(0); // No historical playback.
  await page.getByRole('button',{name:'Roll',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.audioStarts.length),{timeout:20000}).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.audioStarts.every(s=>Number.isFinite(s.rms)&&s.rms>0.01&&s.peak<=0.901))).toBe(true);
  // Real suspend/resume, with Safari's state name simulated on the same context.
  await page.evaluate(async()=>{
    const ctx=window.audioContexts.at(-1);await ctx.suspend();
    const resume=ctx.resume.bind(ctx);let interrupted=true;
    Object.defineProperty(ctx,'state',{configurable:true,get:()=>interrupted?'interrupted':'running'});
    ctx.resume=async()=>{await resume();interrupted=false;};
  });
  const afterReload=await page.evaluate(()=>window.audioStarts.length);
  await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:20000});
  await page.getByRole('button',{name:'Roll',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.audioStarts.length),{timeout:20000}).toBeGreaterThan(afterReload);
  await page.getByRole('button',{name:'Customize dice',exact:true}).click();
  await page.getByRole('tab',{name:'Design',exact:true}).click();
  const pixel=async name=>page.getByRole('button',{name,exact:true}).locator('canvas').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');return [ctx.getImageData(0,128,1,1).data[0],ctx.getImageData(255,128,1,1).data[0]];
  });
  const frost=await pixel('Frosted'),solid=await pixel('Solid');
  expect(frost[1]).toBeGreaterThan(frost[0]);expect(solid[0]).toBe(solid[1]);
  await page.screenshot({path:'/tmp/powerroller-frosted-swatch.png'});
  expect(errors).toEqual([]);
  console.log('PASS: real AudioContext live-roll scheduling; roll after reload; interrupted-context recovery; non-silent finite waveform; mute; local persistence; no historical playback; right-aligned separate tray actions; Frosted gradient; no page errors');
} finally {await browser.close();}
