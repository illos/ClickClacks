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
