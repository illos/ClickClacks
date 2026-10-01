// SPDX-License-Identifier: MIT
import {
  createContext,
  useContext,
  useId,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { Check, Copy, X, Users, Eraser, Volume2, VolumeX, PictureInPicture2, Link as LinkIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import clickClacksLogo from '../branding/click-clacks.svg';
import { makeFunctionReference } from 'convex/server';
import { createController, type Identity, type Profile, type DeliveredRoll } from '../../lib/client';
import { displayError, redactError } from '../../lib/errors';
import { genericModifierValue, rollCooldownMs } from '../../shared/dice';
import { describeRoll, rollDiceNotation } from '../../lib/format';
import { criticalResult, criticalLabel } from '../../lib/critical';
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useMutation,
  useQuery,
  useConvexConnectionState,
} from 'convex/react';
import { demo } from '../dice-demo/api';
import type { createThrowPlanner } from '../dice-demo/prepare-throw';
import type { restingScene } from './resting-scene';
import { packMotion, unpackTrack } from '../dice-demo/motion-codec';
import { type Style, type Motion, type DiceConfig } from '../dice-demo/model';
import type { SitePreferences, CachedRoll } from '../site/storage';
import { dieFontFamilies, dieFontWeights } from '../dice-demo/font-style';
import { demoV2 } from './api';
import {
  parseRoomKey,
  randomProfile,
  revealDelay,
  trayOpacity,
  type Participant,
  type ParticipantRoll,
} from './model';
import type { createRoomTray } from './renderer';
import type { createDicePreview } from './preview';
import { createDiceSound } from './dice-sound';
import { AccessibilityControls } from './accessibility-controls';
import { DiceDesignControls } from './dice-design-controls';
import { startClockSync } from './clock-sync';
import { RollLog } from './roll-log';
export type RollControls = { diceCount: number; bonusD4: boolean; edges: number; banes: number; readyAt?: number };
export type PowerRollerOptions = {
  client: ConvexReactClient;
  roomKey: string;
  identity?: Identity;
  profile?: Profile;
  nameProvider?: () => string | Promise<string>;
  preferences?: SitePreferences;
  onPreferences?: (preferences: SitePreferences) => void;
  onProfile?: (profile: Profile) => void;
  onRoom?: (code: string) => void;
  onJoin?: (key: string) => void;
  roomLink?: (code: string) => string;
  loadHistory?: (code: string) => Promise<CachedRoll[]>;
  onRoll?: (code: string, roll: ParticipantRoll) => void | Promise<void>;
  /** Show the six latest revealed rolls beneath the dice inside the tray. */
  trayHistory?: boolean;
  /** Host-provided desktop Document PiP; omitted when unsupported. */
  onPopout?: () => void;
  popoutActive?: boolean;
  popoutError?: string;
  /** Transient host synchronization; these controls are never saved to browser preferences. */
  controls?: RollControls;
  onControls?: (controls: RollControls) => void;
};
const RollerContext = createContext<PowerRollerOptions | null>(null);
function useRoller() { const value = useContext(RollerContext); if (!value) throw new Error('Mount inside PowerRoller.'); return value; }
export function PowerRoller(options: PowerRollerOptions) {
  const [activeRoom, setActiveRoom] = useState(options.roomKey);
  useEffect(() => setActiveRoom(options.roomKey), [options.roomKey]);
  const [activeProfile, setActiveProfile] = useState(options.profile);
  const [activePreferences, setActivePreferences] = useState(options.preferences);
  useEffect(() => setActiveProfile(options.profile), [options.profile]);
  useEffect(() => setActivePreferences(options.preferences), [options.preferences]);
  const value = { ...options, roomKey: activeRoom, profile: activeProfile, preferences: activePreferences,
    onProfile: (profile: Profile) => { setActiveProfile(profile); options.onProfile?.(profile); },
    onPreferences: (preferences: SitePreferences) => { setActivePreferences(preferences); options.onPreferences?.(preferences); },
    onJoin: (key: string) => { setActiveRoom(key); options.onJoin?.(key); } };
  return <div className="powerroller"><ConvexProvider client={options.client}><RollerContext.Provider value={value}><DiceRoom key={activeRoom} /></RollerContext.Provider></ConvexProvider></div>;
}
type Clock = { offset: number; uncertainty: number };
type Tray = ReturnType<typeof createRoomTray>;

function TrackCard({
  member,
  clock,
  tray,
  graphics,
  onReveal,
  onTrack,
  hasTrack,
}: {
  member: Participant;
  clock: Clock | null;
  tray: React.RefObject<Tray | null>;
  graphics: boolean;
  onReveal: (roll: ParticipantRoll, uncertainty: number) => void;
  onTrack: (owner: string, roll: ParticipantRoll | null) => void;
  hasTrack: (owner: string, id: string) => boolean;
}) {
  const { roomKey, client } = useRoller();
  const encodedTrack = useQuery(demoV2.track, { key: roomKey, viewer: member.id });
  const track = useMemo(
    () => (encodedTrack ? unpackTrack(encodedTrack) : encodedTrack),
    [encodedTrack],
  );
  const roll = track?.roll;
  useEffect(() => {
    let active = true;
    onTrack(member.id, roll ?? null);
    for (const previous of track?.activeRolls ?? []) {
      if (previous.id === roll?.id || hasTrack(member.id, previous.id)) continue;
      void client.query(demoV2.track, { key: roomKey, viewer: member.id, rollId: previous.id })
        .then(value => { if (active && value) onTrack(member.id, unpackTrack(value).roll); })
        .catch(() => { /* A single cosmetic path cannot interrupt current playback. */ });
    }
    return () => { active = false; };
  }, [member.id, track, roomKey, client, onTrack, hasTrack]);
  useEffect(() => () => onTrack(member.id, null), [member.id, onTrack]);
  useEffect(() => {
    if (!roll) {
      tray.current?.clear(member.id);
      return;
    }
    if (clock && graphics && tray.current) tray.current.play(roll, clock);
  }, [roll, clock, graphics, tray, member.id]);
  return null;
}

type LogRoll = Pick<
  ParticipantRoll,
  'id' | 'roller' | 'name' | 'faces' | 'power' | 'styles' | 'startsAt' | 'dice' | 'modifier' | 'total' | 'edges' | 'banes' | 'source'
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

function RollEntry({ roll, viewer, avatarStyle }: { roll: LogRoll; viewer: string; avatarStyle?: Style }) {
  const critical = criticalResult(roll);
  const showEquation = roll.faces.length > 1 || !!roll.modifier;
  return (
    <article className={`roll-log-entry${critical ? ` critical-${critical}` : ''}`}>
      <header>
        <strong className="roll-author">
          <DiceAvatar style={avatarStyle ?? roll.styles[0]} className="roll-avatar" />
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
        <span className="roll-dice-notation">{rollDiceNotation(roll)}</span>
        <span aria-hidden="true">|</span>
        {showEquation && <span className="roll-equation">
          {roll.faces.join(' + ')}
          {roll.power && roll.power.edges - roll.power.banes === 1 && ' + 2'}
          {roll.power && roll.power.edges - roll.power.banes === -1 && ' − 2'}
          {!roll.power &&
            !!roll.modifier &&
            `${roll.modifier > 0 ? ' + ' : ' − '}${Math.abs(roll.modifier)}`}
        </span>}
        <span className="roll-outcome">
          {showEquation && <span>=</span>}
          <strong className="roll-total">
            {roll.total ?? roll.power?.total ??
              roll.faces.reduce((total, face) => total + face, 0) + (roll.modifier ?? 0)}
          </strong>
          {roll.power && (
            <strong className={`tier tier-${roll.power.tier}`}>Tier {roll.power.tier}</strong>
          )}
          {critical && <strong className={`critical-badge critical-${critical}`}>{criticalLabel(critical)}</strong>}
        </span>
        {roll.power && roll.power.edges > 0 && (
          <span className="edge">↑ {roll.power.edges === 2 ? 'Double edge' : 'Edge'}</span>
        )}
        {roll.power && roll.power.banes > 0 && (
          <span className="bane">↓ {roll.power.banes === 2 ? 'Double bane' : 'Bane'}</span>
        )}
      </div>
      <span className="visually-hidden">{describeRoll(roll as ParticipantRoll).detailed}</span>
    </article>
  );
}

function TrayHistory({ rolls, viewer, motion }: { rolls: LogRoll[]; viewer: string; motion: SitePreferences['motion'] }) {
  const host = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const reduced = motion === 'reduce' || (motion === 'device' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const row of host.current!.querySelectorAll<HTMLElement>('[data-history-key]')) {
      const key = row.dataset.historyKey!;
      const top = row.offsetTop;
      next.set(key, top);
      if (reduced) row.getAnimations().forEach(animation => animation.cancel());
      else {
        const previous = positions.current.get(key);
        if (previous !== top) {
          row.getAnimations().forEach(animation => animation.cancel());
          row.animate([
            { transform: `translateY(${previous === undefined ? -24 : previous - top}px)` },
            { transform: 'translateY(0)' },
          ], { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      }
    }
    positions.current = next;
  }, [rolls, reduced]);
  return <div className="tray-history" ref={host} role="region" aria-label="Recent tray rolls" data-motion={reduced ? 'reduce' : 'full'}>
    {rolls.slice(0, 6).map(roll => <div className="tray-history-row"
      key={`${roll.roller}:${roll.id}`} data-history-key={`${roll.roller}:${roll.id}`}>
      <RollEntry roll={roll} viewer={viewer} />
    </div>)}
  </div>;
}

function DicePreview({ style, preferences }: { style: Style; preferences?: SitePreferences }) {
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<ReturnType<typeof createDicePreview> | null>(null);
  const latest = useRef({ style, preferences });
  latest.current = { style, preferences };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current || preferences?.hidden) return;
    let active = true;
    void Promise.all([import('./preview'), import('../dice-demo/fonts')])
      .then(async ([graphics, fonts]) => {
        const failedFonts = await fonts.loadDiceFonts();
        if (!active) return;
        if (failedFonts.length) {
          setFailed(true);
          return;
        }
        try {
          preview.current = graphics.createDicePreview(
            host.current!,
            () => {
              if (active) setFailed(true);
            },
            latest.current.preferences,
          );
          preview.current.style(latest.current.style);
        } catch {
          if (active) setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      preview.current?.dispose();
      preview.current = null;
    };
  }, [preferences?.hidden]);
  useEffect(() => {
    preview.current?.setPreferences(preferences ?? {});
    preview.current?.style(style);
  }, [style, preferences]);
  if (preferences?.hidden) return null;
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

let menuLockCount = 0;
let restoreMenuScroll: (() => void) | undefined;
function releaseMenuScroll() { if (--menuLockCount === 0) { restoreMenuScroll?.(); restoreMenuScroll = undefined; } }

/** Fixed-body lock also prevents Safari rubber-banding behind native dialogs. */
function useMenuScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    if (++menuLockCount > 1) return releaseMenuScroll;
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
    restoreMenuScroll = () => {
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
    return releaseMenuScroll;
  }, [open]);
}

type SelectedDice = NonNullable<SitePreferences['selectedDice']>;
const diceChoices: ReadonlyArray<{ value: SelectedDice; label: string }> = [
  { value: 'power', label: 'Power roll (2d10)' },
  ...([20, 12, 10, 8, 6, 4] as const).map(value => ({ value, label: `d${value}` })),
];
function RollDieIcon({ dice }: { dice: SelectedDice }) {
  const overlapMask = useId();
  if (dice === 'power') return (
    <svg aria-hidden="true" viewBox="0 0 34 30" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <defs>
        <mask id={overlapMask} maskUnits="userSpaceOnUse" x="0" y="0" width="34" height="30">
          <rect width="34" height="30" fill="white" stroke="none" />
          <path d="M12 7 21 12v10l-9 5-9-5V12Z" transform="rotate(-12 12 17)" fill="black" stroke="black" strokeWidth="2.8" />
        </mask>
      </defs>
      <g mask={`url(#${overlapMask})`}>
        <g transform="rotate(16 23 11)">
          <path d="M23 2 31 6.5v9l-8 4.5-8-4.5v-9Z" />
          <text x="25" y="12" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontSize="8" fontWeight="700">10</text>
        </g>
      </g>
      <g transform="rotate(-12 12 17)">
        <path d="M12 7 21 12v10l-9 5-9-5V12Z" />
        <text x="12" y="20.5" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontSize="10" fontWeight="700">10</text>
      </g>
    </svg>
  );
  const sides = dice;
  const outline =
    sides === 4
      ? 'M12 2 23 21H1Z'
      : sides === 6
        ? 'M12 2 22 7v10l-10 5-10-5V7Z'
        : sides === 8 || sides === 10
          ? 'M12 1 22 12 12 23 2 12Z'
          : sides === 12
            ? 'M12 1 23 9 19 22H5L1 9Z'
            : 'M12 2 21 7v10l-9 5-9-5V7Z';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d={outline} />
      {sides === 6 && <path d="m2 7 10 5 10-5M12 12v10" />}
      {sides === 6 && [[12, 7], [5, 11], [9, 17], [15, 17], [17, 14], [19, 11]].map(([cx, cy]) => (
        <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="1" fill="currentColor" stroke="none" />
      ))}
      {sides === 12 && <path d="M12 6 18 10.5 16 17H8L6 10.5ZM12 1v5M23 9l-5 1.5M19 22l-3-5M5 22l3-5M1 9l5 1.5" />}
      {sides === 4 && <path d="M12 2V14.7M1 21l11-6.3L23 21" />}
      {sides === 20 && <path d="m12 2-5 13h10Zm-9 5 4 8-4 2m18-10-4 8 4 2M7 15l5 7 5-7" />}
      {sides === 10 && <path d="m12 1-5 11 5 11 5-11ZM2 12h20" />}
      {sides === 8 && <path d="M2 12h20M12 1v22" />}
    </svg>
  );
}

function DiceRoom() {
  const instanceId = useId();
  const options = useRoller();
  const { roomKey, client } = options;
  const [preferences, setSavedPreferences] = useState<SitePreferences>(() => options.preferences ?? { motion: 'device', hidden: false, highContrast: false, announcements: 'all' });
  useEffect(() => { if (options.preferences) setSavedPreferences(options.preferences); }, [options.preferences]);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const sound = useRef<ReturnType<typeof createDiceSound> | null>(null);
  useEffect(() => {
    const audio = createDiceSound(); sound.current = audio; audio.setEnabled(preferencesRef.current.sound === true);
    return () => { audio.dispose(); sound.current = null; };
  }, []);
  useEffect(() => { sound.current?.setEnabled(preferences.sound === true && !options.popoutActive); }, [preferences.sound, options.popoutActive]);
  function unlockSound() {
    void sound.current?.unlock().then(() => {
      const clock = clockRef.current;
      if (!clock) return;
      for (const roll of tracks.current.values()) playSound(roll, clock.offset);
    });
  }
  function playSound(roll: ParticipantRoll, offset: number) {
    const p = preferencesRef.current;
    const reduced = p.hidden || p.motion === 'reduce' || (p.motion === 'device' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    sound.current?.play(roll, offset, reduced);
  }
  const planner = useRef<ReturnType<typeof createThrowPlanner> | null>(null);
  const makeRestingScene = useRef<typeof restingScene | null>(null);
  function changePreferences(next: SitePreferences) {
    setSavedPreferences(next);
    options.onPreferences?.(next);
  }
  const [identity] = useState(() => options.identity ?? { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() });
  const { viewer, credential } = identity;
  const identityReady = true;
  const [savedProfile] = useState(() => options.profile);
  const [initial, setInitial] = useState(() => savedProfile ?? randomProfile());
  const [nameReady, setNameReady] = useState(!!savedProfile?.name);
  const [joinInput, setJoinInput] = useState('');
  const socialDialog = useRef<HTMLDialogElement>(null);
  const [joinError, setJoinError] = useState('');
  const [changingTable, setChangingTable] = useState(false);
  const changingTableRef = useRef(false);
  const heartbeatPending = useRef<Promise<unknown> | null>(null);
  const hasJoined = useRef(false);
  const customizePending = useRef<Promise<unknown> | null>(null);
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
  useEffect(() => {
    if (options.profile && JSON.stringify(options.profile) !== JSON.stringify(profileRef.current))
      setProfile(options.profile);
  }, [options.profile]);
  const connection = useConvexConnectionState();
  const [presenceError, setPresenceError] = useState('');
  const selectedDice = preferences.selectedDice ?? 'power';
  const [bonusD4, setBonusD4] = useState(options.controls?.bonusD4 ?? false);
  const [pointerPicker, setPointerPicker] = useState(false);
  const [diceCount, setDiceCount] = useState(options.controls?.diceCount ?? 1),
    [choosingDice, setChoosingDice] = useState(false);
  const rollControls = useRef<HTMLDivElement>(null),
    dicePicker = useRef<HTMLButtonElement>(null),
    diceMenu = useRef<HTMLDivElement>(null);
  const diceConfig = useMemo(
    () =>
      selectedDice === 'power'
        ? { kind: 'power' as const, sides: 10 as const, count: 2 }
        : { kind: 'dice' as const, sides: selectedDice, count: diceCount, ...(bonusD4 && selectedDice !== 4 ? { bonusD4: true } : {}) },
    [selectedDice, diceCount, bonusD4],
  );
  useEffect(() => {
    if (!choosingDice) return;
    const menu = diceMenu.current;
    if (menu && dicePicker.current) {
      menu.showPopover();
      const rect = dicePicker.current.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.right - 190, innerWidth - 198))}px`;
      menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 8)}px`;
    }
    rollControls.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const close = (event: globalThis.PointerEvent) => {
      if (!rollControls.current?.contains(event.target as Node)) setChoosingDice(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [choosingDice]);
  const retryThrow = useRef<{
    id: string;
    dice: DiceConfig;
    edges: number;
    banes: number;
    faces?: number[];
    motion?: Motion;
  } | null>(null);
  const [edges, setEdges] = useState(options.controls?.edges ?? 0);
  const [banes, setBanes] = useState(options.controls?.banes ?? 0);
  const incomingControls = useRef<RollControls | undefined>(undefined);
  useEffect(() => {
    if (!options.controls) return;
    incomingControls.current = options.controls;
    setDiceCount(options.controls.diceCount); setBonusD4(options.controls.bonusD4);
    setEdges(options.controls.edges); setBanes(options.controls.banes);
  }, [options.controls]);
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
  const delivered = useRef(new Set<string>());
  const optionsRef = useRef(options); optionsRef.current = options;
  const codeRef = useRef<string | null>(null);
  const [historyReady, setHistoryReady] = useState(!options.loadHistory);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!announcements.length) return;
    setAnnouncement('');
    const speak = setTimeout(() => setAnnouncement(announcements[0]!), 50);
    const next = setTimeout(() => { setAnnouncement(''); setAnnouncements(queue => queue.slice(1)); }, 950);
    return () => { clearTimeout(speak); clearTimeout(next); };
  }, [announcements]);
  const host = useRef<HTMLDivElement>(null),
    tray = useRef<Tray | null>(null);
  const room = useQuery(demoV2.view, { key: roomKey });
  codeRef.current = room?.code ?? null;
  useEffect(() => {
    if (!room?.code || !options.loadHistory) return;
    let active = true;
    void options.loadHistory(room.code).then(history => {
      if (!active) return;
      for (const roll of history) delivered.current.add(`${roll.roller}:${roll.id}`);
      setRollLog(current => [...current, ...history.filter(roll => !current.some(value => value.id === roll.id && value.roller === roll.roller))].sort((a,b) => b.startsAt-a.startsAt).slice(0,100));
    }).catch(() => {}).finally(() => { if (active) setHistoryReady(true); });
    return () => { active = false; };
  }, [room?.code]);
  const tracks = useRef(new Map<string, ParticipantRoll>());
  const [trayRolls, setTrayRolls] = useState<
    Record<string, Pick<ParticipantRoll, 'id' | 'roller' | 'startsAt' | 'duration'>>
  >({});
  const rememberTrack = useCallback((owner: string, roll: ParticipantRoll | null) => {
    const key = roll ? `${owner}:${roll.id}` : null;
    if (roll) tracks.current.set(key!, roll);
    else for (const [id, value] of tracks.current) if (value.roller === owner) tracks.current.delete(id);
    setTrayRolls(old => {
      if (key && old[key]?.id === roll?.id) return old;
      const next = { ...old };
      if (roll) next[key!] = { id: roll.id, roller: owner, startsAt: roll.startsAt, duration: roll.duration };
      else for (const [id, value] of Object.entries(next)) if (value.roller === owner) delete next[id];
      return next;
    });
  }, []);
  const hasTrack = useCallback((owner: string, id: string) => tracks.current.has(`${owner}:${id}`), []);
  useEffect(() => {
    if (!clock) return;
    const expired = [...tracks.current].filter(([, roll]) => trayOpacity(roll, now + clock.offset) === 0).map(([id]) => id);
    if (!expired.length) return;
    for (const id of expired) tracks.current.delete(id);
    setTrayRolls(old => { const next = { ...old }; for (const id of expired) delete next[id]; return next; });
  }, [now, clock]);
  const audibleOwners = useRef(new Set<string>());
  useEffect(() => {
    const owners = new Set([...tracks.current.values()].map(roll => roll.roller));
    for (const owner of audibleOwners.current) if (!owners.has(owner)) sound.current?.cancel(owner);
    audibleOwners.current = owners;
    if (clock) for (const roll of tracks.current.values()) {
      playSound(roll, clock.offset);
      if (graphics) tray.current?.play(roll, clock);
    }
  }, [trayRolls, clock, graphics]);
  const ping = useAction(demo.clock),
    sampleFaces = useAction(demo.sampleFaces);
  const chooseName = useMutation(demoV2.randomName);
  const clearSharedTray = useMutation(demoV2.clearTray);
  const leave = useMutation(demoV2.leave);
  const join = useMutation(demoV2.join),
    customize = useMutation(demoV2.customize),
    throwDice = useMutation(demoV2.throwDice),
    record = useMutation(demoV2.receipt);
  const ready =
    identityReady && nameReady && clockReady && connection.isWebSocketConnected && visible;
  useEffect(() => {
    if (nameReady) return;
    let cancelled = false;
    void Promise.resolve().then(() => options.nameProvider ? options.nameProvider() : chooseName({}))
      .then(name => {
        if (options.nameProvider && (typeof name !== 'string' || !name.trim() || name.length > 32)) throw new Error('Name provider must return 1–32 characters; using Player.');
        if (cancelled) return;
        setInitial(old => ({ ...old, name }));
        setProfile(old => ({ ...old, name: old.name === 'Player' ? name : old.name }));
        setNameReady(true);
      })
      .catch(e => {
        if (!cancelled) { setError(displayError(e, credential)); if (options.nameProvider) setNameReady(true); }
      });
    return () => {
      cancelled = true;
    };
  }, [chooseName, nameReady]);
  useEffect(() => {
    if (nameReady) options.onProfile?.(profile);
  }, [profile, nameReady]);
  useEffect(() => {
    if (!room?.code) return;
    options.onRoom?.(room.code);
  }, [room?.code]);
  const roomLink = room?.code ? options.roomLink?.(room.code) ?? room.code : '';
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
      // A faster clock batch can finish during the initial join. Publish its ready
      // state after that join instead of dropping the update until the 10s timer.
      if (heartbeatPending.current) await heartbeatPending.current.catch(() => {});
      if (cancelled || options.popoutActive || changingTableRef.current || heartbeatPending.current || !identityReady || !nameReady || document.hidden || !connection.isWebSocketConnected)
        return;
      // First membership can wait for the concurrent clock batch and be ready in
      // one mutation. Later reconnects still publish an unready existing member.
      if (!hasJoined.current && !ready) return;
      try {
        const request = join({
          key: roomKey,
          viewer,
          credential,
          ...profileRef.current,
          ready,
          uncertainty: clockRef.current?.uncertainty ?? 10000,
        });
        heartbeatPending.current = request;
        await request;
        hasJoined.current = true;
        if (!cancelled) setPresenceError('');
      } catch (e) {
        if (!cancelled && !document.hidden && client.connectionState().isWebSocketConnected)
          setPresenceError(displayError(e, credential));
      } finally {
        heartbeatPending.current = null;
      }
    }
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [join, viewer, credential, identityReady, ready, nameReady, connection.isWebSocketConnected, options.popoutActive]);
  const report = useCallback(
    (
      roll: ParticipantRoll,
      uncertainty: number,
      timing?: { firstFrame: number; revealFrame: number; frames: number; maxFrameGap: number },
    ) => {
      const rollKey = `${roll.roller}:${roll.id}`;
      if (!delivered.current.has(rollKey)) {
        delivered.current.add(rollKey);
        if (delivered.current.size > 5000) delivered.current.delete(delivered.current.values().next().value!);
        if (codeRef.current) void optionsRef.current.onRoll?.(codeRef.current, roll);
        const prefs = preferencesRef.current;
        if (!(roll as DeliveredRoll).historical && (prefs.announcements === 'all' || prefs.announcements === 'mine' && roll.roller === viewer)) setAnnouncements(queue => [...queue, describeRoll(roll).concise]);
      }
      setRollLog(old => {
        if (old.some(entry => entry.id === roll.id && entry.roller === roll.roller)) return old;
        const { id, roller, name, faces, power, styles, startsAt, dice, modifier, total, edges, banes, source } = roll;
        return [{ id, roller, name, faces, power, styles, startsAt, dice, modifier, total, edges, banes, source }, ...old]
          .sort((a, b) => b.startsAt - a.startsAt)
          .slice(0, 100);
      });
      if ((roll as DeliveredRoll).historical && !timing) return;
      const time = performance.now() + (clockRef.current?.offset ?? 0);
      void record({
        key: roomKey,
        credential,
        roller: roll.roller,
        sample: {
          viewer,
          roll: roll.id,
          uncertainty,
          ...(timing ?? { firstFrame: time, revealFrame: time, frames: 0, maxFrameGap: 0 }),
        },
      }).catch(e => setError(displayError(e, credential)));
    },
    [record, viewer, credential],
  );
  const joinedForDelivery = room?.participants.some(member => member.id === viewer);
  useEffect(() => {
    if (!joinedForDelivery || !historyReady || !clockReady) return;
    const controller = createController({ key: roomKey, identity, profile: profileRef.current, clock: () => performance.now(), transport: {
      call: (method, args) => method === 'diceDemo:clock' || method === 'diceDemo:sampleFaces' ? client.action(makeFunctionReference<'action'>(method), args) : ['diceDemoV2:view', 'diceDemoV2:track', 'diceDemoV2:events'].includes(method) ? client.query(makeFunctionReference<'query'>(method), args) : client.mutation(makeFunctionReference<'mutation'>(method), args),
      watch: (method, args, next, fail) => { const watch = client.watchQuery(makeFunctionReference<'query'>(method), args); const stop = watch.onUpdate(() => { try { const value = watch.localQueryResult(); if (value !== undefined) next(value); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); } }); const value = watch.localQueryResult(); if (value !== undefined) next(value); return stop; },
    }});
    controller.on('available', roll => report(roll, controller.clockEstimate().uncertainty));
    controller.on('error', error => setError(displayError(error, credential)));
    void controller.observe().catch(error => setError(displayError(error, credential)));
    return () => { void controller.dispose(); };
  }, [joinedForDelivery, historyReady, clockReady, roomKey, viewer, credential, client, report]);
  useEffect(() => {
    let cancelled = false;
    let current: Tray | null = null;
    let currentPlanner: ReturnType<typeof createThrowPlanner> | null = null;
    setGraphics(false);
    setFallback(false);
    if (preferences.hidden) {
      setPhysicsReady(true);
      return;
    }
    void Promise.all([
      // Fonts can download while the larger renderer modules are still loading.
      import('../dice-demo/fonts').then(fonts => fonts.loadDiceFonts()),
      import('./renderer'),
      import('../dice-demo/prepare-throw'),
      import('./resting-scene'),
    ])
      .then(([failed, graphicsModule, physics, resting]) => {
        if (cancelled) return;
        currentPlanner = physics.createThrowPlanner();
        planner.current = currentPlanner;
        makeRestingScene.current = resting.restingScene;
        void currentPlanner
          .warmThrows({ scale: 0.65, obstacles: [] })
          .then(() => {
            if (!cancelled) setPhysicsReady(true);
          })
          .catch(() => {
            if (!cancelled) setPhysicsReady(true);
          });
        if (failed.length) {
          setError(
            'Dice fonts could not load. Rolls remain available as text; reload to retry 3D.',
          );
          setFallback(true);
          return;
        }
        setFontsReady(true);
        try {
          current = graphicsModule.createRoomTray(
            host.current!,
            () => {
              setGraphics(false);
              setFallback(true);
            },
            (roll, timing, uncertainty) => report(roll, uncertainty, timing),
            { ...preferencesRef.current, transparent: options.trayHistory },
          );
          tray.current = current;
          setGraphics(true);
        } catch {
          setFallback(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });
    return () => {
      cancelled = true;
      current?.dispose();
      currentPlanner?.dispose();
      if (tray.current === current) tray.current = null;
      if (planner.current === currentPlanner) planner.current = null;
      makeRestingScene.current = null;
    };
  }, [report, preferences.hidden, options.trayHistory]);
  useEffect(() => {
    tray.current?.setPreferences(preferences);
  }, [preferences.motion, preferences.highContrast, graphics]);
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
    if (
      !clock ||
      !physicsReady ||
      preferences.hidden ||
      !planner.current ||
      !makeRestingScene.current
    )
      return;
    const scene = makeRestingScene.current(
      tracks.current.values(),
      members,
      viewer,
      now + clock.offset,
    );
    void planner.current.warmThrows({ ...scene, dice: diceConfig }).catch(() => {
      /* Throw preparation retries on click. */
    });
  }, [members, viewer, now, clock, physicsReady, diceConfig, preferences.hidden]);
  const hasDice =
    !clearing &&
    !!clock &&
    Object.values(trayRolls).some(roll => {
      return (
        members.some(member => member.id === roll.roller) && now + clock.offset >= roll.startsAt && trayOpacity(roll, now + clock.offset) > 0
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
  const ownParticipant = room?.participants.find(p => p.id === viewer);
  const joined = !!ownParticipant;
  useEffect(() => {
    if (options.popoutActive || !joined || profile === initial || !profile.name.trim()) return;
    const timer = setTimeout(() => {
      if (changingTableRef.current) return;
      const request = customize({
        key: roomKey,
        viewer,
        credential,
        name: profile.name,
        style: profile.style,
      });
      customizePending.current = request;
      void request.catch(e => { if (!changingTableRef.current) setError(displayError(e, credential)); })
        .finally(() => { if (customizePending.current === request) customizePending.current = null; });
    }, 300);
    return () => clearTimeout(timer);
  }, [profile, initial, joined, viewer, credential, customize, options.popoutActive]);
  const [rollLockUntil, setRollLockUntil] = useState(0);
  const rollLock = useRef(0);
  useEffect(() => {
    const deadline = (options.controls?.readyAt ?? 0) - performance.timeOrigin;
    if (deadline > rollLock.current) { rollLock.current = deadline; setRollLockUntil(deadline); setNow(performance.now()); }
  }, [options.controls?.readyAt]);
  useEffect(() => {
    const incoming = incomingControls.current;
    // Let an incoming snapshot settle before notifying the host of local state.
    if (incoming && (incoming.diceCount !== diceCount || incoming.bonusD4 !== bonusD4 || incoming.edges !== edges || incoming.banes !== banes)) return;
    incomingControls.current = undefined;
    options.onControls?.({diceCount, bonusD4, edges, banes, readyAt:rollLockUntil ? Math.round(performance.timeOrigin + rollLockUntil) : 0});
  }, [diceCount, bonusD4, edges, banes, rollLockUntil, options.controls]);
  const submissions = useRef(0);
  const rollQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const delay = rollLockUntil - performance.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => setNow(performance.now()), Math.ceil(delay));
    return () => clearTimeout(timer);
  }, [rollLockUntil]);
  const busy =
    changingTable || now < rollLockUntil;
  async function changeTable(next: string) {
    if (changingTableRef.current) return;
    if (next === roomKey || next.toUpperCase() === room?.code) {
      socialDialog.current?.close();
      return;
    }
    changingTableRef.current = true;
    setChangingTable(true);
    setJoinError('');
    try {
      if (next.length === 8) {
        const destination = await client.query(demoV2.view, { key: next });
        if (!destination.code || destination.expired) throw new Error('That table is unavailable or has expired.');
      }
      // Finish any already-started heartbeat before removing this membership.
      await heartbeatPending.current?.catch(() => {});
      await customizePending.current?.catch(() => {});
      if (room?.code && !room.expired) await leave({ key: roomKey, viewer, credential });
      socialDialog.current?.close();
      options.onJoin?.(next);
    } catch (error) {
      changingTableRef.current = false;
      setChangingTable(false);
      setJoinError(displayError(error, credential));
    }
  }
  async function clearDice() {
    sound.current?.cancel();
    setClearing(true);
    setError('');
    for (const owner of new Set([...tracks.current.values()].map(roll => roll.roller))) tray.current?.clear(owner);
    try {
      await clearSharedTray({ key: roomKey, viewer, credential });
    } catch (e) {
      if (clockRef.current)
        for (const roll of tracks.current.values()) tray.current?.play(roll, clockRef.current);
      setError(displayError(e, credential));
    } finally {
      setClearing(false);
    }
  }
  function perform() {
    const clickedAt = performance.now();
    if (clickedAt < rollLock.current || changingTableRef.current) return;
    rollLock.current = clickedAt + rollCooldownMs;
    setRollLockUntil(rollLock.current);
    setNow(clickedAt);
    setChoosingDice(false);
    unlockSound();
    submissions.current++;
    setPending(true);
    // Capture this tap's configuration; serialize authority requests while the
    // original recorded dice paths continue playing independently in the tray.
    rollQueue.current = rollQueue.current.catch(() => {}).then(submit).finally(() => {
      submissions.current--;
      setPending(submissions.current > 0);
    });
  }
  async function submit() {
    setError('');
    const retry = retryThrow.current;
    const request: NonNullable<typeof retryThrow.current> = retry &&
      JSON.stringify(retry.dice) === JSON.stringify(diceConfig) && retry.edges === edges && retry.banes === banes ? retry : {
      id: crypto.randomUUID(),
      dice: diceConfig,
      edges,
      banes,
    };
    retryThrow.current = request;
    try {
      await customize({
        key: roomKey,
        viewer,
        credential,
        name: profile.name,
        style: profile.style,
      });
      if (!request.faces)
        request.faces = await sampleFaces({
          key: roomKey,
          viewer,
          credential,
          id: request.id,
          dice: request.dice,
        });
      if (
        !request.motion &&
        // Read the current tray after the server requests, not the graphics state
        // captured when Roll was clicked during startup.
        tray.current &&
        !preferences.hidden &&
        planner.current &&
        makeRestingScene.current
      ) {
        const scene = makeRestingScene.current(
          tracks.current.values(),
          members,
          viewer,
          performance.now() + (clockRef.current?.offset ?? 0),
        );
        try {
          request.motion = (
            await planner.current.prepareThrow(request.faces, { ...scene, dice: request.dice })
          ).motion;
        } catch {
          /* Logical acceptance does not require cosmetic physics. */
        }
      }
      await throwDice({
        key: roomKey,
        viewer,
        credential,
        id: request.id,
        dice: request.dice,
        faces: request.faces,
        ...(request.motion ? { motion: packMotion(request.motion) } : {}),
        edges: request.edges,
        banes: request.banes,
      });
      retryThrow.current = null;
      setEdges(current => current === edges ? 0 : current);
      setBanes(current => current === banes ? 0 : current);
    } catch (e) {
      setError(displayError(e, credential));
      if (['REQUEST_EXPIRED','REQUEST_CONFLICT','CONFLICT','INVALID','INVALID_REQUEST','ROOM_EXPIRED','UNAUTHORIZED'].includes(redactError(e, [credential]).code))
        retryThrow.current = null;
    }
  }
  useEffect(() => {
    retryThrow.current = null;
  }, [diceConfig, edges, banes]);
  function edit(patch: Partial<Style>) {
    setProfile(old => ({ ...old, style: { ...old.style, ...patch } }));
  }
  return (
    <main onPointerDown={unlockSound} onPointerUp={unlockSound} onKeyDown={unlockSound} className={`lab v2${preferences.highContrast ? ' high-contrast' : ''}`}>
      <div className="roll-area">
        <header className="lab-header">
          <h1 className="power-title"><img className="click-clacks-logo" src={clickClacksLogo} alt="Click Clacks" width="640" height="280" /></h1>
          {options.onPopout && <button type="button" className="customize-trigger"
            aria-label={options.popoutActive ? 'Focus dice tray' : 'Pop out dice tray'}
            title={options.popoutActive ? 'Focus dice tray' : 'Pop out dice tray'}
            aria-pressed={options.popoutActive === true} onClick={options.onPopout}>
            <PictureInPicture2 aria-hidden />
          </button>}
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
            {options.trayHistory && <TrayHistory rolls={rollLog} viewer={viewer} motion={preferences.motion} />}
            <div className="canvas-host" ref={host} />
            <div className="stage-label">
              <span className="dot" />
              {visible && (!clockReady || !connection.isWebSocketConnected)
                ? connection.hasEverConnected
                  ? 'Reconnecting…'
                  : 'Connecting…'
                : `${members.length} / 8 participants`}
            </div>
            <button type="button" className="sound-toggle"
              aria-label="Dice sounds" aria-pressed={preferences.sound === true}
              title={preferences.sound ? 'Mute dice sounds' : 'Enable dice sounds'}
              onClick={() => {
                const enabled = !preferences.sound;
                sound.current?.setEnabled(enabled && !options.popoutActive);
                changePreferences({ ...preferences, sound: enabled });
                if (enabled) unlockSound();
              }}>
              {preferences.sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
            </button>
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
            {(fallback || preferences.hidden) && (
              <p className="fallback">
                {preferences.hidden
                  ? '3D dice hidden · shared text results still work.'
                  : '3D unavailable · shared text results still work.'}
              </p>
            )}
          </section>
          <section className="controls">
            <div className="power-modifiers" role="group" aria-label="Modifiers for next roll">
              {selectedDice !== 'power' && selectedDice !== 4 && (
                <button type="button" className="bonus-d4-toggle" aria-pressed={bonusD4}
                  disabled={clearing || busy} onClick={() => setBonusD4(value => !value)}>+1d4</button>
              )}
              {[
                {
                  name: 'edge',
                  label: selectedDice === 'power' ? 'Edge' : `+${genericModifierValue(edges as 0 | 1 | 2)}`,
                  icon: selectedDice === 'power' ? '↑' : '',
                  count: edges,
                  set: setEdges,
                },
                {
                  name: 'bane',
                  label: selectedDice === 'power' ? 'Bane' : `−${genericModifierValue(banes as 0 | 1 | 2)}`,
                  icon: selectedDice === 'power' ? '↓' : '',
                  count: banes,
                  set: setBanes,
                },
              ].map(control => (
                <div className="modifier-buttons" key={control.name}>
                  <button
                    type="button"
                    data-roll-modifier={control.name}
                    aria-label={
                      selectedDice === 'power'
                        ? `${control.label}: ${control.count} of 2. Add ${control.name}`
                        : `${control.name === 'edge' ? 'Positive' : 'Negative'} modifier: ${control.label}. Cycle to ${control.name === 'edge' ? '+' : '−'}${genericModifierValue(((control.count + 1) % 3) as 0 | 1 | 2)}`
                    }
                    disabled={clearing || busy || (selectedDice === 'power' && control.count === 2)}
                    onClick={() => control.set(count => selectedDice === 'power' ? Math.min(2, count + 1) : (count + 1) % 3)}
                  >
                    {selectedDice === 'power' && <span aria-hidden>{control.icon}</span>} {control.label}
                    {selectedDice === 'power' && <span className="modifier-count" aria-hidden>
                      {control.count}
                    </span>}
                  </button>
                  {selectedDice === 'power' && control.count > 0 && (
                    <button
                      type="button"
                      data-roll-modifier={control.name}
                      aria-label={
                        selectedDice === 'power'
                          ? `Remove ${control.name}`
                          : `Remove ${control.name === 'edge' ? '+2' : '−2'} modifier`
                      }
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
            {selectedDice !== 'power' && (
              <div className="dice-quantity" role="group" aria-label="Dice count">
                <button
                  type="button"
                  aria-label="Remove die"
                  disabled={clearing || busy || diceCount === 1}
                  onClick={() => setDiceCount(count => Math.max(1, count - 1))}
                >
                  −
                </button>
                <output aria-live="polite" aria-label="Number of dice">
                  {diceCount}
                </output>
                <button
                  type="button"
                  aria-label="Add die"
                  disabled={clearing || busy || diceCount === 20}
                  onClick={() => setDiceCount(count => Math.min(20, count + 1))}
                >
                  +
                </button>
              </div>
            )}
            <div
              className="roll-button-group"
              ref={rollControls}
              style={{ backgroundColor: profile.style.color, color: rollInk }}
            >
              <button
                ref={dicePicker}
                type="button"
                className="dice-selection-trigger"
                aria-label="Select dice"
                data-pointer-focus={pointerPicker || undefined}
                onPointerDown={() => setPointerPicker(true)}
                onKeyDown={() => setPointerPicker(false)}
                title={diceChoices.find(choice => choice.value === selectedDice)!.label}
                aria-haspopup="menu"
                aria-expanded={choosingDice}
                aria-controls={`${instanceId}-dice-selection-menu`}
                disabled={clearing || busy}
                onClick={() => setChoosingDice(open => !open)}
              >
                <RollDieIcon dice={selectedDice} />
              </button>
              <button
                className="primary"
                aria-label={
                  !ready
                    ? 'Roll (connecting)'
                    : busy
                      ? pending ? 'Roll (preparing)' : 'Roll (cooldown)'
                      : 'Roll'
                }
                aria-busy={pending || clearing}
                disabled={clearing || !ready || !ownParticipant?.ready || busy || room?.expired}
                onClick={() => void perform()}
              >
                Roll
              </button>
              {choosingDice && (
                <div
                  id={`${instanceId}-dice-selection-menu`}
                  ref={diceMenu}
                  popover="manual"
                  className="dice-selection-menu"
                  role="menu"
                  aria-label="Dice to roll"
                  onPointerDown={() => setPointerPicker(true)}
                  onKeyDown={event => {
                    setPointerPicker(false);
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setChoosingDice(false);
                      dicePicker.current?.focus();
                      return;
                    }
                    const choices = [
                        ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                          '[role="menuitemradio"]',
                        ),
                      ],
                      index = choices.indexOf(document.activeElement as HTMLButtonElement);
                    const next =
                      event.key === 'ArrowDown'
                        ? (index + 1) % choices.length
                        : event.key === 'ArrowUp'
                          ? (index + choices.length - 1) % choices.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? choices.length - 1
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      choices[next]?.focus();
                    }
                  }}
                >
                  {diceChoices.map(choice => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedDice === choice.value}
                      key={choice.value}
                      onClick={() => {
                        changePreferences({ ...preferencesRef.current, selectedDice: choice.value });
                        if (choice.value === 'power' || choice.value === 4) setBonusD4(false);
                        setChoosingDice(false);
                        dicePicker.current?.focus();
                      }}
                    >
                      <RollDieIcon dice={choice.value} />
                      <span>{choice.label}</span>
                      {selectedDice === choice.value && <Check aria-hidden />}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          hasTrack={hasTrack}
        />
      ))}
      <RollLog motion={preferences.motion}>
        {rollLog.length ? (
          rollLog.map(roll => (
            <div
              className="roll-log-row"
              data-log-key={`${roll.roller}:${roll.id}`}
              key={`${roll.roller}:${roll.id}`}
            >
              <RollEntry
                roll={roll}
                viewer={viewer}
                avatarStyle={roll.roller === viewer ? profile.style : room?.participants.find(member => member.id === roll.roller)?.style}
              />
            </div>
          ))
        ) : (
          <p className="empty-log">Throw dice to start the log.</p>
        )}

      </RollLog>
      {createPortal(<span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>, (customizing ? customization.current : socializing ? socialDialog.current : null) ?? host.current?.parentElement ?? document.body)}
      {error && !customizing && !socializing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {options.popoutError && <p className="error" role="alert">{options.popoutError}</p>}
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
        aria-labelledby={`${instanceId}-join-table-title`}
      >
        <header>
          <h2 id={`${instanceId}-join-table-title`}>Table</h2>
          <button
            type="button"
            aria-label="Close social menu"
            onClick={() => socialDialog.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        <section className="connected-players" aria-labelledby={`${instanceId}-connected-players-title`}>
          <h3 id={`${instanceId}-connected-players-title`}>
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
            <label htmlFor={`${instanceId}-menu-table-code`}>Table code</label>
            <div className="share-field share-code">
              <input
                id={`${instanceId}-menu-table-code`}
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
            <label htmlFor={`${instanceId}-menu-table-link`}>Table link</label>
            <div className="share-field">
              <input
                id={`${instanceId}-menu-table-link`}
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
            void changeTable(key);
          }}
        >
          <label htmlFor={`${instanceId}-join-table-input`}>Join a table</label>
          <div className="join-field">
            <input
              id={`${instanceId}-join-table-input`}
              aria-label="Room code or link"
              placeholder="Room code or link"
              value={joinInput}
              disabled={changingTable}
              onChange={event => {
                setJoinInput(event.target.value);
                setJoinError('');
              }}
            />
            <button type="submit" className="primary" disabled={pending || changingTable || !joinInput.trim()}>
              Join
            </button>
          </div>
          {joinError && (
            <p className="error" role="alert">
              {joinError}
            </p>
          )}
        </form>
        <button type="button" className="leave-table" disabled={!room?.code || changingTable || pending}
          onClick={() => void changeTable(crypto.randomUUID())}>
          {changingTable ? 'Leaving table…' : 'Leave table'}
        </button>
        <p className="leave-table-note">Leave this table and continue rolling on your own.</p>
      </dialog>
      <dialog
        ref={customization}
        onPointerDown={backdropDown}
        onPointerUp={backdropUp}
        onPointerCancel={() => {
          backdropPointer.current = null;
        }}
        className="dice-customization profile-dialog"
        aria-labelledby={`${instanceId}-dice-customization-title`}
        onClose={() => setCustomizing(false)}
      >
        <header>
          <h2 id={`${instanceId}-dice-customization-title`}>Customize dice</h2>
          <button
            type="button"
            aria-label="Close customization"
            onClick={() => customization.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        {customizing && fontsReady && !preferences.hidden && (
          <DicePreview style={profile.style} preferences={preferences} />
        )}
        {customizing && !fontsReady && !preferences.hidden && (
          <p role="status">{fallback ? '3D font preview unavailable.' : 'Loading dice fonts…'}</p>
        )}
        <fieldset disabled={busy} className="profile-fields">
          <DiceDesignControls disabled={busy} active={customizing} style={profile.style} onChange={edit} />
        </fieldset>
        <AccessibilityControls preferences={preferences} onChange={changePreferences} />
        {customizing && error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </dialog>
    </main>
  );
}
