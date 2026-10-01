// SPDX-License-Identifier: MIT
import { ConvexClient } from 'convex/browser';
import { redactError } from './errors.ts';
export { redactError, RollerError, type RollerErrorCode } from './errors.ts';
import { makeFunctionReference } from 'convex/server';
import { defaultDice, validateDiceConfiguration, type DiceConfiguration } from '../shared/dice.ts';
import { recordedRevealDelay } from '../shared/timing.ts';
import { estimateClock, type ClockSample, type Motion, type Style } from '../web/dice-demo/model.ts';
import { packMotion, unpackRoll } from '../web/dice-demo/motion-codec.ts';
import type { ParticipantRoll, Room, Track } from '../web/dice-demo-v2/model.ts';

export type { DiceConfiguration, Style, Motion, ParticipantRoll };
export { parseRoomKey } from '../web/dice-demo-v2/model.ts';
export type Identity = { viewer:string; credential:string };
export type Profile = { name:string; style:Style };
export type DeliveredRoll = ParticipantRoll & { historical?:boolean };
export type RoomSnapshot = Room & { cursor?:number };
export interface Transport {
  call(method:string,args:Record<string,unknown>):Promise<any>;
  watch(method:string,args:Record<string,unknown>,next:(value:any)=>void,error:(error:Error)=>void):()=>void;
  close?():Promise<void>|void;
}
/** Explicit endpoint or an existing host connection; no deployment or room is created on import. */
export function convexTransport(url:string, supplied?:ConvexClient):Transport {
  const client=supplied??new ConvexClient(url);
  return {
    call:(method,args)=>['diceDemo:clock','diceDemo:sampleFaces'].includes(method)
      ? client.action(makeFunctionReference<'action'>(method),args)
      : ['diceDemoV2:view','diceDemoV2:track','diceDemoV2:events'].includes(method)
        ? client.query(makeFunctionReference<'query'>(method),args)
        : client.mutation(makeFunctionReference<'mutation'>(method),args),
    watch:(method,args,next,error)=>client.onUpdate(makeFunctionReference<'query'>(method),args,next,error),
    close:()=>supplied?undefined:client.close(),
  };
}
export type RollInput = { id?:string; dice?:DiceConfiguration; edges?:number; banes?:number };
export type PresentationProvider = (faces:number[],dice:DiceConfiguration)=>Promise<Motion|undefined>;
export type ClientEvents = {
  accepted:DeliveredRoll; available:DeliveredRoll; room:RoomSnapshot;
  track:{owner:string;roll:DeliveredRoll|null}; clear:string;
  status:'connecting'|'connected'|'interrupted'|'left'; error:Error;
};
type Request = { id:string; dice:DiceConfiguration; edges:number; banes:number; fingerprint:string; faces?:number[]; motion?:Motion; accepted?:ParticipantRoll };

/** Instance-owned authority/delivery controller. Cosmetic presentation never determines availability. */
export function createController(options:{transport:Transport;key:string;identity:Identity;profile:Profile;clock?:()=>number;requestId?:()=>string}) {
  const transport:Transport={
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
  const now=()=>local()+offset;
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
    if(value?.roll){const roll=unpackRoll(value.roll);visible.add(owner);emit('track',{owner,roll});receive(roll,true);}
    else if(visible.delete(owner)){emit('track',{owner,roll:null});emit('clear',owner);}
  }
  function updateRoom(value:RoomSnapshot,version:number){
    if(!valid(version))return;
    canonicalCode=value.code;emit('room',value);
    const active=new Set(value.participants.map(member=>member.id));
    for(const [owner,stop] of tracks)if(!active.has(owner)){stop();tracks.delete(owner);if(visible.delete(owner)){emit('track',{owner,roll:null});emit('clear',owner);}}
    for(const owner of active)if(!tracks.has(owner))tracks.set(owner,transport.watch('diceDemoV2:track',{key,viewer:owner},value=>updateTrack(owner,value,version),error=>{if(valid(version))fail(error);}));
    void catchup().catch(fail);
  }
  async function recover(version:number){
    const currentKey=key;
    const view=await transport.call('diceDemoV2:view',{key:currentKey}) as RoomSnapshot;
    if(!valid(version))return;
    const latest=await Promise.all(view.participants.map(async member=>({owner:member.id,track:await transport.call('diceDemoV2:track',{key:currentKey,viewer:member.id}) as Track|null})));
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
      if(changed){seen.clear();requests.clear();inFlight.clear();cursor=0;canonicalCode=null;key=nextKey;}
      emit('status','connecting');await syncClock(version);if(!valid(version))return;
      await transport.call('diceDemoV2:join',{...session(),...profile,ready:true,uncertainty});if(!valid(version))return;
      joined=true;
      if(previous&&changed)void transport.call('diceDemoV2:leave',previous).catch(()=>{});
      const initial=await transport.call('diceDemoV2:view',{key}) as RoomSnapshot;
      if(!valid(version))return;updateRoom(initial,version);
      roomStop=transport.watch('diceDemoV2:view',{key},value=>updateRoom(value,version),error=>{if(valid(version))fail(error);});
      heartbeat=setInterval(()=>{if(!valid(version))return;void transport.call('diceDemoV2:join',{...session(),...profile,ready:true,uncertainty}).then(()=>valid(version)?catchup():undefined).catch(error=>{if(valid(version))fail(error);});void syncClock(version).catch(error=>{if(valid(version))fail(error);});},10000);
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
      assertJoined();
      const dice={...validateDiceConfiguration(input.dice??defaultDice)},edges=input.edges??0,banes=input.banes??0;
      if(!Number.isInteger(edges)||!Number.isInteger(banes)||edges<0||edges>2||banes<0||banes>2)throw new Error('Modifier counts must be integers from 0 to 2.');
      const id=input.id??(options.requestId??(()=>crypto.randomUUID()))();
      if(!id||id.length>128)throw new Error('Request ID must contain 1–128 characters.');
      const fingerprint=JSON.stringify([dice.kind,dice.sides,dice.count,edges,banes]);
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
        retained.accepted=result;receive(result);return result;
      })().finally(()=>{if(inFlight.get(id)===task)inFlight.delete(id);});
      inFlight.set(id,task);return task;
    },
    clock:now,
    clockEstimate:()=>({offset,uncertainty}),
    catchup,
    get key(){return key;},get identity(){return {...options.identity};},
    async dispose(){if(disposed)return;disposed=true;epoch++;joined=false;stop(true);listeners.clear();await transport.close?.();},
  };
  return api;
}
export type Controller = ReturnType<typeof createController>;
