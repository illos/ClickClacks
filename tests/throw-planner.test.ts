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
