// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.cueStarts=[];const Context=window.AudioContext;
  window.AudioContext=class extends Context{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(when,...args)=>{if(source.buffer?.duration>.3){const data=source.buffer.getChannelData(0);window.cueStarts.push({when,duration:source.buffer.duration,rms:Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length)});}return start(when,...args);};return source;}};
 });
 await page.goto(process.env.URL||'http://127.0.0.1:9594/powerroller/');await expect(page.getByRole('button',{name:'Roll',exact:true})).toBeEnabled({timeout:30000});
 const fixtures=await page.evaluate(async()=>{
  const {cacheRoll}=await import('/powerroller/web/site/storage.ts');const backend='https://nautical-partridge-636.convex.cloud';const key=new URL(location.href).searchParams.get('room');
  const style={color:'#70dac3',ink:'#111415',pattern:'solid',font:'serif'};
  const make=(id,faces,dice,extra={})=>({id,roller:'fixture',name:id,faces,styles:faces.map(()=>style),startsAt:Date.now()-5000,duration:2200,...(dice?{dice}:{}),...extra});
  const cases=[
   make('Power 19',[9,10],undefined,{power:{edges:0,banes:1,total:17,tier:3}}),
   make('Power 20',[10,10],undefined,{power:{edges:0,banes:0,total:20,tier:3}}),
   make('Power fail',[1,1],undefined,{power:{edges:2,banes:0,total:2,tier:2}}),
   make('Modified 20',[9,9],undefined,{power:{edges:1,banes:0,total:20,tier:3}}),
   make('D20 crit',[20],{kind:'dice',sides:20,count:1},{modifier:-5,total:15}),
   make('D20 fail',[1,4],{kind:'dice',sides:20,count:1,bonusD4:true},{modifier:5,total:10}),
   make('D20 pool',[20,20],{kind:'dice',sides:20,count:2},{total:40}),
   make('D6 one',[1],{kind:'dice',sides:6,count:1},{total:1}),
  ];
  for(const roll of cases)await cacheRoll(backend,key,roll);
  return cases;
 });
 await page.reload();await expect(page.locator('.roll-log-entry')).toHaveCount(8,{timeout:20000});
 for(const [name,kind,label] of [['Power 19','success','Crit'],['Power 20','success','Crit'],['Power fail','failure','Crit fail'],['D20 crit','success','Crit'],['D20 fail','failure','Crit fail']]){
  const row=page.locator('.roll-log-entry').filter({has:page.locator('.roll-author-name',{hasText:name})});
  await expect(row).toHaveClass(new RegExp('critical-'+kind));await expect(row.locator('.critical-badge')).toHaveText(label);
  expect(await row.evaluate(el=>getComputedStyle(el).backgroundImage)).not.toBe('none');
  expect(await row.locator('.roll-total').evaluate(el=>getComputedStyle(el).color)).toBe(kind==='success'?'rgb(110, 219, 192)':'rgb(255, 143, 150)');
  expect(await row.locator('.visually-hidden').textContent()).toContain('critical '+kind);
 }
 for(const name of ['Modified 20','D20 pool','D6 one'])await expect(page.locator('.roll-log-entry').filter({has:page.locator('.roll-author-name',{hasText:name})}).locator('.critical-badge')).toHaveCount(0);
 for(const [name,notation] of [['Power 19','2d10'],['D20 crit','1d20'],['D20 fail','1d20 + 1d4'],['D20 pool','2d20'],['D6 one','1d6']]){
  const row=page.locator('.roll-log-entry').filter({has:page.locator('.roll-author-name',{hasText:name})});
  await expect(row.locator('.roll-dice-notation')).toHaveText(notation);
 }
 await expect(page.locator('.roll-log-entry').filter({has:page.locator('.roll-author-name',{hasText:'D6 one'})}).locator('.roll-equation')).toHaveCount(0);
 await page.screenshot({path:'/tmp/powerroller-critical-history.png'});
 await page.setViewportSize({width:320,height:720});expect(await page.locator('.track-results').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.setViewportSize({width:430,height:932});
 // Use the real renderer and planner with known display fixtures. This does not
 // forge server results or claim backend acceptance of supplied faces.
 await page.getByRole('button',{name:'Dice sounds',exact:true}).click();
 await page.evaluate(async()=>{
  const {createDiceSound}=await import('/powerroller/web/dice-demo-v2/dice-sound.ts');window.fixtureAudio=createDiceSound();window.fixtureAudio.setEnabled(true);await window.fixtureAudio.unlock();
  const {createRoomTray}=await import('/powerroller/web/dice-demo-v2/renderer.ts');const {createThrowPlanner}=await import('/powerroller/web/dice-demo/prepare-throw.ts');const {loadDiceFonts}=await import('/powerroller/web/dice-demo/fonts.ts');await loadDiceFonts();
  const overlay=document.createElement('div');overlay.className='powerroller';overlay.innerHTML='<section class="stage" style="position:fixed;top:140px;left:25px;width:380px;height:330px;z-index:20;border:1px solid #354043;border-radius:20px;background:#151a1b"><div class="canvas-host" style="height:100%"></div></section>';document.body.appendChild(overlay);
  window.fixtureHost=overlay.querySelector('.canvas-host');window.fixtureTray=createRoomTray(window.fixtureHost,()=>{throw Error('Fixture WebGL failed');},()=>{});window.fixturePlanner=createThrowPlanner();
  window.fixtureTray.participants([{id:'fixture',name:'Reference',slot:0,ready:true,uncertainty:0,seenAt:Date.now(),style:{color:'#70dac3',ink:'#111415',pattern:'solid',font:'serif'}}]);
 });
 const host=page.locator('.stage').last();
 for(const name of ['Power 19','Power fail','D20 crit','D20 fail','Modified 20']){
  const fixture=fixtures.find(r=>r.name===name);
  const id=await page.evaluate(async roll=>{
   const motion=(await window.fixturePlanner.prepareThrow(roll.faces,{scale:.65,obstacles:[],dice:roll.dice})).motion;
   const startsAt=performance.now()+150;const played={...roll,id:crypto.randomUUID(),startsAt,duration:(motion.samples.length/(roll.faces.length*7)-1)*motion.stepMs,motion};window.fixtureTray.play(played,{offset:0,uncertainty:0});window.fixtureAudio.play(played,0,false);return played.id;
  },fixture);
  const result=host.locator(`.tray-roll-result[data-roll-id="${id}"]`);await expect(result).toBeVisible({timeout:20000});
  const failure=name.includes('fail');if(name==='Modified 20'){await expect(result.locator('.critical-badge')).toHaveCount(0);await expect(result).not.toHaveClass(/critical-/);}else{await expect(result.locator('.critical-badge')).toHaveText(failure?'Crit fail':'Crit');await expect(result).toHaveClass(new RegExp('critical-'+(failure?'failure':'success')));}
  const box=await result.boundingBox(),trayBox=await host.boundingBox();expect(box.x).toBeGreaterThanOrEqual(trayBox.x-1);expect(box.x+box.width).toBeLessThanOrEqual(trayBox.x+trayBox.width+1);
  if(name==='Power 19'||name==='Power fail')await page.screenshot({path:`/tmp/powerroller-${failure?'fail':'crit'}-flash.png`});
 }
 expect(await page.evaluate(()=>window.cueStarts.length)).toBe(4);
 expect(await page.evaluate(()=>window.cueStarts.every(c=>c.rms>.04&&Math.abs(c.duration-.33)<.001))).toBe(true);
 await page.evaluate(()=>{window.fixtureAudio.dispose();window.fixtureTray.dispose();window.fixturePlanner.dispose();});expect(errors).toEqual([]);
 console.log('PASS: cached history crit colors/labels survive reload; natural values ignore modifiers; bonus d4 and multi-d20 exclusions; semantic descriptions; 320px history containment; real planner/renderer success/fail flashes and ordinary-flash reset; four real AudioContext reveal cues with non-silent buffers; no page errors.');
}finally{await browser.close();}
