// SPDX-License-Identifier: MIT
// Only the coordinator's worker wrapper uses this entry. Authority sampling stays untouched.
import '../../web/dice-demo/physics-worker';
const exhausted = new URL(self.location.href).searchParams.get('mode') === 'exhausted';
let seeds = 0;
Object.defineProperty(crypto, 'getRandomValues', { value(values: Uint32Array) {
  const seed = exhausted || seeds++ % 2 === 0 ? 10 : 1;
  self.postMessage({ settlingSeed: seed });
  return values.fill(seed);
} });
// Static dependency evaluation installs onmessage before queued jobs can run.
// The crypto override above completes before those message tasks are dispatched.
export {};
