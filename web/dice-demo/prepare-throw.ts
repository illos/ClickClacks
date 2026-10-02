// SPDX-License-Identifier: MIT
import type { Motion, ThrowScene } from './model';

type Reply = { id: number; motion?: Motion; planningMs?: number; error?: string };
type Job = {
  id: number;
  faces?: number[];
  scene: ThrowScene;
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};
export function createThrowPlanner(options: { workerFactory?: () => Worker } = {}) {
  let disposed = false;
  let worker: Worker | undefined;
  let nextId = 0;
  let active: Job | undefined;
  // Authority requests are never dropped. Cosmetic prewarming keeps only latest intent.
  const throws: Job[] = [];
  let pendingWarm: Job | undefined;
  let warming: Promise<void> | undefined;
  let warmingKey = '';
  let refill: ReturnType<typeof setTimeout> | undefined;
  function rejectAll(error: Error) {
    if (active) {
      clearTimeout(active.timer);
      active.reject(error);
    }
    active = undefined;
    for (const job of throws.splice(0)) job.reject(error);
    pendingWarm?.reject(error);
    pendingWarm = undefined;
    warming = undefined;
  }
  function dispatch() {
    if (disposed || active) return;
    const job = throws.shift() ?? pendingWarm;
    if (!job) return;
    if (job === pendingWarm) pendingWarm = undefined;
    if (!worker) {
      worker = options.workerFactory?.() ?? new Worker(new URL('./physics-worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        if (!active || active.id !== data.id) return;
        const completed = active;
        clearTimeout(completed.timer);
        active = undefined;
        if (data.error) completed.reject(new Error(data.error));
        else completed.resolve(data);
        if (completed.faces && !data.error &&
            (!warmingKey || warmingKey === JSON.stringify(completed.scene))) {
          if (warmingKey === JSON.stringify(completed.scene)) warming = undefined;
          // Refill after the authority response. New intent cancels this idle work.
          refill = setTimeout(() => {
            refill = undefined;
            if (!active && !pendingWarm && !throws.length)
              void warmThrows(completed.scene).catch(() => undefined);
          }, 100);
        }
        dispatch();
      };
      worker.onerror = event => {
        rejectAll(new Error(event.message || 'Could not prepare the throw.'));
        worker?.terminate();
        worker = undefined;
      };
    }
    active = job;
    job.timer = setTimeout(() => {
      // A stuck synchronous simulation cannot leave all later requests behind it.
      worker?.terminate();
      worker = undefined;
      rejectAll(new Error('Throw preparation timed out. Try again.'));
    }, 15000);
    try {
      worker.postMessage({ id: job.id, faces: job.faces, scene: job.scene });
    } catch (error) {
      clearTimeout(job.timer);
      active = undefined;
      job.reject(error instanceof Error ? error : new Error(String(error)));
      dispatch();
    }
  }
  function request(faces?: number[], scene: ThrowScene = {}): Promise<Reply> {
    if (disposed) return Promise.reject(new Error('Throw planner is disposed.'));
    if (faces && throws.length >= 32)
      return Promise.reject(new Error('Throw planner is busy. Try again.'));
    clearTimeout(refill);
    refill = undefined;
    return new Promise((resolve, reject) => {
      const job: Job = { id: nextId++, faces, scene, resolve, reject };
      if (faces) throws.push(job);
      else {
        // Superseded warm callers completed their cosmetic intent; no throw is rejected.
        pendingWarm?.resolve({ id: pendingWarm.id });
        pendingWarm = job;
      }
      dispatch();
    });
  }
  /** Start physics and retain only the most recent scene/quantity prewarm. */
  function warmThrows(scene: ThrowScene = {}): Promise<void> {
    const key = JSON.stringify(scene);
    if (warming && key === warmingKey) return warming;
    warmingKey = key;
    const current = request(undefined, scene).then(() => undefined).catch(error => {
      if (warming === current) warming = undefined;
      throw error;
    });
    warming = current;
    return current;
  }
  /** Actual throws take priority over queued cosmetic warm intent. */
  async function prepareThrow(faces: number[], scene: ThrowScene = {}) {
    const reply = await request(faces, scene);
    return { motion: reply.motion!, planningMs: reply.planningMs! };
  }
  return {
    warmThrows,
    prepareThrow,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(refill);
      worker?.terminate();
      worker = undefined;
      rejectAll(new Error('Throw planner is disposed.'));
    },
  };
}
const defaultPlanner = createThrowPlanner();
export const warmThrows = defaultPlanner.warmThrows;
export const prepareThrow = defaultPlanner.prepareThrow;
