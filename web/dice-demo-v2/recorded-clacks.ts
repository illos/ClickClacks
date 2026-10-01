// SPDX-License-Identifier: MIT
import one from './audio/clack-1.wav?url';
import two from './audio/clack-2.wav?url';
import three from './audio/clack-3.wav?url';
import four from './audio/clack-4.wav?url';

let recordings: Promise<ArrayBuffer[]> | undefined;

/** Cache encoded clips across audio sessions; decode fresh copies for each context. */
export function preloadClacks() {
  return recordings ??= Promise.all([one, two, three, four].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Dice audio could not load');
    return response.arrayBuffer();
  })).catch(error => { recordings = undefined; throw error; });
}

export async function loadRecordedClacks(context: AudioContext) {
  const clips = await preloadClacks();
  // decodeAudioData can detach its input. Preserve the cached bytes for tab recovery.
  return Promise.all(clips.map(async clip => {
    const buffer = await context.decodeAudioData(clip.slice(0));
    // Sample-rate conversion can overshoot the WAV's peak slightly. Keep headroom.
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const value of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
    }
    if (peak > 0.9) for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let sample = 0; sample < data.length; sample++) data[sample] = data[sample]! * 0.9 / peak;
    }
    return buffer;
  }));
}
