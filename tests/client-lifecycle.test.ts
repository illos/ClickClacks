import { expect, it, vi } from 'vitest';
import type { ConvexReactClient } from 'convex/react';
import { createController, reactTransport, type ParticipantRoll, type Transport } from '../lib/client';
const identity={viewer:'viewer',credential:'private'},profile={name:'Fixture',style:{color:'#ffffff',ink:'#000000',pattern:'solid' as const}};
it('delivers the already cached React query when attaching a fresh observer',()=>{
 const value={participants:[],expired:false,code:'ABCDEFGH'}, next=vi.fn(), unsubscribe=vi.fn();
 const client={watchQuery:()=>({onUpdate:()=>unsubscribe,localQueryResult:()=>value})} as unknown as ConvexReactClient;
 const stop=reactTransport(client).watch('diceDemoV2:view',{key:'room'},next,vi.fn());
 expect(next).toHaveBeenCalledExactlyOnceWith(value);
 stop();expect(unsubscribe).toHaveBeenCalledOnce();
});
it('does not restore a departed participant when an earlier recording fetch finishes',async()=>{
 let resolve!:(value:unknown)=>void;
 const motion=new Promise(resolvePromise=>{resolve=resolvePromise;});
 const callbacks=new Map<string,(value:any)=>void>();
 const transport:Transport={compactTracks:true,
  call:async(method)=>method==='diceDemoV2:motion'?motion:method==='diceDemoV2:view'?{participants:[{id:'viewer'}],expired:false,code:'ABCDEFGH',cursor:0}:{rolls:[],cursor:0,hasMore:false},
  watch:(method,_args,next)=>{callbacks.set(method,next);return()=>{callbacks.delete(method);};},
 };
 const controller=createController({transport,key:'room',identity,profile,clockEstimate:()=>({offset:0,uncertainty:1})});
 const track=vi.fn();controller.on('track',track);
 await controller.observe();
 const roll:ParticipantRoll={id:'roll',roller:'viewer',name:'Fixture',faces:[3],styles:[profile.style],startsAt:Date.now()+1000,duration:1000};
 callbacks.get('diceDemoV2:trackMetadata')!({roll,receipts:[]});
 callbacks.get('diceDemoV2:view')!({participants:[],expired:false,code:'ABCDEFGH',cursor:0});
 resolve({seed:1,stepMs:16,samples:[],offsets:[]});
 for(let i=0;i<12;i++)await Promise.resolve();
 await controller.dispose();
 expect(track).not.toHaveBeenCalled();
});
it('uses a share-code session with canonical compact recordings without rewriting its public key',async()=>{
 const alias='ABCDEFGH', canonical='canonical-room', callbacks=new Map<string,(value:any)=>void>();
 const calls=vi.fn(async(method:string)=>method==='diceDemoV2:view'?{participants:[{id:'viewer'}],expired:false,code:alias,canonicalKey:canonical,cursor:0}:method==='diceDemoV2:motion'?{seed:1,stepMs:16,samples:[],offsets:[]}:{rolls:[],cursor:0,hasMore:false});
 const watch=vi.fn((method:string,_args:Record<string,unknown>,next:(value:any)=>void)=>{callbacks.set(method,next);return()=>{};});
 const controller=createController({transport:{compactTracks:true,call:calls,watch},key:alias,identity,profile,clockEstimate:()=>({offset:0,uncertainty:1})});
 await controller.observe();
 callbacks.get('diceDemoV2:trackMetadata')!({roll:{id:'roll',roller:'viewer',name:'Fixture',faces:[3],styles:[profile.style],startsAt:Date.now()+1000,duration:1000},receipts:[]});
 for(let i=0;i<12;i++)await Promise.resolve();
 expect(controller.key).toBe(alias);
 expect(watch).toHaveBeenCalledWith('diceDemoV2:trackMetadata',{key:canonical,viewer:'viewer'},expect.any(Function),expect.any(Function));
 expect(calls).toHaveBeenCalledWith('diceDemoV2:motion',{key:canonical,viewer:'viewer',rollId:'roll'});
 expect(calls).toHaveBeenCalledWith('diceDemoV2:view',{key:alias});
 expect(calls).toHaveBeenCalledWith('diceDemoV2:events',expect.objectContaining({key:alias,credential:'private'}));
 await controller.dispose();
});
it('adopts a canonical recording key during cursor recovery and renews old alias subscriptions',async()=>{
 const alias='ABCDEFGH',canonical='canonical-room';let views=0,expired=true;
 const call=vi.fn(async(method:string)=>{
  if(method==='diceDemoV2:view')return{participants:[{id:'viewer'}],expired:false,code:alias,cursor:50,...(++views>1?{canonicalKey:canonical}:{})};
  if(method==='diceDemoV2:events'){if(expired){expired=false;throw Error('CURSOR_EXPIRED');}return{rolls:[],cursor:50,hasMore:false};}
  return null;
 });
 const watch=vi.fn(()=>()=>{});
 const controller=createController({transport:{compactTracks:true,call,watch},key:alias,identity,profile,clockEstimate:()=>({offset:0,uncertainty:1})});
 await controller.observe();
 expect(call).toHaveBeenCalledWith('diceDemoV2:trackMetadata',{key:canonical,viewer:'viewer'});
 expect(watch).toHaveBeenCalledWith('diceDemoV2:trackMetadata',{key:canonical,viewer:'viewer'},expect.any(Function),expect.any(Function));
 expect(controller.key).toBe(alias);
 await controller.dispose();
});
