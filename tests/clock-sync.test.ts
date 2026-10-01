// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { startClockSync } from '../web/dice-demo-v2/clock-sync';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function environment(framed = false) {
  vi.useFakeTimers();
  const events = new EventTarget(), page = Object.assign(new EventTarget(), { parent: null as EventTarget | null });
  page.parent = framed ? new EventTarget() : page;
  const doc = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  vi.stubGlobal('document', doc); vi.stubGlobal('window', page);
  vi.stubGlobal('performance', { now: () => Date.now() });
  return { doc, events, page };
}

it('gathers seven independent samples in one round trip and still excludes slower queued results', async () => {
  environment(); const update = vi.fn();
  const delays = [100, 120, 110, 400, 450, 500, 600];
  const ping = vi.fn(() => { const start = Date.now(), delay = delays[ping.mock.calls.length - 1]!;
    return new Promise<number>(resolve => setTimeout(() => resolve(start + delay / 2 + 10000), delay)); });
  const stop = startClockSync(ping, () => true, update);
  await vi.advanceTimersByTimeAsync(0); expect(ping).toHaveBeenCalledTimes(7);
  await vi.advanceTimersByTimeAsync(599); expect(update).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(update).toHaveBeenLastCalledWith({ offset: 10000, uncertainty: 60 });
  stop(); expect(vi.getTimerCount()).toBe(0);
});

it.each([true, false])('iframe=%s preserves first-click readiness while focus refreshes the clock', async framed => {
  const { doc, events, page } = environment(framed), update = vi.fn();
  const ping = vi.fn(async () => Date.now());
  const stop = startClockSync(ping, () => true, update);
  await vi.advanceTimersByTimeAsync(0);
  expect(update.mock.calls.at(-1)![0]).not.toBeNull();
  update.mockClear();
  page.dispatchEvent(new Event('focus'));
  if (framed) expect(update).not.toHaveBeenCalled();
  else expect(update).toHaveBeenLastCalledWith(null);
  await vi.advanceTimersByTimeAsync(100);
  expect(ping).toHaveBeenCalledTimes(14);
  expect(update.mock.calls.at(-1)![0]).not.toBeNull();
  doc.hidden = true; events.dispatchEvent(new Event('visibilitychange'));
  expect(update).toHaveBeenLastCalledWith(null);
  stop();
});

it('rejects a batch invalidated by backgrounding and collects fresh samples on return', async () => {
  const { doc, events } = environment(), update = vi.fn();
  const ping = vi.fn(async () => new Promise<number>(resolve => setTimeout(() => resolve(Date.now()), 200)));
  const stop = startClockSync(ping, () => true, update);
  await vi.advanceTimersByTimeAsync(0); doc.hidden = true; events.dispatchEvent(new Event('visibilitychange'));
  expect(update).toHaveBeenLastCalledWith(null);
  await vi.advanceTimersByTimeAsync(200); expect(update.mock.calls.every(([value]) => value === null)).toBe(true);
  doc.hidden = false; events.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(300); expect(ping).toHaveBeenCalledTimes(14);
  expect(update.mock.calls.at(-1)![0]).not.toBeNull(); stop();
});

it('keeps the button unready after an offline or timed-out batch, then retries', async () => {
  environment(); const update = vi.fn(); let connected = false;
  const ping = vi.fn(() => new Promise<number>(() => {}));
  const stop = startClockSync(ping, () => connected, update);
  await vi.advanceTimersByTimeAsync(0); expect(update).toHaveBeenLastCalledWith(null); expect(ping).not.toHaveBeenCalled();
  connected = true; await vi.advanceTimersByTimeAsync(1000); expect(ping).toHaveBeenCalledTimes(7);
  await vi.advanceTimersByTimeAsync(5000); expect(update).toHaveBeenLastCalledWith(null);
  await vi.advanceTimersByTimeAsync(1000); expect(ping).toHaveBeenCalledTimes(14); stop();
  await vi.advanceTimersByTimeAsync(0); expect(vi.getTimerCount()).toBe(0);
});
