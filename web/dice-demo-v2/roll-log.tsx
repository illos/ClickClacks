// SPDX-License-Identifier: MIT
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { SitePreferences } from '../site/storage';

/** Keep all log rows; animate their displacement when a newly revealed roll arrives. */
export function RollLog({ children, motion, revision }: { children: ReactNode; revision: string; motion: SitePreferences['motion'] }) {
  const host = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  const initialized = useRef(false);
  const resize = useRef<ResizeObserver | null>(null);
  const observed = useRef(new Set<Element>());
  const [deviceReduced, setDeviceReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduced = motion === 'reduce' || (motion === 'device' && deviceReduced);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setDeviceReduced(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const element = host.current!;
    const next = new Map<string, number>();
    for (const row of element.querySelectorAll<HTMLElement>('[data-log-key]')) {
      const key = row.dataset.logKey!;
      const top = row.offsetTop;
      next.set(key, top);
      const previous = positions.current.get(key);
      if (reduced) {
        row.getAnimations().forEach(animation => animation.cancel());
      } else if (initialized.current && previous !== top) {
        row.getAnimations().forEach(animation => animation.cancel());
        row.animate([
          { transform: `translateY(${previous === undefined ? -24 : previous - top}px)` },
          { transform: 'translateY(0)' },
        ], { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
    positions.current = next;
    initialized.current = true;
  }, [revision, reduced]);

  useLayoutEffect(() => {
    const element = host.current!;
    const updateFade = () => {
      element.dataset.bottomFade = String(element.scrollHeight - element.clientHeight - element.scrollTop > 2);
    };
    const observer = new ResizeObserver(updateFade);
    observer.observe(element);
    resize.current = observer;
    element.addEventListener('scroll', updateFade, { passive: true });
    updateFade();
    return () => {
      observer.disconnect();
      resize.current = null;
      observed.current.clear();
      element.removeEventListener('scroll', updateFade);
    };
  }, []);

  useLayoutEffect(() => {
    const observer = resize.current;
    if (!observer || !host.current) return;
    const next = new Set<Element>(host.current.children);
    for (const row of observed.current) if (!next.has(row)) observer.unobserve(row);
    for (const row of next) if (!observed.current.has(row)) observer.observe(row);
    observed.current = next;
  }, [revision]);

  return <section ref={host} className="track-results" aria-label="Roll log" tabIndex={0}>
    {children}
  </section>;
}
