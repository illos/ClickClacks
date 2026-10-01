// SPDX-License-Identifier: MIT
import type { Motion, ThrowScene } from './model';

type Reply = {
  id: number;
  motion?: Motion;
  planningMs?: number;
  error?: string;
};
export function createThrowPlanner(options: { workerFactory?: () => Worker } = {}) {
  let disposed = false;
  let worker: Worker | undefined;
  let nextId = 0;
  const requests = new Map<
    number,
    {
      resolve: (reply: Reply) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  function request(faces?: number[], scene: ThrowScene = {}): Promise<Reply> {
    if (disposed) return Promise.reject(new Error('Throw planner is disposed.'));
    if (!worker) {
      worker = options.workerFactory?.() ?? new Worker(new URL('./physics-worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        const pending = requests.get(data.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        requests.delete(data.id);
        if (data.error) pending.reject(new Error(data.error));
        else pending.resolve(data);
      };
      worker.onerror = event => {
        for (const pending of requests.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(event.message || 'Could not prepare the throw.'));
        }
        requests.clear();
        worker?.terminate();
        worker = undefined;
        warming = undefined;
      };
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        requests.delete(id);
        reject(new Error('Throw preparation timed out. Try again.'));
      }, 15000);
      requests.set(id, { resolve, reject, timer });
      worker!.postMessage({ id, faces, scene });
    });
  }
  let warming: Promise<void> | undefined;
  let warmingKey = '';
  /** Download/start physics and prepare a fresh random trajectory before the first click. */
  function warmThrows(scene: ThrowScene = {}): Promise<void> {
    const key = JSON.stringify(scene);
    if (warming && key === warmingKey) return warming;
    warmingKey = key;
    warming = request(undefined, scene)
      .then(() => undefined)
      .catch(error => {
        if (warmingKey === key) warming = undefined;
        throw error;
      });
    return warming;
  }
  /** Reuse the warm worker and trajectory; supplied faces only orient the numbering. */
  async function prepareThrow(
    faces: number[],
    scene: ThrowScene = {},
  ): Promise<{ motion: Motion; planningMs: number }> {
    const reply = await request(faces, scene);
    return { motion: reply.motion!, planningMs: reply.planningMs! };
  }

  return {
    warmThrows,
    prepareThrow,
    dispose() {
      disposed = true;
      worker?.terminate();
      worker = undefined;
      for (const pending of requests.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Throw planner is disposed.'));
      }
      requests.clear();
      warming = undefined;
    },
  };
}
const defaultPlanner = createThrowPlanner();
export const warmThrows = defaultPlanner.warmThrows;
export const prepareThrow = defaultPlanner.prepareThrow;
