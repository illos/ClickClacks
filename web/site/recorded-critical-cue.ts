// SPDX-License-Identifier: MIT
import { cinematicCriticalCue } from './cinematic-critical-cue';
import type { criticalCue } from '../dice-demo-v2/critical-cue';

/** Decode the user-selected private recording before enabling the listening demo. */
export async function loadRecordedCriticalCue(): Promise<typeof criticalCue> {
  const response = await fetch(`${import.meta.env.BASE_URL}assets/crit-sword-draw.wav`);
  if (!response.ok) throw new Error('Sword recording unavailable');
  const decoder = new OfflineAudioContext(1, 1, 48000);
  const recording = await decoder.decodeAudioData(await response.arrayBuffer());
  const original = recording.getChannelData(0);
  const rates = new Map<number, Float32Array>([[recording.sampleRate, original]]);
  return (sampleRate, result) => {
    if (result === 'failure') return cinematicCriticalCue(sampleRate, result);
    let samples = rates.get(sampleRate);
    if (!samples) {
      samples = new Float32Array(Math.ceil(recording.duration * sampleRate));
      for (let index = 0; index < samples.length; index++) {
        const position = index * recording.sampleRate / sampleRate;
        const left = Math.floor(position), blend = position - left;
        samples[index] = (original[left] ?? 0) * (1 - blend) + (original[left + 1] ?? 0) * blend;
      }
      rates.set(sampleRate, samples);
    }
    return samples;
  };
}
