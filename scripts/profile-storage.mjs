// SPDX-License-Identifier: MIT
// Profiles the real storage module in isolated browser contexts; no app/backend session.
import {chromium} from '@playwright/test';
import ts from 'typescript';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../web/site/storage.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const deadline=ts.transpileModule(fs.readFileSync(new URL('../web/dice-demo-v2/history-deadline.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const deadlineUrl=`data:text/javascript;base64,${Buffer.from(deadline).toString('base64')}`;
const moduleUrl=`data:text/javascript;base64,${Buffer.from(compiled.replace('../dice-demo-v2/history-deadline',deadlineUrl)).toString('base64')}`;
const browser=await chromium.launch();
const results=[];
try {
 for(const count of [0,1000,10000]) {
  const context=await browser.newContext(); const page=await context.newPage();
  await page.route('**/history-benchmark',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated history benchmark</title>'}));
  await page.goto('http://127.0.0.1:9610/history-benchmark');
  const result=await page.evaluate(async({count,moduleUrl})=>{
   const api=await import(moduleUrl), backend='fixture', room='target';
   const style={color:'#ffffff',ink:'#000000',pattern:'solid'};
   const roll=i=>({id:`fixture-${i}`,roller:'fixture-player',name:'Fixture',startsAt:Date.now()-(i%1000)*1000,duration:2200,faces:[3,7],styles:[style,style],total:10});
   await api.loadHistory(backend,room);
   if(count) {
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('powerroller.history.v2',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{
     const tx=db.transaction('rolls','readwrite'),store=tx.objectStore('rolls');
     for(let i=0;i<count;i++) {
      const target=i<1000?room:`other-${Math.floor(i/1000)}`,value=roll(i);
      store.put({key:JSON.stringify([backend,target,value.roller,value.id]),backend,room:target,savedAt:Date.now(),startsAt:value.startsAt,expiresAt:value.startsAt+3600000,roll:value});
     }
     tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    }); db.close();
   }
   const load=[],save=[];
   for(let i=0;i<8;i++) {
    let began=performance.now();await api.loadHistory(backend,room);load.push(performance.now()-began);
    began=performance.now();await api.cacheRoll(backend,room,roll(-i-1));save.push(performance.now()-began);
   }
   return {count,load,save,rowsReturned:(await api.loadHistory(backend,room)).length};
  },{count,moduleUrl});
  results.push(result);await context.close();
 }
 const dest=process.env.OUT||'/tmp/clickclacks-storage-profile.json';fs.writeFileSync(dest,JSON.stringify(results,null,2));console.log(JSON.stringify({output:dest,results},null,2));
} finally {await browser.close();}
