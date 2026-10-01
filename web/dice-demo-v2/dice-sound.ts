// SPDX-License-Identifier: MIT
import { acquireIosAudioSession } from './ios-audio-session';
import { woodClack } from './wood-clack';
import type { Motion } from '../dice-demo/model';
import { revealDelay, type ParticipantRoll } from './model';

export type DiceImpact = { at: number; strength: number; die: number };

/** Detect bounce/landing impulses from the same 60 Hz path that the tray replays.
 * Free fall and the apex have no upward velocity impulse; quiet settling is ignored. */
export function diceImpacts(motion: Motion | undefined, count: number): DiceImpact[] {
  if (!motion || !Number.isFinite(motion.stepMs) || motion.stepMs <= 0 || count < 1) return [];
  const stride = count * 7, frames = motion.samples.length / stride;
  if (!Number.isInteger(frames)) return [];
  const impacts: DiceImpact[] = [], seconds = motion.stepMs / 1000;
  for (let die = 0; die < count; die++) {
    let last = -Infinity;
    for (let frame = 1; frame < frames - 1; frame++) {
      const y = motion.samples[frame * stride + die * 7 + 1]!;
      const before = (y - motion.samples[(frame - 1) * stride + die * 7 + 1]!) / seconds;
      const after = (motion.samples[(frame + 1) * stride + die * 7 + 1]! - y) / seconds;
      const at = frame * motion.stepMs;
      if (before < -0.7 && after - before > 1.2 && after > before * 0.25 && at - last >= 70) {
        impacts.push({ at, strength: Math.min(1, Math.abs(before) / 7), die });
        last = at;
      }
    }
  }
  return impacts.sort((a, b) => a.at - b.at);
}

/** Procedural plastic-on-wood clacks: a short filtered noise strike and damped
 * resonances. No downloaded recording, network request, or third-party audio asset. */
export function createDiceSound() {
  let context: AudioContext | undefined, enabled = false, disposed = false;
  let noises: AudioBuffer[] = [];
  let restoreSession: (() => void) | undefined;
  const played = new Set<string>();
  const voices = new Map<AudioBufferSourceNode, string>();
  function cancel(owner?: string) {
    for (const [source, roller] of voices) {
      if (owner !== undefined && owner !== roller) continue;
      try { source.stop(); } catch {}
      source.disconnect();
      voices.delete(source);
    }
  }
  function setEnabled(value: boolean) { enabled = value; if (!value) releaseContext(); }
  async function unlock() {
    if (!enabled || disposed || document.hidden) return;
    try {
      if (!context || context.state === 'closed') {
        restoreSession?.();
        restoreSession = acquireIosAudioSession();
        context = new AudioContext();
        noises = [];
      }
      // Safari uses 'interrupted' after app/tab switching or screen locking.
      // Resume every recoverable non-running state on the current user gesture.
      if (context.state !== 'running') await context.resume();
    } catch {
      if (!context || context.state === 'closed') { restoreSession?.(); restoreSession = undefined; }
      /* Audio is cosmetic; unsupported/blocked devices can still roll. */
    }
  }
  function strike(at: number, strength: number, die: number, owner: string, density: number) {
    if (!context) return;
    if (!noises.length) {
      for (let variant = 0; variant < 4; variant++) {
        const samples = woodClack(context.sampleRate, variant);
        const buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        noises.push(buffer);
      }
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noises[die % noises.length]!;
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    filter.type = 'lowpass'; filter.frequency.value = 6400;
    gain.gain.value = (0.12 + strength * 0.26) / Math.sqrt(density);
    source.connect(filter).connect(gain).connect(context.destination);
    voices.set(source, owner);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(at);
  }
  function play(roll: ParticipantRoll, offset: number, reduced: boolean) {
    if (!enabled || disposed || document.hidden || context?.state !== 'running') return;
    const key = JSON.stringify([roll.roller, roll.id]);
    if (played.has(key)) return;
    played.add(key);
    if (played.size > 512) played.delete(played.values().next().value!);
    const now = performance.now() + offset;
    const impacts = reduced || !roll.motion
      ? [{ at: revealDelay(roll), strength: 0.7, die: 0 }]
      : diceImpacts(roll.motion, roll.faces.length);
    for (const impact of impacts) {
      const delay = roll.startsAt + impact.at - now;
      // Never replay old history, missed impacts, or catch-up audio after backgrounding.
      if (delay < 0 || delay > 10000) continue;
      const density = impacts.filter(other => Math.abs(other.at - impact.at) < 35).length;
      strike(context.currentTime + delay / 1000, impact.strength, impact.die, roll.roller, density);
    }
  }
  function releaseContext() {
    cancel();
    const retired = context;
    context = undefined;
    noises = [];
    restoreSession?.(); restoreSession = undefined;
    // Some Safari contexts stay silent after interruption despite reporting running.
    // Retire them while hidden; the next gesture creates a fresh audio session.
    void retired?.close().catch(() => {});
  }
  function visibility() { if (document.hidden) releaseContext(); }
  document.addEventListener('visibilitychange', visibility);
  const page = document.defaultView;
  page?.addEventListener('pagehide', releaseContext);
  function dispose() {
    disposed = true; releaseContext();
    document.removeEventListener('visibilitychange', visibility);
    page?.removeEventListener('pagehide', releaseContext);
  }
  return { unlock, setEnabled, play, cancel, dispose };
}
