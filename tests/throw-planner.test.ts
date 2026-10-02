// SPDX-License-Identifier: MIT
import { it, expect, vi } from 'vitest';
import { createThrowPlanner } from '../web/dice-demo/prepare-throw';
it('isolated planners dispose only their own worker and pending requests', async () => {
  class TestWorker {
    static instances: TestWorker[] = [];
    onmessage?: (event: { data: { id: number } }) => void;
    onerror?: unknown;
    last?: { id: number };
    terminated = false;
    constructor() {
      TestWorker.instances.push(this);
    }
    postMessage(data: { id: number }) {
      this.last = data;
    }
    terminate() {
      this.terminated = true;
    }
  }
  vi.stubGlobal('Worker', TestWorker);
  const first = createThrowPlanner(),
    second = createThrowPlanner();
  try {
    const abandoned = first.warmThrows();
    const rejected = expect(abandoned).rejects.toThrow('disposed');
    const survivor = second.warmThrows();
    first.dispose();
    await rejected;
    expect(TestWorker.instances[0]!.terminated).toBe(true);
    expect(TestWorker.instances[1]!.terminated).toBe(false);
    const worker = TestWorker.instances[1]!;
    worker.onmessage!({ data: worker.last! });
    await survivor;
    await expect(first.warmThrows()).rejects.toThrow('disposed');
  } finally {
    first.dispose();
    second.dispose();
    vi.unstubAllGlobals();
  }
});
it('accepts a host-owned worker factory without creating an ambient worker', async () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: undefined as ((event: any) => void) | undefined, onerror: undefined };
  const factory = vi.fn(() => worker as unknown as Worker);
  const planner = createThrowPlanner({ workerFactory: factory });
  const pending = planner.warmThrows();
  expect(factory).toHaveBeenCalledTimes(1);
  worker.onmessage!({ data: { id: worker.postMessage.mock.calls[0]![0].id } });
  await pending;
  planner.dispose();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
it('coalesces superseded warm scenes and dispatches accepted throws first', async () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: undefined as ((event: any) => void) | undefined, onerror: undefined };
  const planner = createThrowPlanner({ workerFactory: () => worker as unknown as Worker });
  const first = planner.warmThrows({ dice: { kind: 'dice', sides: 20, count: 1 } });
  const obsolete = Array.from({ length: 18 }, (_, i) =>
    planner.warmThrows({ dice: { kind: 'dice', sides: 20, count: i + 2 } }));
  const latest = planner.warmThrows({ dice: { kind: 'dice', sides: 20, count: 20 } });
  const actual = planner.prepareThrow([7], { dice: { kind: 'dice', sides: 20, count: 1 } });
  try {
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    worker.onmessage!({ data: { id: worker.postMessage.mock.calls[0]![0].id } });
    expect(worker.postMessage.mock.calls[1]![0].faces).toEqual([7]);
    worker.onmessage!({ data: { id: worker.postMessage.mock.calls[1]![0].id, motion: { marker: 'accepted' }, planningMs: 12 } });
    expect(worker.postMessage.mock.calls[2]![0].scene.dice.count).toBe(20);
    expect(worker.postMessage.mock.calls[2]![0].faces).toBeUndefined();
    worker.onmessage!({ data: { id: worker.postMessage.mock.calls[2]![0].id } });
    await Promise.all([first, ...obsolete, latest]);
    expect((await actual).planningMs).toBe(12);
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
  } finally { planner.dispose(); }
});
it('terminates a stuck simulation before allowing later requests to retry', async () => {
  vi.useFakeTimers();
  const workers: any[] = [];
  const planner = createThrowPlanner({ workerFactory: () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: undefined, onerror: undefined };
    workers.push(worker);
    return worker as unknown as Worker;
  } });
  try {
    const warming = planner.warmThrows();
    const failure = expect(warming).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await failure;
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    const retry = planner.warmThrows();
    workers[1].onmessage({ data: { id: workers[1].postMessage.mock.calls[0][0].id } });
    await retry;
  } finally { planner.dispose(); vi.useRealTimers(); }
});
