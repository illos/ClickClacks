// SPDX-License-Identifier: MIT
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
  let noise: AudioBuffer | undefined;
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
  function setEnabled(value: boolean) { enabled = value; if (!value) cancel(); }
  async function unlock() {
    if (!enabled || disposed) return;
    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') await context.resume();
    } catch { /* Audio is cosmetic; unsupported/blocked devices can still roll. */ }
  }
  function strike(at: number, strength: number, die: number, owner: string, density: number) {
    if (!context) return;
    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.09), context.sampleRate);
      const data = noise.getChannelData(0);
      // A sharp attack with several decaying body resonances, softly varied per die.
      for (let i = 0; i < data.length; i++) {
        const t = i / context.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.55
          + Math.sin(t * Math.PI * 2 * 920) * Math.exp(-t * 85) * 0.27
          + Math.sin(t * Math.PI * 2 * 1760) * Math.exp(-t * 125) * 0.18;
      }
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise;
    source.playbackRate.value = 0.88 + (die % 7) * 0.045 + Math.random() * 0.06;
    filter.type = 'lowpass'; filter.frequency.value = 4100;
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
  function visibility() { if (document.hidden) cancel(); }
  document.addEventListener('visibilitychange', visibility);
  function dispose() {
    disposed = true; cancel(); document.removeEventListener('visibilitychange', visibility);
    void context?.close().catch(() => {});
  }
  return { unlock, setEnabled, play, cancel, dispose };
}
