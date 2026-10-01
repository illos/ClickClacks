// SPDX-License-Identifier: MIT
/** Independently synthesized wood impact. Modal balance and short decay are
 * informed by measurements of Owlbear Rodeo's wood recordings; no audio is copied. */
export function woodClack(sampleRate: number, variant = 0): Float32Array {
  const data = new Float32Array(Math.ceil(sampleRate * 0.07));
  // Reference wood spectra concentrate around 650, 1200, 2100 and 3400 Hz.
  // Slightly different resonances keep multiple dice from sounding identical.
  const shift = [0.96, 1, 1.025, 1.055][variant % 4]!;
  const modes = [
    { hz: 650 * shift, amplitude: 0.55, decay: 100 },
    { hz: 1190 / shift, amplitude: 0.35, decay: 140 },
    { hz: 2110 * shift, amplitude: 0.28, decay: 180 },
    { hz: 3390 / shift, amplitude: 0.5, decay: 220 },
  ];
  let grain = 0, peak = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate, white = Math.random() * 2 - 1;
    grain = grain * 0.7 + white * 0.3;
    const attack = Math.min(1, t / 0.00015);
    const tail = Math.min(1, (data.length - 1 - i) / (sampleRate * 0.004));
    let value = white * Math.exp(-t * 550) * 0.06
      + grain * (Math.exp(-t * 250) * 0.18 + Math.exp(-t * 65) * 0.07);
    for (const mode of modes)
      value += Math.sin(t * Math.PI * 2 * mode.hz) * Math.exp(-t * mode.decay) * mode.amplitude;
    data[i] = value * attack * tail;
    peak = Math.max(peak, Math.abs(data[i]!));
  }
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
  return data;
}
