import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheRoll, loadHistory, loadPreferences, loadProfile, saveProfile, savePreferences } from '../web/site/storage';
import { claimIdentity, readIdentity } from '../web/site/session';
import type { ParticipantRoll } from '../web/dice-demo-v2/model';
function storage(){const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),clear:()=>values.clear()};}
const profile={name:'River',style:{color:'#70dac3',ink:'#fff4e5',pattern:'solid' as const,font:'serif' as const}};
const roll=(id:string,startsAt:number):ParticipantRoll=>({id,name:'River',roller:'viewer',styles:[profile.style,profile.style],faces:[7,8],startsAt,duration:1000,total:15,source:'generated',motion:{seed:1,stepMs:16,samples:[1,2,3],offsets:[]}});
beforeEach(()=>{vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());vi.stubGlobal('indexedDB',undefined);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('site-owned persistence and private identity',()=>{
 it('defaults old and invalid appearance settings to System and preserves profile while saving theme',()=>{
  expect(loadPreferences().theme).toBe('system');
  saveProfile(profile);
  savePreferences({...loadPreferences(),theme:'light'});
  expect(loadPreferences()).toMatchObject({theme:'light',profile});
  localStorage.setItem('powerroller.preferences.v2',JSON.stringify({version:2,preferences:{profile,theme:'invalid'}}));
  expect(loadPreferences()).toMatchObject({theme:'system',profile});
 });
 it('defaults sound off and persists only an explicit boolean preference',()=>{
  expect(loadPreferences().sound).toBe(false);
  savePreferences({...loadPreferences(),sound:true});expect(loadPreferences().sound).toBe(true);
  localStorage.setItem('powerroller.preferences.v2',JSON.stringify({version:2,preferences:{sound:'true'}}));expect(loadPreferences().sound).toBe(false);
 });
 it('validates malformed saved profiles before restoring them',()=>{
  localStorage.setItem('powerroller.preferences.v2',JSON.stringify({version:2,preferences:{profile:{...profile,style:{...profile.style,font:'invalid'}},motion:'invalid',room:2}}));expect(loadProfile()).toBeUndefined();expect(loadPreferences()).toMatchObject({motion:'device',room:undefined});saveProfile(profile);expect(loadProfile()).toEqual(profile);
 });
 it('keeps preferences usable in memory when local storage throws',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}});expect(()=>saveProfile(profile)).not.toThrow();expect(loadProfile()).toEqual(profile);
 });
 it('deduplicates compact history and partitions it by backend and room in blocked IndexedDB',async()=>{
  const suffix=crypto.randomUUID(),backendA=`a-${suffix}`,backendB=`b-${suffix}`;await cacheRoll(backendA,'same',roll('same-id',1));await cacheRoll(backendB,'same',roll('same-id',2));await cacheRoll(backendA,'other',roll('same-id',3));await cacheRoll(backendA,'same',roll('same-id',1));expect((await loadHistory(backendA,'same')).map(value=>value.startsAt)).toEqual([1]);expect((await loadHistory(backendB,'same')).map(value=>value.startsAt)).toEqual([2]);expect((await loadHistory(backendA,'other')).map(value=>value.startsAt)).toEqual([3]);expect((await loadHistory(backendA,'same'))[0]).not.toHaveProperty('motion');
 });
 it('sorts newest-first and applies the 30-day history retention in memory fallback',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const backend=crypto.randomUUID();await cacheRoll(backend,'room',roll('old',1));await cacheRoll(backend,'room',roll('new',2));expect((await loadHistory(backend,'room')).map(value=>value.id)).toEqual(['new','old']);await vi.advanceTimersByTimeAsync(31*86400000);expect(await loadHistory(backend,'room')).toEqual([]);
 });
 it('ignores malformed IndexedDB rows rather than returning unsafe cached log values',async()=>{
  const backend=crypto.randomUUID();const values=[{backend,room:'room',savedAt:Date.now(),roll:{id:'bad',startsAt:'yesterday'}}];
  const db={transaction:()=>({objectStore:()=>({getAll:()=>{const request:any={result:values};queueMicrotask(()=>request.onsuccess?.());return request;}})}),close:vi.fn()};
  vi.stubGlobal('indexedDB',{open:()=>{const request:any={result:db};queueMicrotask(()=>request.onsuccess?.());return request;}});
  expect(await loadHistory(backend,'room')).toEqual([]);
 });
 it('keeps credentials session-scoped by backend and rejects malformed saved identities',()=>{
  const first=readIdentity('a'),second=readIdentity('b');expect(first.viewer).not.toBe(second.viewer);expect(first.credential.length).toBeGreaterThanOrEqual(64);expect(readIdentity('a')).toEqual(first);expect(localStorage.getItem('powerroller.preferences.v2')).toBeNull();sessionStorage.setItem('powerroller.identity.v1:a',JSON.stringify({viewer:first.viewer,credential:'short'}));expect(readIdentity('a')).not.toEqual(first);
 });
 it('gives a duplicated active tab a fresh participant credential',async()=>{
  vi.useFakeTimers();class Channel {static all=new Set<Channel>();listeners:((event:any)=>void)[]=[];constructor(readonly name:string){Channel.all.add(this);}addEventListener(_name:string,listener:(event:any)=>void){this.listeners.push(listener);}postMessage(data:unknown){for(const channel of Channel.all)if(channel!==this&&channel.name===this.name)queueMicrotask(()=>channel.listeners.forEach(listener=>listener({data})));}close(){Channel.all.delete(this);}}
  vi.stubGlobal('BroadcastChannel',Channel);const initial=readIdentity('copied'),first=claimIdentity(initial,'copied');await vi.advanceTimersByTimeAsync(200);expect(await first.ready).toEqual(initial);const second=claimIdentity(initial,'copied');await vi.advanceTimersByTimeAsync(200);const fresh=await second.ready;expect(fresh.viewer).not.toBe(initial.viewer);expect(fresh.credential).not.toBe(initial.credential);first.dispose();second.dispose();expect(Channel.all.size).toBe(0);
 });
});

it('retains new preferences in memory when writes hit quota but reads still work',()=>{
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('quota');}});
 const latest={...profile,name:'Hypatia'};saveProfile(latest);expect(loadProfile()).toEqual(latest);
});
