// SPDX-License-Identifier: MIT
import { ConvexClient } from 'convex/browser';
import type { ConvexReactClient } from 'convex/react';
import { redactError } from './errors.ts';
export { redactError, RollerError, type RollerErrorCode } from './errors.ts';
import { makeFunctionReference } from 'convex/server';
import { defaultDice, validateDiceConfiguration, type DiceConfiguration } from '../shared/dice.ts';
import { recordedRevealDelay } from '../shared/timing.ts';
import { estimateClock, type ClockSample, type Motion, type Style } from '../shared/model.ts';
import { packMotion, unpackRoll } from '../shared/motion-codec.ts';
import type { ParticipantRoll, Room, Track } from '../shared/room.ts';

export type { DiceConfiguration, Style, Motion, ParticipantRoll };
export { parseRoomKey } from '../shared/room.ts';
export type Identity = { viewer:string; credential:string };
export type Profile = { name:string; style:Style };
export type DeliveredRoll = ParticipantRoll & { historical?:boolean };
export type RoomSnapshot = Room & { cursor?:number };
const queries = new Set(['diceDemoV2:view','diceDemoV2:track','diceDemoV2:trackMetadata','diceDemoV2:motion','diceDemoV2:events']);
export interface Transport {
  /** Opt into immutable motion-by-ID delivery; legacy custom transports remain supported. */
  compactTracks?:boolean;
  call(method:string,args:Record<string,unknown>):Promise<any>;
  watch(method:string,args:Record<string,unknown>,next:(value:any)=>void,error:(error:Error)=>void):()=>void;
  close?():Promise<void>|void;
}
/** Explicit endpoint or an existing host connection; no deployment or room is created on import. */
export function convexTransport(url:string, supplied?:ConvexClient):Transport {
  const client=supplied??new ConvexClient(url);
  return {
    compactTracks:true,
    call:(method,args)=>['diceDemo:clock','diceDemo:sampleFaces'].includes(method)
      ? client.action(makeFunctionReference<'action'>(method),args)
      : queries.has(method)
        ? client.query(makeFunctionReference<'query'>(method),args)
        : client.mutation(makeFunctionReference<'mutation'>(method),args),
    watch:(method,args,next,error)=>client.onUpdate(makeFunctionReference<'query'>(method),args,next,error),
    close:()=>supplied?undefined:client.close(),
  };
}
/** Use the site's existing connection without owning or closing it. */
export function reactTransport(client:ConvexReactClient):Transport {
  return {
    compactTracks:true,
    call:(method,args)=>['diceDemo:clock','diceDemo:sampleFaces'].includes(method)
      ? client.action(makeFunctionReference<'action'>(method),args)
      : queries.has(method) ? client.query(makeFunctionReference<'query'>(method),args)
      : client.mutation(makeFunctionReference<'mutation'>(method),args),
    watch:(method,args,next,error)=>{
      const query=client.watchQuery(makeFunctionReference<'query'>(method),args);
      return query.onUpdate(()=>{try{const value=query.localQueryResult();if(value!==undefined)next(value);}catch(value){error(value instanceof Error?value:new Error(String(value)));}});
    },
  };
}
export type RollInput = { id?:string; dice?:DiceConfiguration; edges?:number; banes?:number };
export type PresentationProvider = (faces:number[],dice:DiceConfiguration)=>Promise<Motion|undefined>;
export type ClientEvents = {
  accepted:DeliveredRoll; available:DeliveredRoll; room:RoomSnapshot;
  track:{owner:string;roll:DeliveredRoll|null;activeRolls?:DeliveredRoll[]}; clear:string;
  status:'connecting'|'connected'|'interrupted'|'left'; error:Error;
};
type Request = { id:string; dice:DiceConfiguration; edges:number; banes:number; fingerprint:string; faces?:number[]; motion?:Motion; accepted?:ParticipantRoll };

/** Instance-owned authority/delivery controller. Cosmetic presentation never determines availability. */
export function createController(options:{transport:Transport;key:string;identity:Identity;profile:Profile;clock?:()=>number;clockEstimate?:()=>{offset:number;uncertainty:number};requestId?:()=>string}) {
  const transport:Transport={
    compactTracks:options.transport.compactTracks,
    call:async(method,args)=>{try{return await options.transport.call(method,args);}catch(error){throw redactError(error,[options.identity.credential]);}},
    watch:(...args)=>options.transport.watch(...args),
    close:()=>options.transport.close?.(),
  };
  let key=options.key, profile=options.profile, epoch=0, joined=false, disposed=false;
  let cursor=0, offset=0, uncertainty=10000;
  let canonicalCode:string|null=null;
  let roomStop:(()=>void)|undefined, heartbeat:ReturnType<typeof setInterval>|undefined;
  let refreshing:Promise<void>|undefined, refreshAgain=false;
  const tracks=new Map<string,()=>void>(), visible=new Set<string>();
  const seen=new Set<string>(), timers=new Map<string,ReturnType<typeof setTimeout>>();
  const requests=new Map<string,Request>(), inFlight=new Map<string,Promise<ParticipantRoll>>();
  const listeners=new Map<keyof ClientEvents,Set<(value:any)=>void>>();
  const local=options.clock??Date.now;
  const clockEstimate=()=>options.clockEstimate?.()??{offset,uncertainty};
  const now=()=>local()+clockEstimate().offset;
  const trackMethod=transport.compactTracks?'diceDemoV2:trackMetadata':'diceDemoV2:track';
  const motions=new Map<string,Promise<Motion|undefined>>();
  const motionBytes=new Map<string,number>();
  const byteSize=(motion:Motion|undefined)=>motion?(motion.packed?.byteLength??0)+8*(motion.samples.length+motion.offsets.length):0;
  function trimMotions(){let size=[...motionBytes.values()].reduce((a,b)=>a+b,0);for(const id of motions.keys()){if(size<=8*1024*1024&&motions.size<=16)break;const bytes=motionBytes.get(id);if(bytes===undefined)continue;size-=bytes;motions.delete(id);motionBytes.delete(id);}}
  const trackVersions=new Map<string,number>();
  async function hydrate(roll:ParticipantRoll):Promise<ParticipantRoll>{
    if(!transport.compactTracks||roll.motion)return unpackRoll(roll);
    if((roll.historyExpiresAt??roll.startsAt+3600000)<=now())return roll;
    const id=recordKey(roll);
    let pending=motions.get(id);
    if(!pending){pending=transport.call('diceDemoV2:motion',{key,viewer:roll.roller,rollId:roll.id}).then(value=>{motionBytes.set(id,byteSize(value??undefined));trimMotions();return value??undefined;}).catch(error=>{motions.delete(id);motionBytes.delete(id);throw error;});motions.set(id,pending);}
    const motion=await pending;
    return unpackRoll(motion?{...roll,motion}:roll);
  }
  function trimRequests(){
    let bytes=[...requests.values()].reduce((sum,item)=>sum+byteSize(item.motion)+byteSize(item.accepted?.motion),0);
    for(const request of requests.values()){
      if(inFlight.has(request.id))continue;
      const expired=(request.accepted?.historyExpiresAt??Infinity)<=now();
      if(!expired&&bytes<=8*1024*1024)continue;
      bytes-=byteSize(request.motion)+byteSize(request.accepted?.motion);
      // Keep semantic fingerprints/faces. The server remains authoritative for retry
      // acceptance and returns its original motion if a local cache was trimmed.
      delete request.motion;delete request.accepted;
    }
  }
  const session=()=>({key,viewer:options.identity.viewer,credential:options.identity.credential});
  const emit=<K extends keyof ClientEvents>(name:K,value:ClientEvents[K])=>listeners.get(name)?.forEach(listener=>listener(value));
  const fail=(value:unknown)=>{if(disposed)return;const error=redactError(value,[options.identity.credential]);emit('status','interrupted');emit('error',error);};
  const valid=(version:number)=>!disposed&&version===epoch;
  const assertJoined=()=>{if(!joined||disposed)throw new Error('Join a room before performing this operation.');};
  const recordKey=(roll:ParticipantRoll)=>`${roll.roller}:${roll.id}`;
  function receive(raw:ParticipantRoll,replayed=false){
    if(disposed)return;
    const roll=unpackRoll(raw), id=recordKey(roll);
    if(seen.has(id))return;
    seen.add(id);if(seen.size>5000)seen.delete(seen.values().next().value!);
    const revealAt=roll.revealAt??roll.startsAt+recordedRevealDelay(roll);
    const delay=Math.max(0,revealAt-now());
    const delivered:DeliveredRoll=replayed&&delay===0?{...roll,historical:true}:roll;
    emit('accepted',delivered);
    if(delay===0){emit('available',delivered);return;}
    timers.set(id,setTimeout(()=>{timers.delete(id);if(!disposed)emit('available',delivered);},delay));
  }
  function updateTrack(owner:string,value:Track|null,version:number){
    if(!valid(version))return;
    const revision=(trackVersions.get(owner)??0)+1;trackVersions.set(owner,revision);
    if(value?.roll){
      const rolls=value.activeRolls?.length?value.activeRolls:[value.roll];
      void Promise.all(rolls.map(hydrate)).then(activeRolls=>{
        if(!valid(version)||trackVersions.get(owner)!==revision)return;
        const roll=activeRolls.find(item=>item.id===value.roll.id)??unpackRoll(value.roll);
        visible.add(owner);emit('track',{owner,roll,activeRolls});
        for(const item of activeRolls)receive(item,true);
      }).catch(fail);
    }else if(visible.delete(owner)){emit('track',{owner,roll:null});emit('clear',owner);}
  }
  function updateRoom(value:RoomSnapshot,version:number){
    if(!valid(version))return;
    canonicalCode=value.code;emit('room',value);
    const active=new Set(value.participants.map(member=>member.id));
    for(const [owner,stop] of tracks)if(!active.has(owner)){stop();tracks.delete(owner);if(visible.delete(owner)){emit('track',{owner,roll:null});emit('clear',owner);}}
    for(const owner of active)if(!tracks.has(owner))tracks.set(owner,transport.watch(trackMethod,{key,viewer:owner},value=>updateTrack(owner,value,version),error=>{if(valid(version))fail(error);}));
    if(value.cursor!==undefined&&value.cursor>cursor)void catchup().catch(fail);
  }
  async function recover(version:number){
    const currentKey=key;
    const view=await transport.call('diceDemoV2:view',{key:currentKey}) as RoomSnapshot;
    if(!valid(version))return;
    const latest=await Promise.all(view.participants.map(async member=>({owner:member.id,track:await transport.call(trackMethod,{key:currentKey,viewer:member.id}) as Track|null})));
    if(!valid(version))return;
    const currentOwners=new Set(latest.filter(record=>record.track?.roll).map(record=>record.owner));
    for(const owner of visible)if(!currentOwners.has(owner)){visible.delete(owner);emit('track',{owner,roll:null});emit('clear',owner);}
    for(const record of latest)updateTrack(record.owner,record.track,version);
    // view.cursor is authoritative even if every latest tray was cleared.
    if(view.cursor===undefined)throw new Error('Expired history requires a backend room cursor for recovery.');
    cursor=view.cursor;
    updateRoom(view,version);
  }
  async function catchup(){
    if(!joined||disposed)return;
    refreshAgain=true;if(refreshing)return refreshing;
    const version=epoch,args=session();
    const task=(async()=>{
      let more=true;
      while(valid(version)&&(more||refreshAgain)){
        refreshAgain=false;
        let page:{rolls:ParticipantRoll[];cursor:number;hasMore:boolean};
        try{page=await transport.call('diceDemoV2:events',{...args,after:cursor,limit:20});}
        catch(error){if(String(error).includes('CURSOR_EXPIRED')){await recover(version);more=true;continue;}throw error;}
        if(!valid(version))return;
        for(const roll of page.rolls)receive(roll,true);
        cursor=Math.max(cursor,page.cursor);more=page.hasMore;
      }
    })().finally(()=>{if(refreshing===task)refreshing=undefined;});
    refreshing=task;return task;
  }
  async function syncClock(version=epoch){
    if(options.clockEstimate){const estimate=options.clockEstimate();offset=estimate.offset;uncertainty=estimate.uncertainty;return;}
    const samples:ClockSample[]=[];
    for(let i=0;i<3;i++){const start=local();const server=await transport.call('diceDemo:clock',{});if(!valid(version))return; samples.push({start,end:local(),server});}
    const estimate=estimateClock(samples);offset=estimate.offset;uncertainty=estimate.uncertainty;
  }
  function stop(cancelResults:boolean){
    roomStop?.();roomStop=undefined;for(const stop of tracks.values())stop();tracks.clear();
    if(heartbeat)clearInterval(heartbeat);heartbeat=undefined;
    if(cancelResults){for(const timer of timers.values())clearTimeout(timer);timers.clear();visible.clear();}
  }
  const api={
    on<K extends keyof ClientEvents>(name:K,listener:(value:ClientEvents[K])=>void){let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(listener);return()=>{set!.delete(listener);};},
    async join(nextKey=key){
      if(disposed)throw new Error('Controller disposed.');
      const previous=joined?session():undefined, changed=nextKey!==key&&nextKey.toUpperCase()!==canonicalCode;
      epoch++;const version=epoch;stop(changed);refreshing=undefined;refreshAgain=false;joined=false;
      if(changed){seen.clear();requests.clear();inFlight.clear();motions.clear();motionBytes.clear();cursor=0;canonicalCode=null;key=nextKey;}
      emit('status','connecting');await syncClock(version);if(!valid(version))return;
      await transport.call('diceDemoV2:join',{...session(),...profile,ready:true,uncertainty:clockEstimate().uncertainty});if(!valid(version))return;
      joined=true;
      if(previous&&changed)void transport.call('diceDemoV2:leave',previous).catch(()=>{});
      const initial=await transport.call('diceDemoV2:view',{key}) as RoomSnapshot;
      if(!valid(version))return;updateRoom(initial,version);
      roomStop=transport.watch('diceDemoV2:view',{key},value=>updateRoom(value,version),error=>{if(valid(version))fail(error);});
      heartbeat=setInterval(()=>{if(!valid(version))return;void transport.call('diceDemoV2:join',{...session(),...profile,ready:true,uncertainty:clockEstimate().uncertainty}).catch(error=>{if(valid(version))fail(error);});void syncClock(version).catch(error=>{if(valid(version))fail(error);});},10000);
      await catchup();if(valid(version))emit('status','connected');
    },
    async observe(){
      if(disposed)throw new Error('Controller disposed.');
      epoch++;const version=epoch;stop(false);refreshing=undefined;refreshAgain=false;joined=false;
      emit('status','connecting');await syncClock(version);if(!valid(version))return;
      joined=true;
      const view=await transport.call('diceDemoV2:view',{key}) as RoomSnapshot;
      if(!valid(version))return;updateRoom(view,version);
      roomStop=transport.watch('diceDemoV2:view',{key},value=>updateRoom(value,version),error=>{if(valid(version))fail(error);});
      await catchup();if(valid(version))emit('status','connected');
    },
    async leave(){const args=joined?session():undefined;epoch++;joined=false;stop(true);seen.clear();cursor=0;refreshing=undefined;requests.clear();inFlight.clear();if(args)await transport.call('diceDemoV2:leave',args);emit('status','left');},
    async profile(next:Profile){assertJoined();const version=epoch;await transport.call('diceDemoV2:customize',{...session(),...next});if(valid(version))profile=next;},
    async clear(){assertJoined();await transport.call('diceDemoV2:clearTray',session());},
    async roll(input:RollInput={},prepare?:PresentationProvider):Promise<ParticipantRoll>{
      assertJoined();trimRequests();
      const dice={...validateDiceConfiguration(input.dice??defaultDice)},edges=input.edges??0,banes=input.banes??0;
      if(!Number.isInteger(edges)||!Number.isInteger(banes)||edges<0||edges>2||banes<0||banes>2)throw new Error('Modifier counts must be integers from 0 to 2.');
      const id=input.id??(options.requestId??(()=>crypto.randomUUID()))();
      if(!id||id.length>128)throw new Error('Request ID must contain 1–128 characters.');
      const fingerprint=JSON.stringify([dice.kind,dice.sides,dice.count,Boolean(dice.bonusD4),edges,banes]);
      let request=requests.get(id);
      if(request&&request.fingerprint!==fingerprint)throw new Error('REQUEST_CONFLICT: reuse an ID only for the same dice and modifiers.');
      if(request?.accepted){receive(request.accepted);return request.accepted;}
      const existing=inFlight.get(id);if(existing)return existing;
      if(!request){request={id,dice,edges,banes,fingerprint};requests.set(id,request);if(requests.size>1000)requests.delete(requests.keys().next().value!);}
      const retained=request,version=epoch,args=session();
      const task=(async()=>{
        if(!retained.faces)retained.faces=await transport.call('diceDemo:sampleFaces',{...args,id,dice});
        if(!valid(version))throw new Error('Room changed while sampling the roll.');
        if(prepare&&!retained.motion){try{const motion=await prepare([...retained.faces!],dice);if(motion)retained.motion=packMotion(motion);}catch{/* Cosmetic failure does not change authoritative sampled faces. */}}
        if(!valid(version))throw new Error('Room changed while preparing the roll.');
        const result=await transport.call('diceDemoV2:throwDice',{...args,id,dice,faces:retained.faces,edges,banes,...(retained.motion?{motion:retained.motion}:{})}) as ParticipantRoll;
        if(!valid(version))throw new Error('Room changed while accepting the roll.');
        retained.accepted=result;delete retained.motion;receive(result);return result;
      })().finally(()=>{if(inFlight.get(id)===task)inFlight.delete(id);trimRequests();});
      inFlight.set(id,task);return task;
    },
    clock:now,
    clockEstimate,
    catchup,
    get key(){return key;},get identity(){return {...options.identity};},
    async dispose(){if(disposed)return;disposed=true;epoch++;joined=false;stop(true);requests.clear();inFlight.clear();motions.clear();motionBytes.clear();trackVersions.clear();seen.clear();listeners.clear();await transport.close?.();},
  };
  return api;
}
export type Controller = ReturnType<typeof createController>;
