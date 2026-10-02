// SPDX-License-Identifier: MIT
// No page instrumentation: checks whether preview lifecycle growth belongs to the app.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();
const result={points:[],heap:[],errors:[]};
try {
 const context=await browser.newContext();const page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(e.message));
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 await page.goto(process.env.URL||'http://127.0.0.1:9610/powerroller/');
 await page.getByRole('button',{name:'Roll',exact:true}).waitFor({state:'visible',timeout:45000});
 async function preview() {
  await page.getByRole('button',{name:'Customize dice',exact:true}).click();
  await page.getByRole('dialog',{name:'Customize dice',exact:true}).locator('.dice-preview .preview-canvas canvas').waitFor({state:'visible',timeout:30000});
  await page.waitForTimeout(120);
  await page.getByRole('button',{name:'Close customization',exact:true}).click();
  await page.waitForTimeout(120);
 }
 async function point(label) {
  await cdp.send('HeapProfiler.collectGarbage');
  result.points.push({label,metrics:Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]))});
 }
 async function heap(label) {
  // Raw heap chunks stay in memory; output only native class counts, never strings/identities.
  const chunks=[];const handler=e=>chunks.push(e.chunk);cdp.on('HeapProfiler.addHeapSnapshotChunk',handler);
  await cdp.send('HeapProfiler.takeHeapSnapshot');cdp.off('HeapProfiler.addHeapSnapshotChunk',handler);
  const dump=JSON.parse(chunks.join(''));chunks.length=0;
  const fields=dump.snapshot.meta.node_fields,stride=fields.length;
  const types=dump.snapshot.meta.node_types[0],typeIndex=fields.indexOf('type'),nameIndex=fields.indexOf('name'),detachedIndex=fields.indexOf('detachedness');
  const counts={};
  for(let i=0;i<dump.nodes.length;i+=stride) {
   if(types[dump.nodes[i+typeIndex]]!=='native')continue;
   const name=dump.strings[dump.nodes[i+nameIndex]];
   if(!/HTMLCanvasElement|WebGL|Detached/.test(name))continue;
   const key=`${name} (detachedness ${detachedIndex>=0?dump.nodes[i+detachedIndex]:'unknown'})`;
   counts[key]=(counts[key]||0)+1;
  }
  const paths=[];
  if(process.env.TRACE==='1') {
   const edgeFields=dump.snapshot.meta.edge_fields,edgeStride=edgeFields.length;
   const edgeTypes=dump.snapshot.meta.edge_types[0],edgeType=edgeFields.indexOf('type'),edgeName=edgeFields.indexOf('name_or_index'),edgeTo=edgeFields.indexOf('to_node');
   const count=dump.nodes.length/stride,parent=new Int32Array(count).fill(-1),via=new Int32Array(count),queue=[0];parent[0]=0;
   const edgeStart=new Uint32Array(count);let edgeOffset=0;
   for(let i=0;i<count;i++) {edgeStart[i]=edgeOffset;edgeOffset+=dump.nodes[i*stride+fields.indexOf('edge_count')]*edgeStride;}
   for(let q=0;q<queue.length;q++) {
    const node=queue[q],end=node+1<count?edgeStart[node+1]:dump.edges.length;
    for(let e=edgeStart[node];e<end;e+=edgeStride) {
     if(edgeTypes[dump.edges[e+edgeType]]==='weak')continue;
     const child=dump.edges[e+edgeTo]/stride;
     if(parent[child]!==-1)continue;
     parent[child]=node;via[child]=e;queue.push(child);
    }
   }
   for(let i=0;i<count&&paths.length<4;i++) {
    const base=i*stride,name=dump.strings[dump.nodes[base+nameIndex]];
    if(types[dump.nodes[base+typeIndex]]!=='native'||name!=='WebGL2RenderingContext'||parent[i]===-1)continue;
    const path=[];let node=i;
    for(let steps=0;steps<50;steps++) {
     const n=node*stride,t=types[dump.nodes[n+typeIndex]];
     let nodeName=dump.strings[dump.nodes[n+nameIndex]];
     if(['string','concatenated string','sliced string','code'].includes(t))nodeName=`[${t}]`;
     const e=via[node],kind=edgeTypes[dump.edges[e+edgeType]];
     const field=['context','property','internal','hidden','shortcut'].includes(kind)?dump.strings[dump.edges[e+edgeName]]:'';
     path.push({type:t,name:nodeName.slice(0,120),via:/^[A-Za-z_$][A-Za-z0-9_$ ]*$/.test(field)?field:kind});
     if(node===0)break;node=parent[node];
    }
    paths.push(path.reverse());
   }
  }
  let lookupId;
  if(process.env.DISPOSE_LUT==='1') {
   const edgeFields=dump.snapshot.meta.edge_fields,edgeStride=edgeFields.length,edgeTypes=dump.snapshot.meta.edge_types[0];
   let edge=0;
   for(let i=0;i<dump.nodes.length;i+=stride) {
    const end=edge+dump.nodes[i+fields.indexOf('edge_count')]*edgeStride;
    if(types[dump.nodes[i+typeIndex]]==='object') for(let e=edge;e<end;e+=edgeStride) {
     if(edgeTypes[dump.edges[e+edgeFields.indexOf('type')]]!=='property'||dump.strings[dump.edges[e+edgeFields.indexOf('name_or_index')]]!=='name')continue;
     const target=dump.edges[e+edgeFields.indexOf('to_node')];
     if(dump.strings[dump.nodes[target+nameIndex]]==='DFG_LUT')lookupId=String(dump.nodes[i+fields.indexOf('id')]);
    }
    edge=end;
   }
  }
  result.heap.push({label,counts,paths});return lookupId;
 }
 await preview();await point('warmed-baseline');await heap('warmed-baseline');
 const cycles=Number(process.env.CYCLES||30);
 for(let i=1;i<=cycles;i++) {await preview();if(i%10===0)await point(`after-${i}-preview-cycles`);}
 if(process.env.WAIT_AFTER) {await page.waitForTimeout(Number(process.env.WAIT_AFTER));await point('after-idle-wait');}
 const lookupId=await heap(`after-${cycles}-preview-cycles`);
 if(process.env.DISPOSE_LUT==='1') {
  if(!lookupId)throw new Error('Shared DFG_LUT not found in diagnostic heap');
  const remote=await cdp.send('HeapProfiler.getObjectByHeapObjectId',{objectId:lookupId});
  const objectId=remote.result.objectId;
  const before=await cdp.send('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(){return {name:this.name,isDataTexture:this.isDataTexture,disposeListeners:this._listeners?.dispose?.length ?? 0};}',returnByValue:true});
  if(before.result.value?.name!=='DFG_LUT'||!before.result.value?.isDataTexture)throw new Error('Diagnostic target is not DFG_LUT');
  result.lookupBefore=before.result.value;
  // Diagnostic only, inside the owned disposable browser; never an app patch or shared backend write.
  await cdp.send('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(){this.dispose();}',returnByValue:true});
  await cdp.send('Runtime.releaseObject',{objectId});
  await page.waitForTimeout(500);await point('after-diagnostic-lookup-dispose');await heap('after-diagnostic-lookup-dispose');
 }
 const dest=process.env.OUT||'/tmp/clickclacks-lifecycle-profile.json';fs.writeFileSync(dest,JSON.stringify(result,null,2));console.log(JSON.stringify({output:dest,...result},null,2));
 if(result.errors.length)process.exitCode=1;
} finally {await browser.close();}
