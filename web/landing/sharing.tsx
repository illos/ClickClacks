// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ClickClacks } from '../../lib/react';
import { createController, reactTransport, type DeliveredRoll, type Identity, type Profile } from '../../lib/client';
import { createThrowPlanner } from '../dice-demo/prepare-throw';
import '../../lib/styles.css';
import './sharing.css';

const backend = import.meta.env.VITE_CONVEX_URL as string | undefined;
const client = backend ? new ConvexReactClient(backend) : undefined;
const root = document.getElementById('root')!;
const roomKey = crypto.randomUUID();
const identity = (): Identity => ({ viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() });
const alex = { identity: identity(), profile: { name: 'Alex', style: { color: '#6edbc0', ink: '#142d26', pattern: 'frosted', font: 'modern' } } satisfies Profile };
const sam = { identity: identity(), profile: { name: 'Sam', style: { color: '#eaa0b3', ink: '#492233', pattern: 'marble', font: 'serif' } } satisfies Profile };
root.dataset.room = roomKey;

// The host iframe is inert and ignores pointers. Also reject trusted input when
// this document is opened directly; scripted .click() events remain available.
for (const name of ['pointerdown', 'pointerup', 'click', 'keydown'] as const) {
  document.addEventListener(name, event => {
    if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
}

function Demo() {
  const [active, setActive] = useState(parent === window);
  const [historySince, setHistorySince] = useState(Infinity);
  const [status, setStatus] = useState('');
  const [chat, setChat] = useState<{ stage: 'typing' | 'pasted' | 'sending' | 'sent' | 'sam-typing' | 'sam-replied'; text: string; code: string } | null>(null);
  const code = useRef<string | undefined>(undefined);
  const latestAlex = useRef<string | undefined>(undefined);
  const cleanupPending = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let parentVisible = parent === window;
    const update = () => setActive(parentVisible && !document.hidden);
    const message = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin ||
          event.data?.type !== 'clickclacks-sharing-visibility' || typeof event.data.active !== 'boolean') return;
      parentVisible = event.data.active;
      update();
    };
    addEventListener('message', message);
    document.addEventListener('visibilitychange', update);
    parent.postMessage({ type: 'clickclacks-sharing-ready' }, location.origin);
    return () => { removeEventListener('message', message); document.removeEventListener('visibilitychange', update); };
  }, []);

  useEffect(() => {
    if (!client || !active) return;
    const abort = new AbortController();
    const signal = abort.signal;
    const planner = createThrowPlanner();
    const controller = createController({ transport: reactTransport(client), key: roomKey, ...sam });
    const pause = (milliseconds: number) => new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cancelled = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, milliseconds);
      signal.addEventListener('abort', cancelled, { once: true });
    });
    const until = async (condition: () => boolean) => {
      const deadline = Date.now() + 30000;
      while (!condition()) {
        if (Date.now() >= deadline) throw new Error('The demonstration is reconnecting.');
        await pause(100);
      }
      if (signal.aborted) throw signal.reason;
    };
    const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    const rollButton = () => root.querySelector<HTMLButtonElement>('.roll-button-group .primary');
    const phase = (value: string) => { root.dataset.phase = value; };
    const tap = async (target: HTMLButtonElement) => {
      target.classList.add('demo-tap');
      try { await pause(300); target.click(); }
      finally { target.classList.remove('demo-tap'); }
    };
    async function run() {
      await cleanupPending.current;
      while (!signal.aborted) {
        try {
          setStatus('');
          setChat(null);
          setHistorySince(Infinity);
          phase('ready');
          await until(() => !!code.current && !!rollButton() && !rollButton()!.disabled);
          const previous = latestAlex.current;
          await pause(1200);
          phase('alex-roll');
          rollButton()!.click();
          await until(() => latestAlex.current !== previous);
          await pause(900);
          phase('sharing-tap');
          await tap(button('Open social menu')!);
          phase('sharing');
          await until(() => !!root.querySelector('dialog[open] .share-code'));
          await pause(1200);
          button('Copy table code')!.click();
          await until(() => !!button('Code copied'));
          phase('copied');
          await pause(3000);
          button('Close social menu')!.click();
          phase('chat-invite');
          const invitation = 'Sam, join the game!';
          setChat({ stage: 'typing', text: '', code: '' });
          await pause(600);
          for (let length = 1; length <= invitation.length; length++) {
            setChat({ stage: 'typing', text: invitation.slice(0, length), code: '' });
            await pause(70);
          }
          phase('chat-paste');
          setChat({ stage: 'pasted', text: invitation, code: code.current! });
          await pause(1400);
          phase('chat-send');
          setChat({ stage: 'sending', text: invitation, code: code.current! });
          await pause(300);
          setChat({ stage: 'sent', text: invitation, code: code.current! });
          await pause(1400);
          phase('sam-chat-typing');
          setChat({ stage: 'sam-typing', text: invitation, code: code.current! });
          await pause(1400);
          phase('sam-chat-reply');
          setChat({ stage: 'sam-replied', text: invitation, code: code.current! });
          await pause(2200);
          setChat(null);
          phase('sam-joining');
          await controller.join(code.current!);
          if (signal.aborted) break;
          phase('sam-roll');
          const roll = await controller.roll({ dice: { kind: 'dice', sides: 4, count: 2 } }, async (faces, dice) => {
            if (signal.aborted) return undefined;
            return (await planner.prepareThrow(faces, { dice })).motion;
          });
          await until(() => !!root.querySelector(`[data-log-key="${sam.identity.viewer}:${roll.id}"]`));
          phase('result');
          await pause(2500);
          await controller.leave();
          await until(() => root.querySelector('.stage-label')?.textContent?.includes('1 / 8 participants') === true);
          button('Clear tray')?.click();
          setHistorySince(Infinity);
          phase('reset');
          await pause(1200);
        } catch {
          if (signal.aborted) break;
          setChat(null);
          await controller.leave().catch(() => undefined);
          setStatus('The live demonstration is reconnecting…');
          phase('reconnecting');
          await pause(5000).catch(() => undefined);
        }
      }
    }
    const task = run();
    return () => {
      abort.abort();
      setChat(null);
      cleanupPending.current = task.catch(() => undefined).then(async () => {
        await controller.leave().catch(() => undefined);
        await controller.dispose();
        planner.dispose();
      });
    };
  }, [active]);

  if (!client) return <p className="sharing-status">The live demonstration is unavailable.</p>;
  const invitationSent = chat && ['sent', 'sam-typing', 'sam-replied'].includes(chat.stage);
  return <>
    {active && <ClickClacks client={client} roomKey={roomKey} identity={alex.identity} profile={alex.profile}
      preferences={{ theme: 'dark', selectedDice: 12, motion: 'full', sound: false, hidden: false, highContrast: false, announcements: 'off' }}
      historySince={historySince}
      copyText={async () => { /* Show the real copy confirmation without changing a visitor's clipboard. */ }}
      onRoom={value => { code.current = value; root.dataset.room = value; }}
      roomLink={value => `https://dice.clickclacks.app/?room=${encodeURIComponent(value)}`}
      onRoll={(_code, roll) => {
        if (roll.roller === alex.identity.viewer && !(roll as DeliveredRoll).historical) {
          latestAlex.current = roll.id;
          setHistorySince(roll.startsAt);
        }
      }} />}
    {chat && <div className={`sharing-chat chat-${chat.stage}`} aria-hidden="true">
      <header><span className="chat-channel"># game-night</span><span className="chat-example">EXAMPLE CHAT</span></header>
      <div className="chat-messages">
        {invitationSent && <div className="chat-message">
          <span className="chat-avatar">A</span>
          <div><div className="chat-author">Alex <span>Just now</span></div><p>{chat.text}<br /><code>{chat.code}</code></p></div>
        </div>}
        {chat.stage === 'sam-typing' && <p className="chat-typing">Sam is typing…</p>}
        {chat.stage === 'sam-replied' && <div className="chat-message">
          <span className="chat-avatar chat-sam">S</span>
          <div><div className="chat-author chat-sam">Sam <span>Just now</span></div><p>Got it, joining now!</p></div>
        </div>}
      </div>
      <div className="chat-composer">
        <div>{invitationSent ? <span className="chat-placeholder">Message #game-night</span> : <>{chat.text}<span className="chat-caret" />{chat.code && <code>{chat.code}</code>}</>}</div>
        <span className="chat-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m3 3 18 9-18 9 4-9-4-9Z M7 12h14" /></svg></span>
      </div>
    </div>}
    {status && <p className="sharing-status">{status}</p>}
  </>;
}

createRoot(root).render(<Demo />);
