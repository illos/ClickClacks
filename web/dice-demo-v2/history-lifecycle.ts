// SPDX-License-Identifier: MIT
import { useEffect } from 'react';
export { historyDeadline } from './history-deadline';
/** Wake only for a state boundary, rather than repeatedly repainting idle controls. */
export function useDeadlineClock(deadlines: number[], now: number, update: (now: number) => void) {
  const next = Math.min(...deadlines.filter(deadline => Number.isFinite(deadline) && deadline > now));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => update(performance.now()), Math.max(1, Math.ceil(next - performance.now())));
    return () => clearTimeout(timer);
  }, [next, update]);
}
