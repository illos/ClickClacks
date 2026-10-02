// SPDX-License-Identifier: MIT
export type PlaybackTiming = { firstFrame: number; revealFrame: number; frames: number; maxFrameGap: number };
/** Delay fallback telemetry briefly so a renderer's accurate report wins the race. */
export function createPlaybackReports(send: (key: string, timing: PlaybackTiming, uncertainty: number) => void, fallbackDelay = 150) {
  const reports = new Map<string, { accurate: boolean; timer?: ReturnType<typeof setTimeout> }>();
  let disposed = false;
  return {
    report(key: string, timing: PlaybackTiming, uncertainty: number) {
      if (disposed) return;
      const previous = reports.get(key);
      if (previous?.accurate) return;
      if (timing.frames > 0) {
        if (previous?.timer) clearTimeout(previous.timer);
        reports.set(key, { accurate: true });
        send(key, timing, uncertainty);
      } else if (!previous) {
        const entry: { accurate: boolean; timer?: ReturnType<typeof setTimeout> } = { accurate: false };
        reports.set(key, entry);
        entry.timer = setTimeout(() => { entry.timer = undefined; if (!disposed) send(key, timing, uncertainty); }, fallbackDelay);
      }
      if (reports.size > 5000) {
        const oldest = reports.keys().next().value!;
        clearTimeout(reports.get(oldest)?.timer);
        reports.delete(oldest);
      }
    },
    dispose() { disposed = true; for (const report of reports.values()) clearTimeout(report.timer); reports.clear(); },
  };
}
