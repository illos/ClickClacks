// SPDX-License-Identifier: MIT
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient, useAction, useMutation, useQuery } from 'convex/react';
import { demo } from './api';
import { prepareThrow, warmThrows } from './prepare-throw';
import { estimateClock, type ClockSample, type Receipt, type LegacyStyle as Style } from './model';
import { createTray, type Timing } from './renderer';
import './style.css';

const params = new URLSearchParams(location.search);
const roomKey = params.get('room') || crypto.randomUUID();
if (!params.has('room')) {
  params.set('room', roomKey);
  history.replaceState(null, '', `${location.pathname}?${params}`);
}
const initialStyles: Style[] = [
  { color: '#eee5d3', ink: '#3d3024', pattern: 'solid' },
  { color: '#a63a3a', ink: '#fff0dc', pattern: 'marble' },
];
const client = new ConvexReactClient(
  import.meta.env.VITE_LOCAL_PROXY === 'true'
    ? `${location.origin}/convex-api`
    : import.meta.env.VITE_CONVEX_URL,
  { skipConvexDeploymentUrlCheck: true },
);

function DiceLab() {
  const [viewer] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(
    () => `${/iPhone|iPad/.test(navigator.userAgent) ? 'Safari' : 'Viewer'} ${viewer.slice(0, 4)}`,
  );
  const [styles, setStyles] = useState(initialStyles);
  const [clock, setClock] = useState<{ offset: number; uncertainty: number } | null>(null);
  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);
  const [physicsReady, setPhysicsReady] = useState(false);
  const [graphics, setGraphics] = useState(false),
    [fallback, setFallback] = useState(false);
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [status, setStatus] = useState('Warming the dice…');
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void warmThrows()
      .then(() => {
        if (!cancelled) setPhysicsReady(true);
      })
      .catch(e => {
        if (!cancelled) {
          setError(String(e));
          setPhysicsReady(true); // Allow a click to retry failed startup preparation.
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [visible, setVisible] = useState(!document.hidden);
  const [tick, setTick] = useState(() => ({ wall: Date.now(), mono: performance.now() }));
  const host = useRef<HTMLDivElement>(null),
    tray = useRef<ReturnType<typeof createTray> | null>(null);
  const active = useRef<string | null>(null),
    nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  const room = useQuery(demo.view, { key: roomKey });
  const sampleFaces = useAction(demo.sampleFaces);
  const ping = useAction(demo.clock),
    join = useMutation(demo.join),
    throwDice = useMutation(demo.throwDice),
    record = useMutation(demo.receipt);
  const clockReady = clock !== null;
  const ready = clockReady && (graphics || fallback) && visible;
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const samples: ClockSample[] = [];
        for (let i = 0; i < 7 && !cancelled; i++) {
          const start = performance.now();
          const server = await ping({});
          const end = performance.now();
          samples.push({ start, end, server });
        }
        if (!cancelled) setClock(estimateClock(samples));
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    void sync();
    const interval = setInterval(() => void sync(), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ping]);
  useEffect(() => {
    const listener = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const heartbeat = async () => {
      try {
        await join({
          key: roomKey,
          viewer,
          name: nameRef.current,
          ready,
          uncertainty: clockRef.current?.uncertainty ?? 10000,
        });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    void heartbeat();
    const interval = setInterval(() => void heartbeat(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [join, viewer, ready]);
  useEffect(() => {
    const interval = setInterval(
      () => setTick({ wall: Date.now(), mono: performance.now() }),
      1000,
    );
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    try {
      tray.current = createTray(host.current!, () => {
        active.current = null;
        setFallback(true);
        setGraphics(false);
      });
      tray.current.preview(initialStyles);
      queueMicrotask(() => setGraphics(true));
    } catch {
      queueMicrotask(() => setFallback(true));
    }
    return () => {
      tray.current?.dispose();
      tray.current = null;
    };
  }, []);
  useEffect(() => {
    tray.current?.preview(styles);
  }, [styles]);
  const report = useCallback(
    (sample: Receipt) => {
      void record({ key: roomKey, sample }).catch(e => setError(String(e)));
    },
    [record],
  );
  useEffect(() => {
    const roll = room?.roll;
    const synced = clockRef.current;
    if (!roll || !synced || !(graphics || fallback) || active.current === roll.id) return;
    active.current = roll.id;
    const snapshot = synced.offset,
      uncertainty = synced.uncertainty;
    const now = () => performance.now() + snapshot;
    const finished = (timing: Timing) => {
      setRevealed(roll.id);
      setStatus('Landed');
      setTick({ wall: Date.now(), mono: performance.now() });
      report({ viewer, roll: roll.id, uncertainty, ...timing });
    };
    queueMicrotask(() => setStatus(now() < roll.startsAt ? 'Throwing…' : 'Rolling'));
    if (graphics && tray.current) {
      tray.current.play(roll, now, reduced, finished);
    } else {
      const timer = setTimeout(
        () => finished({ firstFrame: now(), revealFrame: now(), frames: 0, maxFrameGap: 0 }),
        Math.max(0, roll.startsAt + roll.duration - now()),
      );
      return () => {
        clearTimeout(timer);
        active.current = null;
      };
    }
  }, [room?.roll, clockReady, graphics, fallback, reduced, viewer, report]);
  const roll = room?.roll;
  const busy =
    pending || !!(roll && clock && tick.mono + clock.offset < roll.startsAt + roll.duration);
  const viewers = room?.viewers.filter(v => v.seenAt > tick.wall - 30000) ?? [];
  const waiting = viewers.some(v => !v.ready);
  const receipts = room?.receipts ?? [];
  const spread =
    receipts.length > 1
      ? Math.max(...receipts.map(s => s.revealFrame)) -
        Math.min(...receipts.map(s => s.revealFrame))
      : null;
  const budget =
    receipts.length > 1
      ? [...receipts]
          .sort((a, b) => b.uncertainty - a.uncertainty)
          .slice(0, 2)
          .reduce((sum, s) => sum + s.uncertainty, 0)
      : 0;
  async function perform() {
    setError('');
    setRevealed(null);
    setPending(true);
    try {
      setStatus('Preparing the physics throw…');
      const values = await sampleFaces({});
      const { motion } = await prepareThrow(values);
      await throwDice({
        key: roomKey,
        viewer,
        id: crypto.randomUUID(),
        faces: values,
        styles,
        motion,
      });
    } catch (e) {
      setError(String(e));
      setStatus('Ready to throw');
    } finally {
      setPending(false);
    }
  }
  function editStyle(index: number, patch: Partial<Style>) {
    setStyles(old => old.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  return (
    <main className="lab">
      <header className="lab-header">
        <a href="https://github.com/illos/ClickClacks">Source</a>
        <span>Dice lab / concept demo</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setError('Copy this page address to invite another viewer.');
            }
          }}
        >
          {copied ? 'Link copied' : 'Copy room link'}
        </button>
      </header>
      <section className="intro">
        <p className="eyebrow">A shared throw</p>
        <h1>Same dice. Same moment.</h1>
        <p>
          Two twenty-sided d10s, landing on shared random results. Die 1 uses single digits; die 2
          uses two digits. On the dice, 0 and 00 mean 10. Open this room on another device to watch
          together.
        </p>
      </section>
      <section className="stage" aria-label="3D dice tray">
        <div ref={host} className="canvas-host" />
        <div className="stage-label">
          <span className="dot" />
          {ready
            ? roll && revealed !== roll.id && clock && tick.mono + clock.offset >= roll.startsAt
              ? 'Rolling'
              : status === 'Warming the dice…'
                ? 'Ready to throw'
                : status
            : 'Connecting and warming up…'}
        </div>
        {roll && revealed === roll.id && !pending && (
          <div className="result" aria-live="polite">
            <span>{roll.faces[0]}</span>
            <i>+</i>
            <span>{roll.faces[1]}</span>
            <i>=</i>
            <strong>{roll.faces[0]! + roll.faces[1]!}</strong>
          </div>
        )}
        {fallback && (
          <p className="fallback">3D unavailable · synchronized text results remain available.</p>
        )}
      </section>
      <section className="controls">
        <div className="throw-controls">
          <button
            className="primary"
            disabled={!ready || !physicsReady || busy || waiting}
            onClick={() => void perform()}
          >
            {!physicsReady
              ? 'Warming the dice…'
              : pending
                ? 'Preparing throw…'
                : busy
                  ? 'Throw in progress…'
                  : 'Throw dice'}
          </button>
        </div>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="customization">
        <div>
          <h2>Make them yours</h2>
          <p>Changes apply to your next shared throw.</p>
        </div>
        <div className="dice-styles">
          {styles.map((style, i) => (
            <fieldset key={i} disabled={busy}>
              <legend>Die {i + 1}</legend>
              <label>
                Body
                <input
                  type="color"
                  value={style.color}
                  onChange={e => editStyle(i, { color: e.target.value })}
                />
              </label>
              <label>
                Numbers
                <input
                  type="color"
                  value={style.ink}
                  onChange={e => editStyle(i, { ink: e.target.value })}
                />
              </label>
              <label>
                Pattern
                <select
                  value={style.pattern}
                  onChange={e => editStyle(i, { pattern: e.target.value as Style['pattern'] })}
                >
                  <option value="solid">Solid</option>
                  <option value="speckle">Speckle</option>
                  <option value="marble">Marble</option>
                </select>
              </label>
            </fieldset>
          ))}
        </div>
      </section>
      <details className="diagnostics" open>
        <summary>Synchronization / performance</summary>
        <p>
          Target: within 100 ms between viewers. Measurements below are clock estimates, not
          device-certified timing.
        </p>
        <div className="metrics">
          <span>
            Clock uncertainty <b>±{Math.round(clock?.uncertainty ?? 0)} ms</b>
          </span>
          <span>
            Reveal spread <b>{spread === null ? 'Need 2 viewers' : `${Math.round(spread)} ms`}</b>
          </span>
          <span>
            Spread + clock budget{' '}
            <b>{spread === null ? '—' : `${Math.round(spread + budget)} ms`}</b>
          </span>
        </div>
        <label className="viewer-name">
          This viewer
          <input
            value={name}
            maxLength={32}
            onChange={e => setName(e.target.value)}
            onBlur={() =>
              void join({
                key: roomKey,
                viewer,
                name,
                ready,
                uncertainty: clock?.uncertainty ?? 10000,
              }).catch(e => setError(String(e)))
            }
          />
        </label>
        <div className="viewers">
          {viewers.map(v => {
            const sample = receipts.find(s => s.viewer === v.id);
            return (
              <div key={v.id}>
                <strong>
                  {v.name}
                  {v.id === viewer ? ' (you)' : ''}
                </strong>
                <span>{v.ready ? 'Ready' : 'Warming up / backgrounded'}</span>
                <span>
                  {sample
                    ? `Reveal +${Math.round(sample.revealFrame - (roll!.startsAt + roll!.duration))} ms · ${sample.frames} frames · longest gap ${Math.round(sample.maxFrameGap)} ms`
                    : 'Awaiting throw'}
                </span>
              </div>
            );
          })}
        </div>
        <p>
          Share the room link between iOS Safari, Chrome and Firefox. Backgrounded tabs catch up to
          the current timeline when reopened. Everyone plays the same recorded physics throw,
          without game-engine calls or per-frame network traffic.
        </p>
      </details>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={client}>
      <DiceLab />
    </ConvexProvider>
  </StrictMode>,
);
