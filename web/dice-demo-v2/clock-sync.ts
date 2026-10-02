// SPDX-License-Identifier: MIT
import { estimateClock } from '../dice-demo/model';

/** Clock actions cannot be retried by Convex like mutations. Resume starts a fresh sample batch. */
export function startClockSync(
  ping: () => Promise<number>,
  connected: () => boolean,
  update: (clock: ReturnType<typeof estimateClock> | null) => void,
  options: { periodic?: boolean; initial?: boolean } = {},
) {
  let stopped = false,
    generation = 0,
    failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortSamples = new Set<() => void>();
  function invalidate() {
    generation++;
    clearTimeout(timer);
    for (const abort of abortSamples) abort();
    abortSamples.clear();
  }
  async function sample() {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let abort = () => {};
    const expiry = new Promise<never>((_, reject) => {
      abort = () => reject(new Error('Clock sample cancelled'));
      deadline = setTimeout(() => reject(new Error('Clock sample timed out')), 5000);
    });
    abortSamples.add(abort);
    try {
      return await Promise.race([ping(), expiry]);
    } finally {
      clearTimeout(deadline);
      abortSamples.delete(abort);
    }
  }
  function schedule(delay: number) {
    clearTimeout(timer);
    if (!stopped && !document.hidden) timer = setTimeout(() => void sync(), delay);
  }
  async function sync() {
    if (stopped || document.hidden) return;
    if (!connected()) {
      update(null);
      schedule(1000);
      return;
    }
    const batch = ++generation;
    try {
      // Independent clock actions share the socket; don't pay seven serial RTTs.
      // Keep the original seven samples and fastest-three estimator.
      const samples = await Promise.all(Array.from({ length: 7 }, async () => {
        const start = performance.now(),
          server = await sample();
        return { start, end: performance.now(), server };
      }));
      if (stopped || batch !== generation || document.hidden) return;
      if (!connected()) throw new Error('Connection changed');
      update(estimateClock(samples));
      failures = 0;
      if (options.periodic !== false) schedule(30000);
    } catch {
      if (stopped || batch !== generation || document.hidden) return;
      update(null);
      schedule(Math.min(8000, 1000 * 2 ** Math.min(failures++, 3)));
    }
  }
  function resume() {
    invalidate();
    if (!stopped) update(null);
    failures = 0;
    schedule(100);
  }
  const visibility = () => {
    if (document.hidden) {
      invalidate();
      update(null);
    } else resume();
  };
  function focus() {
    if (window.parent === window) {
      resume();
      return;
    }
    // Focusing an already-visible iframe is often the first Roll pointerdown.
    // Refresh its clock without disabling that button before pointerup/click.
    // Visibility changes, disconnects and failed samples still clear readiness.
    invalidate();
    failures = 0;
    schedule(100);
  }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', focus);
  window.addEventListener('online', resume);
  if (options.initial !== false) schedule(0);
  return () => {
    stopped = true;
    invalidate();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pageshow', resume);
    window.removeEventListener('focus', focus);
    window.removeEventListener('online', resume);
  };
}
