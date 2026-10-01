// SPDX-License-Identifier: MIT
import type { Motion, ThrowScene } from './model';

type Reply = { id: number; motion?: Motion; planningMs?: number; error?: string };
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
  if (!worker) {
    worker = new Worker(new URL('./physics-worker.ts', import.meta.url), { type: 'module' });
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
export function warmThrows(scene: ThrowScene = {}): Promise<void> {
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
export async function prepareThrow(
  faces: number[],
  scene: ThrowScene = {},
): Promise<{ motion: Motion; planningMs: number }> {
  const reply = await request(faces, scene);
  return { motion: reply.motion!, planningMs: reply.planningMs! };
}
