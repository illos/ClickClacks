import { afterEach, describe, expect, it, vi } from 'vitest';
import { createController, type ParticipantRoll, type Transport } from '../lib/client';
const identity={viewer:'v',credential:'private-session-credential'},profile={name:'River',style:{color:'#70dac3',ink:'#fff4e5',pattern:'solid' as const}};
function record(id:string,sequence=1,revealAt=Date.now()+2000):ParticipantRoll{return{id,roller:identity.viewer,name:profile.name,faces:[7,8],styles:[profile.style,profile.style],startsAt:Date.now()+100,duration:1900,revealAt,sequence,total:15,source:'generated'};}
function fake(records:ParticipantRoll[]=[]){
 const tracks=new Map<string,ParticipantRoll>(),watchers=new Map<string,(value:any)=>void>();records.forEach(r=>tracks.set(r.roller,r));let cursor=records.at(-1)?.sequence??0;
 const watched=(method:string,args:Record<string,unknown>)=>`${method}:${args.viewer??''}`;
 const call=vi.fn(async(method:string,args:Record<string,unknown>)=>{
  if(method==='diceDemo:clock')return Date.now();
  if(method==='diceDemoV2:events'){const page=records.filter(r=>(r.sequence??0)>Number(args.after)).slice(0,20);return{rolls:page,cursor:page.at(-1)?.sequence??Number(args.after),hasMore:records.some(r=>(r.sequence??0)>(page.at(-1)?.sequence??Number(args.after)))};}
  if(method==='diceDemoV2:view')return{participants:[{id:identity.viewer}],code:'ABCDEFGH',expired:false,cursor};
  if(method==='diceDemoV2:track')return tracks.get(String(args.viewer))?{roll:tracks.get(String(args.viewer)),receipts:[]}:null;
  if(method==='diceDemo:sampleFaces')return[7,8];
  if(method==='diceDemoV2:throwDice'){let result=records.find(r=>r.id===args.id);if(!result){result=record(String(args.id),++cursor);records.push(result);tracks.set(result.roller,result);}return result;}
  if(method==='diceDemoV2:clearTray'){tracks.clear();for(const [name,next]of watchers)if(name.startsWith('diceDemoV2:track'))next(null);}
  return null;
 });
 const transport:Transport={call,watch:vi.fn((method,args,next)=>{const id=watched(method,args);watchers.set(id,next);return()=>{if(watchers.get(id)===next)watchers.delete(id);};}),close:vi.fn()};
 return{transport,call,tracks,records,fireRoom:()=>watchers.get('diceDemoV2:view:')?.({participants:[{id:identity.viewer}],code:'ABCDEFGH',expired:false,cursor}),fireTrack:()=>watchers.get(`diceDemoV2:track:${identity.viewer}`)?.(tracks.get(identity.viewer)?{roll:tracks.get(identity.viewer),receipts:[]}:null)};
}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
afterEach(()=>vi.useRealTimers());
function clock(){vi.useFakeTimers();vi.setSystemTime(100000);}
describe('independent authority and delivery controller',()=>{
 it('binds sampling and acceptance to one private request and works when cosmetic preparation fails',async()=>{
  clock();const f=fake(),c=createController({transport:f.transport,key:'room',identity,profile}),accepted=vi.fn(),available=vi.fn();c.on('accepted',accepted);c.on('available',available);await c.join();const roll=await c.roll({id:'stable'},async()=>{throw Error('WebGL unavailable');});
  const sample=f.call.mock.calls.find(([method])=>method==='diceDemo:sampleFaces')![1],thrown=f.call.mock.calls.find(([method])=>method==='diceDemoV2:throwDice')![1];expect(sample).toMatchObject({key:'room',...identity,id:'stable'});expect(thrown).toMatchObject({...sample,faces:[7,8]});expect(thrown).not.toHaveProperty('motion');expect((await f.transport.call('diceDemoV2:track',{key:'room',viewer:identity.viewer})).roll).toEqual(roll);expect(accepted).toHaveBeenCalledOnce();expect(available).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(2000);expect(available).toHaveBeenCalledOnce();await c.dispose();
 });
 it('retries an unknown acceptance outcome with the same sampled faces and rejects changed input',async()=>{
  clock();const f=fake(),original=f.transport.call;let lost=true;f.transport.call=vi.fn(async(method,args)=>{const value=await original(method,args);if(method==='diceDemoV2:throwDice'&&lost){lost=false;throw Error('connection lost after acceptance');}return value;});const c=createController({transport:f.transport,key:'room',identity,profile});await c.join();await expect(c.roll({id:'retry'})).rejects.toThrow('connection lost');const result=await c.roll({id:'retry'});expect(result).toEqual(f.records[0]);expect(f.call.mock.calls.filter(([method])=>method==='diceDemo:sampleFaces')).toHaveLength(1);await expect(c.roll({id:'retry',edges:1})).rejects.toThrow('REQUEST_CONFLICT');expect(f.records).toHaveLength(1);await c.dispose();
 });
 it('deduplicates concurrent identical requests and retains retry protection after clearing the tray',async()=>{
  clock();const f=fake(),c=createController({transport:f.transport,key:'room',identity,profile});await c.join();const[first,second]=await Promise.all([c.roll({id:'same'}),c.roll({id:'same'})]);expect(second).toEqual(first);expect(f.call.mock.calls.filter(([method])=>method==='diceDemoV2:throwDice')).toHaveLength(1);await c.clear();expect(f.tracks.size).toBe(0);expect(await c.roll({id:'same'})).toEqual(first);expect(f.tracks.size).toBe(0);await c.dispose();
 });
 it('delivers rapid rolls at server timestamps even after their tray is cleared',async()=>{
  clock();const first=record('a',1,101000),second=record('b',2,102000),f=fake([first,second]),c=createController({transport:f.transport,key:'room',identity,profile}),available=vi.fn(),clear=vi.fn();c.on('available',available);c.on('clear',clear);await c.join();f.fireRoom();f.fireTrack();await flush();await c.clear();expect(clear).toHaveBeenCalledWith(identity.viewer);await vi.advanceTimersByTimeAsync(1000);expect(available.mock.calls.map(v=>v[0].id)).toEqual(['a']);await vi.advanceTimersByTimeAsync(1000);expect(available.mock.calls.map(v=>v[0].id)).toEqual(['a','b']);await c.dispose();
 });
 it('marks catch-up history and avoids reannouncement on same-room reconnect',async()=>{
  clock();const f=fake([record('old',1,99999)]),c=createController({transport:f.transport,key:'room',identity,profile}),available=vi.fn();c.on('available',available);await c.join();expect(available.mock.calls[0][0].historical).toBe(true);await c.join();expect(available).toHaveBeenCalledOnce();await c.dispose();
 });
 it('recovers an expired cursor from a room snapshot even when all latest trays were cleared',async()=>{
  clock();const f=fake(),original=f.transport.call;f.transport.call=vi.fn(async(method,args)=>{if(method==='diceDemoV2:events'&&Number(args.after)<50)throw Error('CURSOR_EXPIRED');if(method==='diceDemoV2:view')return{participants:[],cursor:50,code:'ABCDEFGH',expired:false};return original(method,args);});const c=createController({transport:f.transport,key:'room',identity,profile});await c.join();expect(f.call.mock.calls.some(([method,args])=>method==='diceDemoV2:events'&&args.after===50)).toBe(true);await c.dispose();
 });
 it('switches rooms without waiting for a stalled old catch-up and discards its stale result',async()=>{
  clock();const f=fake(),original=f.transport.call;let release!:(value:unknown)=>void;let started!:()=>void;const requested=new Promise<void>(resolve=>{started=resolve;});f.transport.call=vi.fn(async(method,args)=>{if(method==='diceDemoV2:events'&&args.key==='old')return new Promise(resolve=>{release=resolve;started();});return original(method,args);});const c=createController({transport:f.transport,key:'old',identity,profile}),accepted=vi.fn();c.on('accepted',accepted);const oldJoin=c.join();await requested;await c.join('new');release({rolls:[record('stale')],cursor:1,hasMore:false});await oldJoin;expect(accepted).not.toHaveBeenCalled();expect(c.key).toBe('new');expect(f.call).toHaveBeenCalledWith('diceDemoV2:leave',{key:'old',...identity});await c.dispose();
 });
 it('uses an injected monotonic clock and cancels semantic timers on disposal',async()=>{
  clock();const f=fake([record('a')]),c=createController({transport:f.transport,key:'room',identity,profile,clock:()=>50000}),available=vi.fn();c.on('available',available);await c.join();expect(c.clock()).toBe(100000);expect(c.clockEstimate().offset).toBe(50000);await c.dispose();await vi.advanceTimersByTimeAsync(5000);expect(available).not.toHaveBeenCalled();expect(f.transport.close).toHaveBeenCalledOnce();
 });
 it('treats a room UUID and its share code as one membership',async()=>{
  clock();const f=fake(),c=createController({transport:f.transport,key:'room-uuid',identity,profile});await c.join();await c.join('ABCDEFGH');expect(f.call.mock.calls.filter(([method])=>method==='diceDemoV2:leave')).toHaveLength(0);expect(c.key).toBe('room-uuid');await c.dispose();
 });

 it('observes host-owned membership without joining, heartbeating or leaving it',async()=>{
  clock();const f=fake([record('host-roll')]),c=createController({transport:f.transport,key:'room',identity,profile}),available=vi.fn();c.on('available',available);await c.observe();await vi.advanceTimersByTimeAsync(30000);expect(available).toHaveBeenCalledOnce();expect(f.call.mock.calls.filter(([method])=>method==='diceDemoV2:join')).toHaveLength(0);await c.dispose();expect(f.call.mock.calls.filter(([method])=>method==='diceDemoV2:leave')).toHaveLength(0);
 });

});
