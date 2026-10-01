import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoller, type AcceptedRoll, type Appearance, type RoomEvent, type Session, type Transport } from '../src/client';
import { resolveRoll, type RollRequest } from '../src/dice';
const appearance:Appearance={color:'#ff0000',ink:'#ffffff',pattern:'solid',font:'serif'};
const session:Session={roomId:'room-a',credential:'private-credential',memberId:'member-a'};
const request:RollRequest={requestId:'stable-a',dice:[{sides:10,count:2}],ruleset:'draw-steel/power'};
function roll(id:string,sequence:number,revealAt=Date.now()+2200):AcceptedRoll{return{id,sequence,memberId:session.memberId,name:'River',appearance,request:{...request,requestId:id},result:resolveRoll(request,[7,8]),acceptedAt:Date.now(),startsAt:Date.now()+200,revealAt,source:'generated'};}
function transport(events:RoomEvent[]=[]) {
 let update:(v:unknown)=>void=()=>{};
 const calls:{method:string;args:Record<string,unknown>}[]=[];
 const mock:Transport={call:vi.fn(async(method,args)=>{calls.push({method,args});if(method==='clock')return Date.now();if(method==='events'){const page=events.filter(e=>e.sequence>Number(args.after)).slice(0,100);return{events:page,cursor:page.at(-1)?.sequence??Number(args.after),hasMore:events.some(e=>e.sequence>(page.at(-1)?.sequence??Number(args.after)))};}if(method==='view')return{room:{id:session.roomId,expiresAt:Date.now()+86400000},members:[],cursor:events.at(-1)?.sequence??0,latest:events.flatMap(e=>e.roll?[e.roll]:[])};if(method==='roll')return events.find(e=>e.roll?.request.requestId===(args.request as RollRequest).requestId)?.roll;return{};}),watch:vi.fn((_method,_args,next)=>{update=next;return vi.fn();}),close:vi.fn()};
 return {mock,calls,update:()=>update({room:{id:session.roomId,expiresAt:Date.now()+86400000},members:[],cursor:events.at(-1)?.sequence??0,latest:events.flatMap(e=>e.roll?[e.roll]:[])})};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
afterEach(()=>{vi.useRealTimers();});

describe('controller semantic lifecycle without a renderer',()=>{
 it('delivers both rapid accepted results at their shared timestamps despite clear-before-reveal',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const first=roll('a',1),second=roll('b',2,Date.now()+2300);const events:RoomEvent[]=[{kind:'roll',sequence:1,memberId:session.memberId,roll:first},{kind:'roll',sequence:2,memberId:session.memberId,roll:second},{kind:'clear',sequence:3,memberId:session.memberId}];const t=transport(events),roller=createRoller({transport:t.mock,session});const accepted=vi.fn(),available=vi.fn(),clear=vi.fn();roller.on('result.accepted',accepted);roller.on('result.available',available);roller.on('clear',clear);await roller.resume();expect(accepted).toHaveBeenCalledTimes(2);expect(clear).toHaveBeenCalledWith(session.memberId);expect(available).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(2200);expect(available.mock.calls.map(c=>c[0].id)).toEqual(['a']);await vi.advanceTimersByTimeAsync(100);expect(available.mock.calls.map(c=>c[0].id)).toEqual(['a','b']);await roller.dispose();
 });
 it('retries stable requests without duplicate acceptance or availability',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const record=roll('stable-a',1);const t=transport([{kind:'roll',sequence:1,memberId:session.memberId,roll:record}]);const roller=createRoller({transport:t.mock,session});const accepted=vi.fn(),available=vi.fn();roller.on('result.accepted',accepted);roller.on('result.available',available);await roller.resume();expect(await roller.roll(request)).toEqual(record);expect(await roller.roll(request)).toEqual(record);await vi.advanceTimersByTimeAsync(2200);expect(accepted).toHaveBeenCalledTimes(1);expect(available).toHaveBeenCalledTimes(1);await roller.dispose();
 });
 it('reconnect does not redeliver results already made available',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const record=roll('a',1,Date.now()-1);const t=transport([{kind:'roll',sequence:1,memberId:session.memberId,roll:record}]),roller=createRoller({transport:t.mock,session}),available=vi.fn();roller.on('result.available',available);await roller.resume();await roller.resume();expect(available).toHaveBeenCalledTimes(1);await roller.dispose();
 });
 it('normalizes backend room view instead of leaking its envelope as RoomView',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport(),roller=createRoller({transport:t.mock,session}),room=vi.fn();roller.on('room',room);await roller.resume();t.update();expect(room).toHaveBeenCalledWith({id:session.roomId,expiresAt:Date.now()+86400000,members:[],cursor:0});await roller.dispose();
 });
 it('uses the configured local clock when calculating shared server offset',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport(),roller=createRoller({transport:t.mock,session,clock:()=>50000});await roller.resume();expect(roller.clock()).toBe(100000);await roller.dispose();
 });
 it('catches an update arriving while an events page is in flight',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport(),original=t.mock.call;let release!:(page:unknown)=>void;let calls=0;t.mock.call=vi.fn(async(method,args)=>{if(method==='events'&&calls++===0)return new Promise(resolve=>{release=resolve;});if(method==='events')return{events:[{kind:'roll',sequence:1,memberId:session.memberId,roll:roll('new',1)}],cursor:1,hasMore:false};return original(method,args);});const roller=createRoller({transport:t.mock,session}),accepted=vi.fn();roller.on('result.accepted',accepted);const resumed=roller.resume();await flush();t.update();release({events:[],cursor:0,hasMore:false});await resumed;await flush();expect(accepted).toHaveBeenCalledTimes(1);await roller.dispose();
 });
 it('cancels pending availability and closes owned transport on disposal',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport([{kind:'roll',sequence:1,memberId:session.memberId,roll:roll('a',1)}]),roller=createRoller({transport:t.mock,session}),available=vi.fn();roller.on('result.available',available);await roller.resume();await roller.dispose();await vi.advanceTimersByTimeAsync(5000);expect(available).not.toHaveBeenCalled();expect(t.mock.close).toHaveBeenCalledTimes(1);
 });
 it('recovers an expired event cursor from the authoritative latest snapshot',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const record=roll('retained',50,Date.now()-1),t=transport([{kind:'roll',sequence:50,memberId:session.memberId,roll:record}]);const original=t.mock.call;t.mock.call=vi.fn(async(method,args)=>{if(method==='events'&&Number(args.after)<50)throw Error('CURSOR_EXPIRED');return original(method,args);});const roller=createRoller({transport:t.mock,session}),available=vi.fn(),errors=vi.fn();roller.on('result.available',available);roller.on('error',errors);await roller.resume();expect(available).toHaveBeenCalledTimes(1);expect(available.mock.calls[0][0]).toMatchObject({id:'retained',historical:true});expect(errors).not.toHaveBeenCalled();expect(t.calls.some(call=>call.method==='events'&&call.args.after===50)).toBe(true);await roller.dispose();
 });
 it('keeps a pending reveal scheduled through same-room reconnect',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport([{kind:'roll',sequence:1,memberId:session.memberId,roll:roll('a',1)}]),roller=createRoller({transport:t.mock,session}),available=vi.fn();roller.on('result.available',available);await roller.resume();await vi.advanceTimersByTimeAsync(1000);await roller.resume();await vi.advanceTimersByTimeAsync(1200);expect(available).toHaveBeenCalledTimes(1);expect(available.mock.calls[0][0].historical).not.toBe(true);await roller.dispose();
 });
 it('suppresses an in-flight roll response after leaving its room',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000);const t=transport(),original=t.mock.call;let release!:(roll:AcceptedRoll)=>void;t.mock.call=vi.fn(async(method,args)=>method==='roll'?new Promise(resolve=>{release=resolve;}):original(method,args));const roller=createRoller({transport:t.mock,session}),accepted=vi.fn();roller.on('result.accepted',accepted);await roller.resume();const rolling=roller.roll(request);await roller.leave();release(roll('stale',1));await rolling;expect(accepted).not.toHaveBeenCalled();expect(roller.session).toBeUndefined();await roller.dispose();
 });

});
