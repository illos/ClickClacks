// SPDX-License-Identifier: MIT
import sword from './audio/crit-sword-draw.wav?url';
import failure from './audio/crit-fail.wav?url';

let recordings: Promise<ArrayBuffer[]> | undefined;

/** Cache encoded result cues; fresh decode copies preserve Safari session recovery. */
export function preloadResults() {
  return recordings ??= Promise.all([sword, failure].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Result audio could not load');
    return response.arrayBuffer();
  })).catch(error => { recordings = undefined; throw error; });
}

export async function loadRecordedResults(context: AudioContext) {
  const clips = await preloadResults();
  return Promise.all(clips.map(clip => context.decodeAudioData(clip.slice(0))));
}
