import { afterEach, expect, it, vi } from 'vitest';
import { createPlaybackReports } from '../web/dice-demo-v2/playback-reports';
afterEach(() => vi.useRealTimers());
it('coalesces fallback with accurate playback and never replaces accurate timing', () => {
  vi.useFakeTimers();
  const send = vi.fn(), reports = createPlaybackReports(send);
  const fallback = { firstFrame: 1, revealFrame: 2, frames: 0, maxFrameGap: 0 };
  const accurate = { ...fallback, frames: 60, maxFrameGap: 17 };
  reports.report('owner:roll', fallback, 3);
  reports.report('owner:roll', accurate, 3);
  reports.report('owner:roll', fallback, 3);
  vi.runAllTimers();
  expect(send).toHaveBeenCalledExactlyOnceWith('owner:roll', accurate, 3);
  reports.dispose();
});
it('reports text fallback once and cancels pending reports on disposal', () => {
  vi.useFakeTimers();
  const send = vi.fn(), reports = createPlaybackReports(send);
  const timing = { firstFrame: 1, revealFrame: 2, frames: 0, maxFrameGap: 0 };
  reports.report('owner:roll', timing, 3);
  reports.report('owner:roll', timing, 3);
  vi.advanceTimersByTime(150);
  expect(send).toHaveBeenCalledTimes(1);
  reports.report('owner:pending', timing, 3);
  reports.dispose();
  vi.runAllTimers();
  expect(send).toHaveBeenCalledTimes(1);
});
