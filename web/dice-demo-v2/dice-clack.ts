// SPDX-License-Identifier: MIT
/** Independent dice-on-dice synthesis guided by measured Owlbear collision clips.
 * Brief treble-rich contacts replace wood's longer low-mid resonances. */
export function diceClack(sampleRate: number, variant = 0): Float32Array {
  const data = new Float32Array(Math.ceil(sampleRate * 0.05));
  const shift = [0.96, 1, 1.035, 0.985][variant % 4]!;
  const secondContact = [0.0115, 0.0085, 0.009, 0.0095][variant % 4]!;
  function contact(age: number) {
    if (age < 0) return 0;
    const attack = Math.min(1, age / 0.000025);
    return attack * (
      Math.sin(age * Math.PI * 2 * 5100 * shift) * Math.exp(-age * 2800) * 0.48
      + Math.sin(age * Math.PI * 2 * 7350 / shift) * Math.exp(-age * 3200) * 0.9
      + Math.sin(age * Math.PI * 2 * 9300 * shift) * Math.exp(-age * 4500) * 0.18
    );
  }
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const body = Math.sin(t * Math.PI * 2 * 170) * Math.exp(-t * 70) * 0.035;
    const grain = (Math.random() * 2 - 1) * Math.exp(-t * 4000) * 0.025;
    const tail = Math.min(1, (data.length - 1 - i) / (sampleRate * 0.003));
    data[i] = (contact(t) + contact(t - secondContact) * 0.45 + body + grain)
      * Math.min(1, t / 0.000025) * tail;
    peak = Math.max(peak, Math.abs(data[i]!));
  }
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
  return data;
}
