// SPDX-License-Identifier: MIT
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { Check, Copy, X, Users, Eraser, Link as LinkIcon } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useMutation,
  useQuery,
  useConvexConnectionState,
} from 'convex/react';
import { demo } from '../dice-demo/api';
import { prepareThrow, warmThrows } from '../dice-demo/prepare-throw';
import { type Style } from '../dice-demo/model';
import { loadDiceFonts } from '../dice-demo/fonts';
import { dieFontFamilies, dieFontWeights } from '../dice-demo/d10';
import { demoV2 } from './api';
import {
  parseRoomKey,
  randomProfile,
  restingScene,
  revealDelay,
  trayOpacity,
  type Participant,
  type ParticipantRoll,
} from './model';
import { createRoomTray } from './renderer';
import { createDicePreview } from './preview';
import { ColorControls } from './color-controls';
import { startClockSync } from './clock-sync';
import '../dice-demo/style.css';
import '../components/game-values.css';
import './style.css';

const params = new URLSearchParams(location.search);
const supplied = params.get('room');
const roomKey = parseRoomKey(supplied ?? '') ?? crypto.randomUUID();
params.set('room', roomKey);
history.replaceState(null, '', `${location.pathname}?${params}`);
const client = new ConvexReactClient(
  import.meta.env.VITE_LOCAL_PROXY === 'true'
    ? `${location.origin}/convex-api`
    : import.meta.env.VITE_CONVEX_URL,
  { skipConvexDeploymentUrlCheck: true },
);
type Clock = { offset: number; uncertainty: number };
type Tray = ReturnType<typeof createRoomTray>;

function TrackCard({
  member,
  clock,
  tray,
  graphics,
  onReveal,
  onTrack,
}: {
  member: Participant;
  clock: Clock | null;
  tray: React.RefObject<Tray | null>;
  graphics: boolean;
  onReveal: (roll: ParticipantRoll, uncertainty: number) => void;
  onTrack: (owner: string, roll: ParticipantRoll | null) => void;
}) {
  const track = useQuery(demoV2.track, { key: roomKey, viewer: member.id });
  const roll = track?.roll;
  useEffect(() => {
    onTrack(member.id, roll ?? null);
    return () => onTrack(member.id, null);
  }, [member.id, roll, onTrack]);
  const completed = useRef<string | null>(null);
  useEffect(() => {
    if (!roll) {
      tray.current?.clear(member.id);
      return;
    }
    if (!clock) return;
    if (graphics && tray.current) {
      tray.current.play(roll, clock);
      return;
    }
    if (completed.current === roll.id) return;
    const timer = setTimeout(
      () => {
        completed.current = roll.id;
        onReveal(roll, clock.uncertainty);
      },
      Math.max(0, roll.startsAt + revealDelay(roll) - (performance.now() + clock.offset)),
    );
    return () => clearTimeout(timer);
  }, [roll, clock, graphics, tray, onReveal, member.id]);
  return null;
}

type LogRoll = Pick<
  ParticipantRoll,
  'id' | 'roller' | 'name' | 'faces' | 'power' | 'styles' | 'startsAt'
>;
function DiceAvatar({ style, className = '' }: { style?: Style; className?: string }) {
  return (
    <svg className={`dice-avatar ${className}`} viewBox="0 0 32 36" aria-hidden="true">
      <path d="M16 1 30 9 30 27 16 35 2 27 2 9Z" fill={style?.color ?? '#70dac3'} />
      <path d="M16 1 8 12 24 12Z" fill="#fff" opacity=".25" />
      <path d="M2 9 8 12 2 27Z M24 12 30 27 16 35Z" fill="#000" opacity=".2" />
      <path
        d="M16 1 8 12 2 9M16 1 24 12 30 9M8 12H24L16 27ZM2 27 16 27 30 27M8 12 2 27M24 12 30 27M16 27V35"
        fill="none"
        stroke={style?.ink ?? '#fff4e5'}
        strokeOpacity=".35"
        strokeWidth=".7"
      />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill={style?.ink ?? '#fff4e5'}
        style={
          style?.font
            ? {
                fontFamily: `"${dieFontFamilies[style.font]}"`,
                fontWeight: dieFontWeights[style.font],
              }
            : undefined
        }
      >
        0
      </text>
    </svg>
  );
}

function RollEntry({ roll, viewer }: { roll: LogRoll; viewer: string }) {
  return (
    <article className="roll-log-entry">
      <header>
        <strong className="roll-author">
          <DiceAvatar style={roll.styles[0]} className="roll-avatar" />
          <span className="roll-author-name">
            {roll.name}
            {roll.roller === viewer ? ' · you' : ''}
          </span>
        </strong>
        <time dateTime={new Date(roll.startsAt).toISOString()}>
          {new Date(roll.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>
      <div className="roll-result-line">
        <span className="roll-equation">
          {roll.faces[0]} + {roll.faces[1]}
          {roll.power && roll.power.edges - roll.power.banes === 1 && ' + 2'}
          {roll.power && roll.power.edges - roll.power.banes === -1 && ' − 2'}
        </span>
        <span className="roll-outcome">
          <span>=</span>
          <strong className="roll-total">
            {roll.power?.total ?? roll.faces[0]! + roll.faces[1]!}
          </strong>
          {roll.power && (
            <strong className={`tier tier-${roll.power.tier}`}>Tier {roll.power.tier}</strong>
          )}
        </span>
        {roll.power && roll.power.edges > 0 && (
          <span className="edge">↑ {roll.power.edges === 2 ? 'Double edge' : 'Edge'}</span>
        )}
        {roll.power && roll.power.banes > 0 && (
          <span className="bane">↓ {roll.power.banes === 2 ? 'Double bane' : 'Bane'}</span>
        )}
      </div>
    </article>
  );
}

function DicePreview({ style }: { style: Style }) {
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<ReturnType<typeof createDicePreview> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let active = true;
    try {
      preview.current = createDicePreview(host.current, () => {
        if (active) setFailed(true);
      });
    } catch {
      queueMicrotask(() => {
        if (active) setFailed(true);
      });
    }
    return () => {
      active = false;
      preview.current?.dispose();
      preview.current = null;
    };
  }, []);
  useEffect(() => {
    preview.current?.style(style);
  }, [style]);
  return (
    <div
      className="dice-preview"
      role="img"
      aria-label={`${style.font ?? 'original'} ${style.pattern} die with ${style.color} body and ${style.ink} numbers`}
    >
      <div className="preview-canvas" ref={host} />
      {failed && (
        <p className="preview-fallback">3D preview unavailable. Your dice settings still work.</p>
      )}
    </div>
  );
}

function isBackdropPointer(event: PointerEvent<HTMLDialogElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.target === event.currentTarget &&
    (event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom)
  );
}

/** Fixed-body lock also prevents Safari rubber-banding behind native dialogs. */
function useMenuScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const x = window.scrollX,
      y = window.scrollY;
    const body = document.body.style,
      root = document.documentElement.style;
    const patches: [CSSStyleDeclaration, string, string][] = [
      [body, 'position', 'fixed'],
      [body, 'top', `${-y}px`],
      [body, 'left', `${-x}px`],
      [body, 'width', '100%'],
      [body, 'overflow', 'hidden'],
      [root, 'overflow', 'hidden'],
      [root, 'overscroll-behavior', 'none'],
    ];
    const saved = patches.map(([style, property]) => ({
      style,
      property,
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    }));
    for (const [style, property, value] of patches) style.setProperty(property, value);
    return () => {
      for (const { style, property, value, priority } of saved) {
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
      }
      const behavior = root.getPropertyValue('scroll-behavior'),
        priority = root.getPropertyPriority('scroll-behavior');
      root.setProperty('scroll-behavior', 'auto', 'important');
      window.scrollTo(x, y);
      if (behavior) root.setProperty('scroll-behavior', behavior, priority);
      else root.removeProperty('scroll-behavior');
    };
  }, [open]);
}

function DiceRoom() {
  const [viewer] = useState(() => crypto.randomUUID());
  const [initial, setInitial] = useState(randomProfile);
  const [nameReady, setNameReady] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const socialDialog = useRef<HTMLDialogElement>(null);
  const [joinError, setJoinError] = useState('');
  const [shareError, setShareError] = useState('');
  const customization = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef<number | null>(null);
  function backdropDown(event: PointerEvent<HTMLDialogElement>) {
    backdropPointer.current = isBackdropPointer(event) ? event.pointerId : null;
  }
  function backdropUp(event: PointerEvent<HTMLDialogElement>) {
    if (backdropPointer.current === event.pointerId && isBackdropPointer(event))
      event.currentTarget.close();
    backdropPointer.current = null;
  }

  const [customizing, setCustomizing] = useState(false);
  const [socializing, setSocializing] = useState(false);
  useMenuScrollLock(customizing || socializing);
  const [profile, setProfile] = useState(initial);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const connection = useConvexConnectionState();
  const [presenceError, setPresenceError] = useState('');
  const [edges, setEdges] = useState(0);
  const [banes, setBanes] = useState(0);
  const [clock, setClock] = useState<Clock | null>(null);
  const [clockConnection, setClockConnection] = useState(-1);
  const clockReady = !!clock && clockConnection === connection.connectionCount;
  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clockReady ? clock : null;
  }, [clock, clockReady]);
  const [fontsReady, setFontsReady] = useState(false);
  const [graphics, setGraphics] = useState(false),
    [fallback, setFallback] = useState(false),
    [physicsReady, setPhysicsReady] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [now, setNow] = useState(() => performance.now());
  const [clearing, setClearing] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [rollLog, setRollLog] = useState<LogRoll[]>([]);
  const host = useRef<HTMLDivElement>(null),
    tray = useRef<Tray | null>(null);
  const room = useQuery(demoV2.view, { key: roomKey });
  const tracks = useRef(new Map<string, ParticipantRoll>());
  const [trayRolls, setTrayRolls] = useState<
    Record<string, Pick<ParticipantRoll, 'id' | 'startsAt' | 'duration'>>
  >({});
  const rememberTrack = useCallback((owner: string, roll: ParticipantRoll | null) => {
    if (roll) tracks.current.set(owner, roll);
    else tracks.current.delete(owner);
    setTrayRolls(old => {
      if (old[owner]?.id === roll?.id) return old;
      const next = { ...old };
      if (roll) next[owner] = { id: roll.id, startsAt: roll.startsAt, duration: roll.duration };
      else delete next[owner];
      return next;
    });
  }, []);
  const ownTrack = useQuery(demoV2.track, { key: roomKey, viewer });
  const ping = useAction(demo.clock),
    sampleFaces = useAction(demo.sampleFaces);
  const chooseName = useMutation(demoV2.randomName);
  const clearSharedTray = useMutation(demoV2.clearTray);
  const join = useMutation(demoV2.join),
    customize = useMutation(demoV2.customize),
    throwDice = useMutation(demoV2.throwDice),
    record = useMutation(demoV2.receipt);
  const ready =
    nameReady && clockReady && connection.isWebSocketConnected && (graphics || fallback) && visible;
  useEffect(() => {
    let cancelled = false;
    void chooseName({})
      .then(name => {
        if (cancelled) return;
        setInitial(old => ({ ...old, name }));
        setProfile(old => ({ ...old, name: old.name === 'Player' ? name : old.name }));
        setNameReady(true);
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chooseName]);
  useEffect(() => {
    if (!room?.code) return;
    const address = new URL(location.href);
    address.searchParams.set('room', room.code);
    history.replaceState(null, '', address);
  }, [room?.code]);
  const roomAddress = new URL(location.href);
  if (room?.code) roomAddress.searchParams.set('room', room.code);
  const roomLink = room?.code ? roomAddress.href : '';
  async function copyRoom(kind: 'code' | 'link') {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(kind === 'code' ? room.code : roomLink);
      setShareError('');
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setShareError('Select and copy the code or link below.');
    }
  }
  useEffect(() => {
    let cancelled = false;
    void warmThrows({ scale: 0.65, obstacles: [] })
      .then(() => {
        if (!cancelled) setPhysicsReady(true);
      })
      .catch(e => {
        if (!cancelled) {
          setError(String(e));
          setPhysicsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const stop = startClockSync(
      () => ping({}),
      () => client.connectionState().isWebSocketConnected,
      value => {
        setClock(value);
        setClockConnection(value ? connection.connectionCount : -1);
      },
    );
    return stop;
  }, [ping, connection.isWebSocketConnected, connection.connectionCount]);
  useEffect(() => {
    const change = () => {
      setVisible(!document.hidden);
      setNow(performance.now());
    };
    document.addEventListener('visibilitychange', change);
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => {
      document.removeEventListener('visibilitychange', change);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function heartbeat() {
      if (!nameReady || document.hidden || !connection.isWebSocketConnected) return;
      try {
        await join({
          key: roomKey,
          viewer,
          ...profileRef.current,
          ready,
          uncertainty: clockRef.current?.uncertainty ?? 10000,
        });
        if (!cancelled) setPresenceError('');
      } catch (e) {
        if (!cancelled && !document.hidden && client.connectionState().isWebSocketConnected)
          setPresenceError(String(e));
      }
    }
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [join, viewer, ready, nameReady, connection.isWebSocketConnected]);
  const report = useCallback(
    (
      roll: ParticipantRoll,
      uncertainty: number,
      timing?: { firstFrame: number; revealFrame: number; frames: number; maxFrameGap: number },
    ) => {
      setRollLog(old => {
        if (old.some(entry => entry.id === roll.id && entry.roller === roll.roller)) return old;
        const { id, roller, name, faces, power, styles, startsAt } = roll;
        return [{ id, roller, name, faces, power, styles, startsAt }, ...old]
          .sort((a, b) => b.startsAt - a.startsAt)
          .slice(0, 100);
      });
      const time = performance.now() + (clockRef.current?.offset ?? 0);
      void record({
        key: roomKey,
        roller: roll.roller,
        sample: {
          viewer,
          roll: roll.id,
          uncertainty,
          ...(timing ?? { firstFrame: time, revealFrame: time, frames: 0, maxFrameGap: 0 }),
        },
      }).catch(e => setError(String(e)));
    },
    [record, viewer],
  );
  useEffect(() => {
    let cancelled = false;
    let current: Tray | null = null;
    void loadDiceFonts().then(failed => {
      if (cancelled) return;
      if (failed.length) {
        setError('Dice fonts could not load. Rolls remain available as text; reload to retry 3D.');
        setFallback(true);
        return;
      }
      setFontsReady(true);
      try {
        current = createRoomTray(
          host.current!,
          () => {
            setGraphics(false);
            setFallback(true);
          },
          (roll, timing, uncertainty) => report(roll, uncertainty, timing),
        );
        tray.current = current;
        setGraphics(true);
      } catch {
        setFallback(true);
      }
    });
    return () => {
      cancelled = true;
      current?.dispose();
      if (tray.current === current) tray.current = null;
    };
  }, [report]);
  const members = useMemo(
    () =>
      (room?.participants ?? [])
        .filter(p => p.seenAt > now + (clock?.offset ?? 0) - 30000)
        .map(p => (p.id === viewer ? { ...p, ...profile } : p)),
    [room, profile, viewer, now, clock],
  );
  useEffect(() => {
    tray.current?.participants(members);
  }, [members, graphics]);
  useEffect(() => {
    if (!clock || !physicsReady) return;
    const scene = restingScene(tracks.current.values(), members, viewer, now + clock.offset);
    void warmThrows(scene).catch(() => {
      /* Throw preparation retries on click. */
    });
  }, [members, viewer, now, clock, physicsReady]);
  const hasDice =
    !clearing &&
    !!clock &&
    members.some(member => {
      const roll = trayRolls[member.id];
      return (
        roll && now + clock.offset >= roll.startsAt && trayOpacity(roll, now + clock.offset) > 0
      );
    });
  const buttonChannels = [1, 3, 5].map(i => {
    const c = parseInt(profile.style.color.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const rollInk =
    buttonChannels[0]! * 0.2126 + buttonChannels[1]! * 0.7152 + buttonChannels[2]! * 0.0722 > 0.179
      ? '#000'
      : '#fff';
  const joined = room?.participants.some(p => p.id === viewer);
  useEffect(() => {
    if (!joined || profile === initial || !profile.name.trim()) return;
    const timer = setTimeout(() => {
      void customize({ key: roomKey, viewer, name: profile.name, style: profile.style }).catch(e =>
        setError(String(e)),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [profile, initial, joined, viewer, customize]);
  const ownRoll = ownTrack?.roll;
  const busy =
    pending || !!(ownRoll && clock && now + clock.offset < ownRoll.startsAt + ownRoll.duration);
  async function clearDice() {
    setClearing(true);
    setError('');
    for (const id of tracks.current.keys()) tray.current?.clear(id);
    try {
      await clearSharedTray({ key: roomKey, viewer });
    } catch (e) {
      if (clockRef.current)
        for (const roll of tracks.current.values()) tray.current?.play(roll, clockRef.current);
      setError(String(e));
    } finally {
      setClearing(false);
    }
  }
  async function perform() {
    setPending(true);
    setError('');

    try {
      await customize({ key: roomKey, viewer, name: profile.name, style: profile.style });
      const faces = await sampleFaces({});
      const scene = restingScene(
        tracks.current.values(),
        members,
        viewer,
        performance.now() + (clockRef.current?.offset ?? 0),
      );
      const { motion } = await prepareThrow(faces, scene);
      await throwDice({
        key: roomKey,
        viewer,
        id: crypto.randomUUID(),
        faces,
        motion,
        edges,
        banes,
      });
      setEdges(0);
      setBanes(0);
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  }
  function edit(patch: Partial<Style>) {
    setProfile(old => ({ ...old, style: { ...old.style, ...patch } }));
  }
  return (
    <main className="lab v2">
      <div className="roll-area">
        <header className="lab-header">
          <a href="https://github.com/illos/powerroller">Source</a>
          <h1 className="power-title">Power Roller</h1>
          <button
            type="button"
            className="customize-trigger"
            aria-label="Customize dice"
            title="Customize dice"
            onClick={() => {
              customization.current?.showModal();
              setCustomizing(true);
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <path d="M12 2 21 7v10l-9 5-9-5V7Z" />
              <path d="m12 2-5 13h10Zm-9 5 4 8-4 2m18-10-4 8 4 2M7 15l5 7 5-7" />
            </svg>
          </button>
          <button
            type="button"
            className="customize-trigger"
            aria-label="Open social menu"
            title="Join or share a table"
            onClick={() => {
              setJoinError('');
              setShareError('');
              socialDialog.current?.showModal();
              setSocializing(true);
            }}
          >
            <Users aria-hidden />
          </button>
        </header>
        <div className="dice-card">
          <section className="stage" aria-label="Shared 3D dice tray">
            <div className="canvas-host" ref={host} />
            <div className="stage-label">
              <span className="dot" />
              {visible && (!clockReady || !connection.isWebSocketConnected)
                ? connection.hasEverConnected
                  ? 'Reconnecting…'
                  : 'Connecting…'
                : `${members.length} / 8 participants`}
            </div>
            {hasDice && (
              <button
                type="button"
                className="clear-tray"
                aria-label={clearing ? 'Clearing tray' : 'Clear tray'}
                title="Clear tray"
                disabled={!joined || pending || clearing || room?.expired}
                onClick={() => void clearDice()}
              >
                <Eraser aria-hidden />
              </button>
            )}
            {fallback && (
              <p className="fallback">3D unavailable · shared text results still work.</p>
            )}
          </section>
          <section className="controls">
            <div className="power-modifiers" role="group" aria-label="Modifiers for next roll">
              {[
                { name: 'edge', label: 'Edge', icon: '↑', count: edges, set: setEdges },
                { name: 'bane', label: 'Bane', icon: '↓', count: banes, set: setBanes },
              ].map(control => (
                <div className="modifier-buttons" key={control.name}>
                  <button
                    type="button"
                    data-roll-modifier={control.name}
                    aria-label={`${control.label}: ${control.count} of 2. Add ${control.name}`}
                    disabled={clearing || busy || control.count === 2}
                    onClick={() => control.set(count => Math.min(2, count + 1))}
                  >
                    <span aria-hidden>{control.icon}</span> {control.label}
                    <span className="modifier-count" aria-hidden>
                      {control.count}
                    </span>
                  </button>
                  {control.count > 0 && (
                    <button
                      type="button"
                      data-roll-modifier={control.name}
                      aria-label={`Remove ${control.name}`}
                      disabled={clearing || busy}
                      onClick={event => {
                        const button = event.currentTarget;
                        const group = button.parentElement;
                        control.set(count => Math.max(0, count - 1));
                        if (document.activeElement === button)
                          requestAnimationFrame(() => {
                            if (!button.isConnected && document.activeElement === document.body)
                              group?.querySelector<HTMLButtonElement>('button')?.focus();
                          });
                      }}
                    >
                      <span aria-hidden>−</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="primary"
              style={{ backgroundColor: profile.style.color, color: rollInk }}
              aria-label={
                !ready || !physicsReady
                  ? 'Roll (dice warming)'
                  : pending
                    ? 'Roll (preparing)'
                    : busy
                      ? 'Roll (dice rolling)'
                      : 'Roll'
              }
              aria-busy={pending || clearing}
              disabled={clearing || !ready || !physicsReady || !joined || busy || room?.expired}
              onClick={() => void perform()}
            >
              Roll
            </button>
          </section>
        </div>
      </div>
      {members.map(member => (
        <TrackCard
          key={member.id}
          member={member}
          clock={clock}
          tray={tray}
          graphics={graphics}
          onReveal={report}
          onTrack={rememberTrack}
        />
      ))}
      <section className="track-results" aria-label="Roll log" tabIndex={0}>
        {rollLog.length ? (
          rollLog.map(roll => (
            <RollEntry key={`${roll.roller}:${roll.id}`} roll={roll} viewer={viewer} />
          ))
        ) : (
          <p className="empty-log">Throw dice to start the log.</p>
        )}
        <span className="visually-hidden" role="status">
          {rollLog[0]
            ? `${rollLog[0].name} rolled ${rollLog[0].power?.total ?? rollLog[0].faces[0]! + rollLog[0].faces[1]!}`
            : ''}
        </span>
      </section>
      {error && !customizing && !socializing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {presenceError && (
        <p className="error" role="alert">
          {presenceError}
        </p>
      )}
      {room?.expired && (
        <p className="error">
          This room has expired. <a href={import.meta.env.BASE_URL}>Start a new room</a>
        </p>
      )}
      <dialog
        ref={socialDialog}
        onClose={() => setSocializing(false)}
        onPointerDown={backdropDown}
        onPointerUp={backdropUp}
        onPointerCancel={() => {
          backdropPointer.current = null;
        }}
        className="dice-customization social-dialog"
        aria-labelledby="join-table-title"
      >
        <header>
          <h2 id="join-table-title">Table</h2>
          <button
            type="button"
            aria-label="Close social menu"
            onClick={() => socialDialog.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        <section className="connected-players" aria-labelledby="connected-players-title">
          <h3 id="connected-players-title">
            Connected players <span>{members.length}</span>
          </h3>
          {members.length ? (
            <ul>
              {members.map(member => (
                <li key={member.id}>
                  <DiceAvatar style={member.style} />
                  <span className="connected-player-name">{member.name}</span>
                  {member.id === viewer && <span className="connected-player-you">you</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p>{room ? 'No players connected.' : 'Connecting…'}</p>
          )}
        </section>
        <label className="social-name">
          Display name
          <input
            maxLength={32}
            value={profile.name}
            disabled={busy}
            onChange={e => setProfile(old => ({ ...old, name: e.target.value }))}
          />
        </label>
        {socializing && error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <section className="menu-sharing" aria-label="Share table">
          <div>
            <label htmlFor="menu-table-code">Table code</label>
            <div className="share-field share-code">
              <input
                id="menu-table-code"
                readOnly
                value={room?.code ?? ''}
                placeholder="Connecting…"
                onFocus={event => event.currentTarget.select()}
                onClick={event => event.currentTarget.select()}
              />
              <button
                type="button"
                disabled={!room?.code}
                onClick={() => void copyRoom('code')}
                aria-label={copied === 'code' ? 'Code copied' : 'Copy table code'}
              >
                {copied === 'code' ? <Check aria-hidden /> : <Copy aria-hidden />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="menu-table-link">Table link</label>
            <div className="share-field">
              <input
                id="menu-table-link"
                readOnly
                value={roomLink}
                placeholder="Connecting…"
                onFocus={event => event.currentTarget.select()}
                onClick={event => event.currentTarget.select()}
              />
              <button
                type="button"
                disabled={!room?.code}
                onClick={() => void copyRoom('link')}
                aria-label={copied === 'link' ? 'Link copied' : 'Copy table link'}
              >
                {copied === 'link' ? <Check aria-hidden /> : <LinkIcon aria-hidden />}
              </button>
            </div>
          </div>
          <span className="visually-hidden" role="status">
            {copied ? `${copied === 'code' ? 'Code' : 'Link'} copied` : ''}
          </span>
        </section>
        {shareError && (
          <p className="error" role="alert">
            {shareError}
          </p>
        )}
        <form
          className="room-join-form"
          onSubmit={event => {
            event.preventDefault();
            const key = parseRoomKey(joinInput);
            if (!key) {
              setJoinError('Enter an eight-character room code or room link.');
              return;
            }
            const address = new URL(location.href);
            address.searchParams.set('room', key);
            location.assign(address.href);
          }}
        >
          <label htmlFor="join-table-input">Join a table</label>
          <div className="join-field">
            <input
              id="join-table-input"
              aria-label="Room code or link"
              placeholder="Room code or link"
              value={joinInput}
              onChange={event => {
                setJoinInput(event.target.value);
                setJoinError('');
              }}
            />
            <button type="submit" className="primary" disabled={!joinInput.trim()}>
              Join
            </button>
          </div>
          {joinError && (
            <p className="error" role="alert">
              {joinError}
            </p>
          )}
        </form>
      </dialog>
      <dialog
        ref={customization}
        onPointerDown={backdropDown}
        onPointerUp={backdropUp}
        onPointerCancel={() => {
          backdropPointer.current = null;
        }}
        className="dice-customization profile-dialog"
        aria-labelledby="dice-customization-title"
        onClose={() => setCustomizing(false)}
      >
        <header>
          <h2 id="dice-customization-title">Customize dice</h2>
          <button
            type="button"
            aria-label="Close customization"
            onClick={() => customization.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        {customizing && fontsReady && <DicePreview style={profile.style} />}
        {customizing && !fontsReady && (
          <p role="status">{fallback ? '3D font preview unavailable.' : 'Loading dice fonts…'}</p>
        )}
        <fieldset disabled={busy} className="profile-fields">
          <ColorControls color={profile.style.color} ink={profile.style.ink} onChange={edit} />
          <label className="full-field">
            Pattern
            <select
              value={profile.style.pattern}
              onChange={e => edit({ pattern: e.target.value as Style['pattern'] })}
            >
              <option value="solid">Solid</option>
              <option value="speckle">Speckle</option>
              <option value="marble">Marble</option>
              <option value="frosted">Frosted</option>
            </select>
          </label>
          <label className="full-field">
            Font style
            <select
              value={profile.style.font ?? 'legacy'}
              onChange={e => edit({ font: e.target.value as Style['font'] })}
            >
              {!profile.style.font && (
                <option value="legacy" disabled>
                  Original · Georgia
                </option>
              )}
              <option value="serif">Serif</option>
              <option value="modern">Modern</option>
              <option value="rune">Rune</option>
              <option value="gothic">Gothic</option>
            </select>
          </label>
        </fieldset>
        {customizing && error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </dialog>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={client}>
      <DiceRoom />
    </ConvexProvider>
  </StrictMode>,
);
