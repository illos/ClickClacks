// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { diceImpacts, createDiceSound } from '../web/dice-demo-v2/dice-sound';
import type { ParticipantRoll } from '../web/dice-demo-v2/model';
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
