// SPDX-License-Identifier: MIT
import type { CriticalResult } from '../../lib/critical';

/** Short, original result accents. Separate from the recorded landing clacks. */
export function criticalCue(sampleRate: number, result: Exclude<CriticalResult, null>): Float32Array {
  const success = result === 'success';
  const notes = success ? [523.25, 659.25, 783.99] : [220, 174.61, 130.81];
  const spacing = 0.065, tail = 0.2;
  const samples = new Float32Array(Math.ceil(sampleRate * (spacing * 2 + tail)));
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    let value = 0;
    for (let note = 0; note < notes.length; note++) {
      const age = time - note * spacing;
      if (age < 0 || age >= tail) continue;
      const envelope = Math.min(1, age / 0.004) * Math.exp(-age * 25) * Math.min(1, (tail - age) / 0.015);
      const phase = 2 * Math.PI * notes[note]! * age;
      value += envelope * (Math.sin(phase) + (success ? 0.18 : 0.3) * Math.sin(phase * 2)) * 0.3;
    }
    samples[index] = value;
  }
  return samples;
}
