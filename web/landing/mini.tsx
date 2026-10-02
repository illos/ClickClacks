// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ClickClacks } from '../../lib/react';
import { createController, reactTransport, type Identity, type Profile } from '../../lib/client';
import { createThrowPlanner } from '../dice-demo/prepare-throw';
import type { DiceConfiguration } from '../../shared/dice';
import {newDemoRoomKey} from '../../shared/stats';
import '../../lib/styles.css';
import '../popout-demo/tray.css';
import './mini.css';

const backend = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = document.getElementById('root')!;
const roomKey = newDemoRoomKey();
function identity(): Identity {
  return { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() };
}
const visitor = identity();
root.dataset.viewer = visitor.viewer;
root.dataset.room = roomKey;
const actors: { identity: Identity; profile: Profile }[] = [
  { identity: identity(), profile: { name: 'Ariadne', style: { color: '#6edbc0', ink: '#142d26', pattern: 'frosted', font: 'modern' } } },
  { identity: identity(), profile: { name: 'Cato', style: { color: '#eaa0b3', ink: '#492233', pattern: 'marble', font: 'serif' } } },
];
const visitorProfile: Profile = { name: 'You', style: { color: '#b5a4df', ink: '#34284a', pattern: 'speckle', font: 'gothic' } };
const client = backend ? new ConvexReactClient(backend) : undefined;

function Demo() {
  const [active, setActive] = useState(parent === window);
  const [expired, setExpired] = useState(false);
  const [status, setStatus] = useState('');
  const deadline = useRef<number | undefined>(undefined);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(expiryTimer.current), []);
  useEffect(() => {
    const visibility = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin ||
          event.data?.type !== 'clickclacks-demo-visibility' || typeof event.data.active !== 'boolean') return;
      setActive(event.data.active);
    };
    addEventListener('message', visibility);
    parent.postMessage({ type: 'clickclacks-demo-ready' }, location.origin);
    return () => removeEventListener('message', visibility);
  }, []);

  useEffect(() => {
    if (!client || !active || expired || document.hidden) return;
    if (!deadline.current) {
      deadline.current = Date.now() + 180000;
      expiryTimer.current = setTimeout(() => setExpired(true), 180000);
    }
    if (Date.now() >= deadline.current) { setExpired(true); return; }
    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const planner = createThrowPlanner();
    const controllers = actors.map(actor => createController({
      transport: reactTransport(client), key: roomKey, ...actor,
    }));
    function later(callback: () => void, delay: number) {
      const timer = setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, delay);
      timers.add(timer);
    }
    function random(limit: number) { return crypto.getRandomValues(new Uint32Array(1))[0]! % limit; }
    async function roll(index: number) {
      if (stopped) return;
      const sides = ([6, 8, 10, 12, 20] as const)[random(5)]!;
      const dice: DiceConfiguration = { kind: 'dice', sides, count: 1 + random(2) };
      try {
        await controllers[index]!.roll({ dice }, async (faces, config) => {
          if (stopped || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
          return (await planner.prepareThrow(faces, { dice: config })).motion;
        });
        if (!stopped) setStatus('');
      } catch {
        if (!stopped) setStatus('Demo players are reconnecting… You can still try a roll.');
      } finally {
        if (!stopped) later(() => void roll(index), 5500 + random(2500));
      }
    }
    // Each actor gets an independent controller/identity. Visitor rolls never
    // cancel these timers, so all three players can contribute to the same tray.
    controllers.forEach((controller, index) => {
      later(() => {
        void controller.join().then(() => { if (!stopped) later(() => void roll(index), 700); })
          .catch(() => { if (!stopped) setStatus('Demo players could not connect. You can still try a roll.'); });
      }, index * 3000);
    });
    const hidden = () => { if (document.hidden) setActive(false); };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      planner.dispose();
      for (const controller of controllers) {
        void controller.leave().catch(() => undefined).finally(() => void controller.dispose());
      }
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [active, expired]);

  useEffect(() => {
    if (expired) {
      root.dataset.autoplay = 'expired';
      setStatus('');
    } else root.dataset.autoplay = active ? 'active' : 'paused';
  }, [active, expired]);

  if (!client) return <p className="demo-notice">The live demo is unavailable. <a href="https://dice.clickclacks.app/">Open the roller</a> to try it.</p>;
  return <>
    <ClickClacks client={client} roomKey={roomKey} identity={visitor} profile={visitorProfile}
      trayHistory preferences={{ theme: 'dark', motion: 'device', sound: false, hidden: false, highContrast: false, announcements: 'mine' }}
      onRoom={code => { root.dataset.room = code; }}
      roomLink={code => `https://dice.clickclacks.app/?room=${encodeURIComponent(code)}`} />
    {status && <p className="demo-notice" role="status">{status}</p>}
  </>;
}

createRoot(root).render(<Demo />);
