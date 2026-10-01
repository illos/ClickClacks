// SPDX-License-Identifier: MIT
import type { CriticalResult } from '../../lib/critical';

/** Original synthesized audition sounds; only the private listening demo uses them. */
export function cinematicCriticalCue(sampleRate: number, result: Exclude<CriticalResult, null>): Float32Array {
  const success = result === 'success';
  const duration = success ? 0.95 : 1.3;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = success ? 0x51a7 : 0xfa11;
  let smoothNoise = 0, slowNoise = 0, bladePhase = 0, groanPhase = 0;
  // Inharmonic partials give the blade a metallic ring rather than a musical chime.
  const partials = [1, 1.477, 2.093, 2.731, 3.619];
  let peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    smoothNoise += (noise - smoothNoise) * (1 - Math.exp(-2 * Math.PI * 3800 / sampleRate));
    slowNoise += (noise - slowNoise) * (1 - Math.exp(-2 * Math.PI * 650 / sampleRate));
    let value = 0;
    if (success) {
      // A breath of metal sliding out, then the sharp blade ring at the end of the draw.
      const scrape = Math.min(1, time / 0.06) * Math.exp(-Math.max(0, time - 0.14) * 23);
      value += (smoothNoise - slowNoise) * scrape * 0.65;
      const age = Math.max(0, time - 0.12);
      bladePhase += 2 * Math.PI * (1780 + 580 * Math.exp(-age * 22)) / sampleRate;
      if (time >= 0.12) {
        const attack = Math.min(1, age / 0.003);
        for (let mode = 0; mode < partials.length; mode++) {
          // Higher partials die first, leaving a clean, thin steel tail.
          value += Math.sin(bladePhase * partials[mode]!) * attack
            * Math.exp(-age * (5.2 + mode * 2.8)) * (0.32 / (1 + mode * 0.7));
        }
      }
    } else {
      // A heavy hit under a falling, dissonant resonance: ominous, without a comic sting.
      const attack = Math.min(1, time / 0.004);
      const thumpPhase = 2 * Math.PI * (48 * time + 90 * (1 - Math.exp(-time * 18)) / 18);
      value += Math.sin(thumpPhase) * attack * Math.exp(-time * 8) * 0.7;
      value += slowNoise * attack * Math.exp(-time * 18) * 0.8;
      groanPhase += 2 * Math.PI * (68 + 135 * Math.exp(-time * 3.8)) / sampleRate;
      value += (Math.sin(groanPhase) + 0.45 * Math.sin(groanPhase * 1.414)
        + 0.22 * Math.sin(groanPhase * 2.713)) * Math.min(1, time / 0.015)
        * Math.exp(-time * 3.1) * 0.35;
    }
    // Smooth endpoints avoid accidental speaker clicks; normalize both cues for the volume control.
    value *= Math.min(1, time / 0.002, (duration - time) / 0.08);
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak > 0) for (let index = 0; index < samples.length; index++) samples[index] *= 0.78 / peak;
  return samples;
}
