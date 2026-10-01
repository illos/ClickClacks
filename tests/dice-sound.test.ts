// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { diceImpacts, createDiceSound } from '../web/dice-demo-v2/dice-sound';
import type { ParticipantRoll } from '../web/dice-demo-v2/model';
vi.mock('../web/dice-demo-v2/recorded-clacks', () => ({
  preloadClacks: vi.fn(async () => []),
  loadRecordedClacks: vi.fn(async () => [{ getChannelData: () => new Float32Array([0, 0.9, 0]) }]),
}));
function motion(heights: number[][]) {
  return { seed: 1, stepMs: 20, offsets: [], samples: heights.flatMap(frame => frame.flatMap(y => [0, y, 0, 0, 0, 0, 1])) };
}
afterEach(() => vi.unstubAllGlobals());
it('times landing and bounce clacks from recorded frames, ignoring free fall, apex and rest', () => {
  const path = motion([[2], [1.8], [1.5], [1], [.5], [.7], [.8], [.7], [.5], [.5], [.5]]);
  expect(diceImpacts(path, 1).map(hit => hit.at)).toEqual([80, 160]);
  expect(diceImpacts(motion([[.5], [.5], [.5], [.5]]), 1)).toEqual([]);
  expect(diceImpacts(undefined, 2)).toEqual([]);
});
it('keeps separate simultaneous impacts for mixed or large dice pools', () => {
  expect(diceImpacts(motion([[1, 2], [.5, 1], [.7, .5], [.8, .7]]), 2).map(({at,die}) => [at,die])).toEqual([[20,0],[40,1]]);
});
it('schedules against the tray clock once, skips history, and stops pending audio on mute/background/disposal', async () => {
  const sources: any[] = [], listeners = new Map<string,()=>void>();
  const doc = { hidden: false, addEventListener: (key:string, fn:()=>void) => listeners.set(key, fn), removeEventListener: (key:string) => listeners.delete(key) };
  vi.stubGlobal('document', doc); vi.stubGlobal('performance', { now: () => 1000 });
  class Context {
    state='suspended'; currentTime=10; sampleRate=48000; destination={};
    resume=vi.fn(async()=>{this.state='running';}); close=vi.fn(async()=>{});
    createBuffer=()=>({getChannelData:()=>new Float32Array(4320)});
    createBufferSource=()=>{const node={playbackRate:{value:1},connect:vi.fn((target:any)=>target),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};sources.push(node);return node;};
    createBiquadFilter=()=>({frequency:{value:0},connect:(target:any)=>target,disconnect:vi.fn()});
    createGain=()=>({gain:{value:0},connect:()=>{},disconnect:vi.fn()});
  }
  vi.stubGlobal('AudioContext', Context);
  const audio=createDiceSound();
  const roll: ParticipantRoll = {id:'one',roller:'me',name:'Me',faces:[6],styles:[],startsAt:1200,duration:1000,motion:motion([[1],[.5],[.7]])};
  await audio.unlock(); audio.play(roll,100,false); expect(sources).toHaveLength(0);
  audio.setEnabled(true); await audio.unlock(); audio.play(roll,100,false);
  expect(sources[0].start).toHaveBeenCalledWith(10.12);
  audio.play(roll,100,false); expect(sources).toHaveLength(1);
  audio.play({...roll,id:'old',startsAt:0},100,false); expect(sources).toHaveLength(1);
  audio.setEnabled(false); expect(sources[0].stop).toHaveBeenCalledOnce();
  audio.setEnabled(true); await audio.unlock(); audio.play({...roll,id:'new'},100,false); doc.hidden=true;listeners.get('visibilitychange')!();expect(sources[1].stop).toHaveBeenCalledOnce();
  audio.dispose();expect(listeners.size).toBe(0);
});

it('resumes Safari interruption on a gesture and recreates a closed context', async () => {
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const contexts: Context[] = [];
  class Context {
    state = 'interrupted';
    resume = vi.fn(async () => { this.state = 'running'; });
    close = vi.fn(async () => {});
    constructor() { contexts.push(this); }
  }
  vi.stubGlobal('AudioContext', Context);
  const audio = createDiceSound(); audio.setEnabled(true);
  await audio.unlock(); expect(contexts[0]!.resume).toHaveBeenCalledOnce();
  contexts[0]!.state = 'interrupted';
  await audio.unlock(); expect(contexts[0]!.resume).toHaveBeenCalledTimes(2);
  contexts[0]!.state = 'closed';
  await audio.unlock(); expect(contexts).toHaveLength(2); expect(contexts[1]!.state).toBe('running');
  audio.dispose();
});

it('retires backgrounded audio and keeps the enabled setting for the next tap', async () => {
  const listeners = new Map<string, () => void>(), pageListeners = new Map<string, () => void>();
  const doc = { hidden: false, addEventListener: (key:string, fn:()=>void) => listeners.set(key, fn), removeEventListener: (key:string) => listeners.delete(key),
    defaultView: { addEventListener: (key:string, fn:()=>void) => pageListeners.set(key, fn), removeEventListener: (key:string) => pageListeners.delete(key) } };
  vi.stubGlobal('document', doc);
  const contexts: Context[] = [];
  class Context {
    state = 'running'; close = vi.fn(async () => {});
    constructor() { contexts.push(this); }
  }
  vi.stubGlobal('AudioContext', Context);
  const audio = createDiceSound(); audio.setEnabled(true); await audio.unlock();
  doc.hidden = true; listeners.get('visibilitychange')!();
  expect(contexts[0]!.close).toHaveBeenCalledOnce();
  await audio.unlock(); expect(contexts).toHaveLength(1);
  doc.hidden = false; listeners.get('visibilitychange')!();
  expect(contexts).toHaveLength(1); // No automatic audio session on return.
  await audio.unlock(); expect(contexts).toHaveLength(2); // Saved enablement survives.
  pageListeners.get('pagehide')!(); expect(contexts[1]!.close).toHaveBeenCalledOnce();
  audio.dispose(); expect(listeners.size).toBe(0); expect(pageListeners.size).toBe(0);
});

it('plays one crit accent at reveal, preserves clacks, skips ordinary/pool/history results and cancels owned cues', async () => {
  const sources: any[] = [], buffers: Float32Array[] = [];
  vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('performance', { now: () => 1000 });
  class Context {
    state = 'running'; currentTime = 10; sampleRate = 48000; destination = {};
    close = vi.fn(async () => {});
    createBuffer = (_channels: number, length: number) => {
      const data = new Float32Array(length); buffers.push(data);
      return { getChannelData: () => data };
    };
    createBufferSource = () => {
      const node = { buffer: undefined, playbackRate: {value:1}, connect: vi.fn((target:any) => target), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(node); return node;
    };
    createGain = () => ({gain:{value:0},connect:()=>{},disconnect:vi.fn()});
  }
  vi.stubGlobal('AudioContext', Context);
  const audio = createDiceSound(); audio.setEnabled(true); await audio.unlock();
  const power: ParticipantRoll = {id:'crit',roller:'me',name:'Me',faces:[9,10],styles:[],startsAt:1200,duration:1000,revealAt:1800,
    motion:motion([[1,1],[.5,1],[.7,1]])};
  audio.play(power,100,false);
  expect(sources).toHaveLength(2); // Original landing and separate result accent.
  expect(sources[0].start).toHaveBeenCalledWith(10.12);
  expect(sources[1].start).toHaveBeenCalledWith(10.7);
  expect(sources[1].connect.mock.calls[0][0].gain.value).toBe(0.7);
  audio.setCriticalVolume(0.35);
  expect(sources[1].connect.mock.calls[0][0].gain.value).toBe(0.35);
  expect(buffers).toHaveLength(1);
  audio.play(power,100,false); expect(sources).toHaveLength(2);
  audio.cancel('someone-else'); expect(sources[1].stop).not.toHaveBeenCalled();
  audio.cancel('me'); expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[1].stop).toHaveBeenCalledOnce();
  const still = motion([[1],[1],[1]]);
  audio.setCriticalVolume(0.4);
  audio.play({...power,id:'ordinary',faces:[8,10],motion:motion([[1,1],[1,1],[1,1]])},100,false);
  audio.play({...power,id:'pool',faces:[20,1],dice:{kind:'dice',sides:20,count:2},motion:motion([[1,1],[1,1],[1,1]])},100,false);
  audio.play({...power,id:'old',startsAt:0,revealAt:500},100,false);
  expect(sources).toHaveLength(2);
  audio.play({...power,id:'failure',faces:[1,3],dice:{kind:'dice',sides:20,count:1,bonusD4:true},motion:motion([[1,1],[1,1],[1,1]])},100,false);
  expect(sources).toHaveLength(3); expect(sources[2].start).toHaveBeenCalledWith(10.7);
  expect(sources[2].connect.mock.calls[0][0].gain.value).toBe(0.4);
  expect(buffers).toHaveLength(2); expect(buffers[0]).not.toEqual(buffers[1]);
  audio.setCriticalVolume(5);
  audio.play({...power,id:'loud',motion:motion([[1,1],[1,1],[1,1]])},100,false);
  expect(sources[3].connect.mock.calls[0][0].gain.value).toBe(1);
  audio.setCriticalVolume(-5);
  audio.play({...power,id:'quiet',motion:motion([[1,1],[1,1],[1,1]])},100,false);
  expect(sources[4].connect.mock.calls[0][0].gain.value).toBe(0);
  audio.setCriticalVolume(Number.NaN);
  audio.play({...power,id:'invalid',motion:motion([[1,1],[1,1],[1,1]])},100,false);
  expect(sources[5].connect.mock.calls[0][0].gain.value).toBe(0);
  audio.setEnabled(false); expect(sources[2].stop).toHaveBeenCalledOnce();
  audio.play({...power,id:'muted',faces:[20],dice:{kind:'dice',sides:20,count:1},motion:still},100,false);
  expect(sources).toHaveLength(6);
  audio.dispose();
});
