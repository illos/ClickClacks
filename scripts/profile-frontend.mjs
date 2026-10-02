// SPDX-License-Identifier: MIT
// Bounded, observational lab profiling. Does not log room IDs, identities, RPC arguments or faces.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const address = process.env.URL || 'http://127.0.0.1:9610/powerroller/';
const output = process.env.OUT || '/tmp/clickclacks-frontend-profile.json';
const throttle = process.env.THROTTLE === '1';
const startupOnly = process.env.STARTUP_ONLY === '1';
const timingOnly = process.env.TIMING_ONLY === '1';
let display, browser;
function instrument() {
  const stats = window.frontendProfile = {
    marks: {}, longTasks: [], workers: [], draws: 0, textureCreates: 0, textureDeletes: 0,
    buffersCreated: 0, buffersDeleted: 0, frames: [], mutations: 0, sockets: 0, sampling: false,
    audioContexts: 0, audioContextsClosed: 0, glContexts: 0, glContextsLost: 0,
  };
  for (const type of ['paint', 'largest-contentful-paint', 'longtask']) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (type === 'longtask') stats.longTasks.push({at: entry.startTime, ms: entry.duration});
        else stats.marks[entry.name || type] = entry.startTime;
      }
    }).observe({type, buffered: true});
  }
  let appeared = false, ready = false, canvas = false;
  new MutationObserver(records => {
    stats.mutations += records.length;
    const button = document.querySelector('button.primary');
    if (button && !appeared) { appeared = true; stats.marks.buttonAppeared = performance.now(); }
    if (button && !button.disabled && !ready) { ready = true; stats.marks.buttonReady = performance.now(); }
    if (!canvas && document.querySelector('.canvas-host canvas')) { canvas = true; stats.marks.canvasReady = performance.now(); }
  }).observe(document, {childList: true, subtree: true, attributes: true});
  const Socket = window.WebSocket;
  window.WebSocket = class extends Socket { constructor(...args) { super(...args); stats.sockets++; } };
  const Audio = window.AudioContext;
  if (Audio) window.AudioContext = class extends Audio {
    constructor(...args) { super(...args); stats.audioContexts++; }
    async close() { const live=this.state!=='closed'; const value=await super.close(); if(live) stats.audioContextsClosed++; return value; }
  };
  const knownContexts = new WeakSet();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(...args) {
    const value=getContext.apply(this,args);
    if(value && ['webgl','webgl2','experimental-webgl'].includes(args[0]) && !knownContexts.has(value)) {
      knownContexts.add(value); stats.glContexts++;
      this.addEventListener('webglcontextlost',()=>stats.glContextsLost++);
    }
    return value;
  };
  const Worker = window.Worker;
  window.Worker = class extends Worker {
    constructor(...args) {
      super(...args); const pending = new Map();
      const send = this.postMessage.bind(this);
      this.postMessage = (...values) => { if (values[0]?.id !== undefined) pending.set(values[0].id, {at:performance.now(),faces:values[0].faces?.length ?? 0}); return send(...values); };
      this.addEventListener('message', ({data}) => {
        if (!pending.has(data?.id)) return;
        const sent=pending.get(data.id);
        stats.workers.push({at:sent.at,roundTripMs:performance.now()-sent.at,planningMs:data.planningMs ?? null,requestedFaces:sent.faces,hasMotion:!!data.motion,error:data.error ?? null});
        pending.delete(data.id);
      });
    }
  };
  // Wrappers count calls only: no pixel readback, forced rendering, texture replacement or React hooks.
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    for (const [method, counter] of Object.entries({drawArrays:'draws', drawElements:'draws', createTexture:'textureCreates', deleteTexture:'textureDeletes', createBuffer:'buffersCreated', deleteBuffer:'buffersDeleted'})) {
      const original = Context.prototype[method];
      Context.prototype[method] = function(...args) { stats[counter]++; return original.apply(this, args); };
    }
  }
  let last, generation=0, lastDraws=stats.draws;
  function frame(at, version) {
    if (!stats.sampling || version!==generation) return;
    if(last!==undefined) {
      stats.frames.push(at-last);
      if(stats.draws!==lastDraws) stats.activeFrames.push(at-last);
    }
    last=at;lastDraws=stats.draws;requestAnimationFrame(next=>frame(next,version));
  }
  stats.start = () => { const version=++generation;last=undefined;lastDraws=stats.draws;stats.frames=[];stats.activeFrames=[];stats.sampling=true;requestAnimationFrame(at=>frame(at,version)); };
  stats.stop = () => { stats.sampling=false;generation++; };
}
function summarize(values) {
  const sorted = [...values].sort((a,b) => a-b);
  return {count: sorted.length, medianMs: sorted[Math.floor(sorted.length*.5)] ?? null, p95Ms: sorted[Math.floor(sorted.length*.95)] ?? null,
    maxMs: sorted.at(-1) ?? null, over34ms: sorted.filter(x=>x>34).length, over50ms: sorted.filter(x=>x>50).length};
}
async function snapshot(frame) {
  return frame.evaluate(() => {
    const s = window.frontendProfile;
    return {at: performance.now(), draws:s.draws, textureCreates:s.textureCreates, textureDeletes:s.textureDeletes,
      buffersCreated:s.buffersCreated, buffersDeleted:s.buffersDeleted, mutations:s.mutations,
      audioContexts:s.audioContexts, audioContextsClosed:s.audioContextsClosed, glContexts:s.glContexts, glContextsLost:s.glContextsLost,
      longTasks:[...s.longTasks], workers:[...s.workers], heap:performance.memory?.usedJSHeapSize ?? null,
      visibility:document.visibilityState, historyRows:document.querySelectorAll('.roll-log-entry').length};
  });
}
async function metrics(cdp) { return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])); }
async function phase(frame, cdp, label, milliseconds, action) {
  const before = await snapshot(frame), m0 = await metrics(cdp);
  await frame.evaluate(() => window.frontendProfile.start());
  const began = performance.now();
  if (action) await action();
  await new Promise(resolve=>setTimeout(resolve, Math.max(0, milliseconds-(performance.now()-began))));
  await frame.evaluate(() => window.frontendProfile.stop());
  const after = await snapshot(frame), m1 = await metrics(cdp);
  const gaps = await frame.evaluate(() => window.frontendProfile.frames);
  const activeGaps=await frame.evaluate(()=>window.frontendProfile.activeFrames);
  const counters = Object.fromEntries(['draws','textureCreates','textureDeletes','buffersCreated','buffersDeleted','mutations'].map(k=>[k,after[k]-before[k]]));
  const cpu = Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,m1[k]-m0[k]]));
  return {label, elapsedMs:performance.now()-began, ...counters, cpu, frames:summarize(gaps),activeFrames:summarize(activeGaps), heapBefore:before.heap, heapAfter:after.heap,
    longTasks:after.longTasks.slice(before.longTasks.length), workers:after.workers.slice(before.workers.length), historyRows:after.historyRows, visibility:after.visibility};
}
async function startup(page, reload = false) {
  if (reload) await page.reload(); else await page.goto(address);
  await page.waitForFunction(()=>window.frontendProfile?.marks.buttonReady && window.frontendProfile?.marks.canvasReady, undefined, {timeout:45000});
  await page.waitForTimeout(600);
  return page.evaluate(() => ({marks:window.frontendProfile.marks, sockets:window.frontendProfile.sockets,
    workers:window.frontendProfile.workers, longTasks:window.frontendProfile.longTasks,
    navigation:performance.getEntriesByType('navigation').map(n=>({ttfb:n.responseStart,domReady:n.domContentLoadedEventEnd,load:n.loadEventEnd})),
    resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,type:r.initiatorType,start:r.startTime,end:r.responseEnd,bytes:r.encodedBodySize,transfer:r.transferSize}))}));
}
async function roll(frame) {
  const button=frame.getByRole('button',{name:'Roll',exact:true});
  await button.waitFor({state:'visible',timeout:45000});
  await button.click({timeout:45000});
}
try {
  if (!process.env.DISPLAY && process.env.HEADLESS !== '1') {
    const number = Array.from({length:100},(_,i)=>i+200).find(i=>!existsSync(`/tmp/.X11-unix/X${i}`));
    if (!number) throw new Error('No free Xvfb display');
    process.env.DISPLAY=`:${number}`;
    display=spawn('Xvfb',[process.env.DISPLAY,'-screen','0','1280x1000x24','-nolisten','tcp'],{stdio:'ignore'});
    for(let i=0;i<50&&!existsSync(`/tmp/.X11-unix/X${number}`);i++) await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({headless:process.env.HEADLESS==='1'});
  const result={date:new Date().toISOString(),viewport:{width:430,height:932},throttle, engine:browser.version(), startup:[], phases:[], errors:[], pip:null};
  mkdirSync(dirname(output),{recursive:true});
  function checkpoint() { writeFileSync(output,JSON.stringify(result,null,2)); }
  async function runPhase(...args) { const sample=await phase(...args); result.phases.push(sample); checkpoint(); console.log(JSON.stringify({phase:sample})); }
  let context, page, cdp;
  for(let i=0;i<Number(process.env.RUNS||3);i++) {
    if(context) await context.close();
    context=await browser.newContext({viewport:result.viewport,colorScheme:'dark'});
    await context.addInitScript(instrument);
    context.on('page',p=>p.on('pageerror',e=>result.errors.push(e.message)));
    page=await context.newPage(); cdp=await context.newCDPSession(page); await cdp.send('Performance.enable');
    if(throttle) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750}); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); }
    result.startup.push({run:i+1, cold:await startup(page), warm:await startup(page,true)}); checkpoint();
  }
  if(!startupOnly) {
    result.graphics=await page.evaluate(()=>{const gl=document.querySelector('.canvas-host canvas').getContext('webgl2'); const e=gl?.getExtension('WEBGL_debug_renderer_info');return {vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,pixelRatio:devicePixelRatio};});
    await runPhase(page,cdp,'empty-idle',12000);
    await runPhase(page,cdp,'power-roll',14000,()=>roll(page));
    await runPhase(page,cdp,'settled-idle',12000);
    await page.getByRole('button',{name:'Select dice',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'d20',exact:true}).click();
    for(let i=1;i<20;i++) await page.getByRole('button',{name:'Add die',exact:true}).click();
    await runPhase(page,cdp,'20d20-first-roll',18000,()=>roll(page));
    await runPhase(page,cdp,'20d20-repeat-roll',18000,()=>roll(page));
    await runPhase(page,cdp,'large-settled-idle',12000);
    if(!timingOnly) {
    for(let i=1;i<20;i++) await page.getByRole('button',{name:'Remove die',exact:true}).click();
    await page.getByRole('button',{name:'Color theme: System',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'Light',exact:true}).click();
    await runPhase(page,cdp,'light-idle',12000);
    await runPhase(page,cdp,'light-1d20-roll',14000,()=>roll(page));
    const popout=page.getByRole('button',{name:'Pop out dice tray',exact:true});
    if(await popout.count()) {
      await popout.click();
      await page.waitForTimeout(3000);
      const mini=context.pages().find(p=>p!==page);
      if(!mini) throw new Error('Native PiP window not created');
      const tray=mini.frames().find(f=>f.url().includes('/pip/'));
      if(!tray) throw new Error('Native PiP iframe not loaded');
      await tray.waitForFunction(()=>window.frontendProfile?.marks.buttonReady,undefined,{timeout:45000});
      const miniCdp=await context.newCDPSession(mini); await miniCdp.send('Performance.enable');
      result.pip={startup:await tray.evaluate(()=>({marks:window.frontendProfile.marks,sockets:window.frontendProfile.sockets,resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.encodedBodySize,transfer:r.transferSize}))})),
        idle:await phase(tray,miniCdp,'pip-idle',12000),
        roll:await phase(tray,miniCdp,'pip-1d20-roll',14000,()=>roll(tray)),
        opener:await snapshot(page)};
      await mini.close(); checkpoint();
    } else result.pip={unsupported:true};
    // Forced GC is outside timing windows; these points compare retained memory, not allocation churn.
    result.retention=[];
    async function retained(label) {
      await cdp.send('HeapProfiler.collectGarbage');
      const point={label,...await snapshot(page),cdp:await metrics(cdp)};
      result.retention.push(point); checkpoint(); console.log(JSON.stringify({retained:point}));
    }
    await retained('before-repeat-cycles');
    for(let i=1;i<=15;i++) {
      await roll(page);
      await page.waitForTimeout(14000);
      if(i%5===0) await retained(`after-${i}-rolls`);
    }
    // The clear control disappears after natural fade; clear a fresh, accepted roll.
    await roll(page);
    await page.getByRole('button',{name:'Clear tray',exact:true}).waitFor({state:'visible',timeout:45000});
    await page.getByRole('button',{name:'Clear tray',exact:true}).click({timeout:45000});
    await page.waitForTimeout(4000);
    await retained('after-clear');
    // Warm the settings module once, then compare subsequent preview/audio lifecycle cycles.
    for(let i=1;i<=5;i++) {
      await page.getByRole('button',{name:'Customize dice',exact:true}).click();
      await page.waitForTimeout(700);
      await page.getByRole('button',{name:'Close customization',exact:true}).click();
      await page.getByRole('button',{name:'Dice sounds',exact:true}).click();
      await page.waitForTimeout(700);
      await page.getByRole('button',{name:'Dice sounds',exact:true}).click();
      await page.waitForTimeout(700);
      await retained(`after-preview-audio-cycle-${i}`);
    }
    if(await popout.count()) {
      for(let i=1;i<=3;i++) {
        await popout.click(); await page.waitForTimeout(4000);
        const mini=context.pages().find(p=>p!==page);
        if(!mini) throw new Error('PiP lifecycle window missing');
        const tray=mini.frames().find(f=>f.url().includes('/pip/'));
        await tray.waitForFunction(()=>window.frontendProfile?.marks.buttonReady,undefined,{timeout:45000});
        await mini.close(); await page.waitForTimeout(2000);
        await retained(`after-pip-close-${i}`);
      }
    }
    }
    result.final=await snapshot(page);
  }
  mkdirSync(dirname(output),{recursive:true}); writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({output,engine:result.engine,throttle,startup:result.startup.map(r=>({run:r.run,cold:r.cold.marks,warm:r.warm.marks})),phases:result.phases,pip:result.pip,errors:result.errors},null,2));
  if(result.errors.length) process.exitCode=1;
} finally { await browser?.close(); display?.kill(); }
