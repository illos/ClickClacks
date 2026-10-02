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
import { Check, Copy, X, Users, Eraser, Volume2, VolumeX, PictureInPicture2, Settings, Link as LinkIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import clickClacksLogo from '../branding/click-clacks.svg';
import clickClacksLightLogo from '../branding/click-clacks-light.svg';
import { useColorTheme } from './theme';
import { ThemeOptions } from './theme-controls';
import { createController, reactTransport, type Controller, type Identity, type Profile, type DeliveredRoll } from '../../lib/client';
import { displayError, redactError } from '../../lib/errors';
import { dicePoolCount, genericModifierValue, rollCooldownMs } from '../../shared/dice';
import { describeRoll, rollDiceNotation, rollNaturalTotal, rollFacesText } from '../../lib/format';
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
import { trayDieScale } from './dice-size';
import { type Style, type Motion, type DiceConfig } from '../dice-demo/model';
import type { RollerPreferences } from '../../shared/preferences';
import type { CachedRoll } from '../../shared/room';
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
import { DiceAvatar, DicePreview, RollEntry, TrayHistory, type LogRoll } from './roll-presentation';
import { isBackdropPointer, useMenuScrollLock } from './dialog-lifecycle';
import { historyDeadline, useDeadlineClock } from './history-lifecycle';
import { createPlaybackReports } from './playback-reports';
import { ErrorAlert } from './error-alert';
import { scrubDiagnosticText, type BugContext } from '../../shared/bug-report';
export type RollControls = { diceCount: number; bonusD4: boolean; edges: number; banes: number; readyAt?: number };
export type ClickClacksOptions = {
  client: ConvexReactClient;
  roomKey: string;
  identity?: Identity;
  profile?: Profile;
  nameProvider?: () => string | Promise<string>;
  preferences?: RollerPreferences;
  onPreferences?: (preferences: RollerPreferences) => void;
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
  /** Host-owned private reporting; never sends data from the reusable component itself. */
  onReportBug?: (context: BugContext) => void;
};
const RollerContext = createContext<ClickClacksOptions | null>(null);
function useRoller() { const value = useContext(RollerContext); if (!value) throw new Error('Mount inside ClickClacks.'); return value; }
export function ClickClacks(options: ClickClacksOptions) {
  const [activeRoom, setActiveRoom] = useState(options.roomKey);
  useEffect(() => setActiveRoom(options.roomKey), [options.roomKey]);
  const [activeProfile, setActiveProfile] = useState(options.profile);
  const [activePreferences, setActivePreferences] = useState(options.preferences);
  useEffect(() => setActiveProfile(options.profile), [options.profile]);
  useEffect(() => setActivePreferences(options.preferences), [options.preferences]);
  const value = { ...options, roomKey: activeRoom, profile: activeProfile, preferences: activePreferences,
    onProfile: (profile: Profile) => { setActiveProfile(profile); options.onProfile?.(profile); },
    onPreferences: (preferences: RollerPreferences) => { setActivePreferences(preferences); options.onPreferences?.(preferences); },
    onJoin: (key: string) => { setActiveRoom(key); options.onJoin?.(key); } };
  return <div className="clickclacks powerroller"><ConvexProvider client={options.client}><RollerContext.Provider value={value}><DiceRoom key={activeRoom} /></RollerContext.Provider></ConvexProvider></div>;
}
type Clock = { offset: number; uncertainty: number };
type Tray = ReturnType<typeof createRoomTray>;


type SelectedDice = NonNullable<RollerPreferences['selectedDice']>;
const diceChoices: ReadonlyArray<{ value: SelectedDice; label: string }> = [
  { value: 'power', label: 'Power roll (2d10)' },
  ...([20, 12, 10, 8, 6, 4] as const).map(value => ({ value, label: `d${value}` })),
  { value: 'percentile', label: 'd100 (percentile)' },
];
function RollDieIcon({ dice }: { dice: SelectedDice }) {
  const overlapMask = useId();
  if (dice === 'power' || dice === 'percentile') return (
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
          <text x="25" y="12" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontSize="8" fontWeight="700">{dice === 'percentile' ? '0' : '10'}</text>
        </g>
      </g>
      <g transform="rotate(-12 12 17)">
        <path d="M12 7 21 12v10l-9 5-9-5V12Z" />
        <text x="12" y="20.5" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontSize="10" fontWeight="700">{dice === 'percentile' ? '00' : '10'}</text>
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
  const [preferences, setSavedPreferences] = useState<RollerPreferences>(() => options.preferences ?? { motion: 'device', hidden: false, highContrast: false, announcements: 'all' });
  useEffect(() => { if (options.preferences) setSavedPreferences(options.preferences); }, [options.preferences]);
  const colorTheme = useColorTheme(preferences.theme);
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
  function changePreferences(next: RollerPreferences) {
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
  const customizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [configuring, setConfiguring] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const settingsTabs = ['sharing', 'dice', 'settings'] as const;
  const [settingsTab, setSettingsTab] = useState<(typeof settingsTabs)[number]>('sharing');
  function selectSettingsTab(tab: (typeof settingsTabs)[number]) {
    setSettingsTab(tab);
    setCustomizing(tab === 'dice');
    setConfiguring(tab === 'settings');
  }
  useMenuScrollLock(customizing || socializing || configuring);
  const [profile, setProfile] = useState(initial);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    if (options.profile && JSON.stringify(options.profile) !== JSON.stringify(profileRef.current)) {
      profileRef.current = options.profile;
      setProfile(options.profile);
    }
  }, [options.profile]);
  // Notify the host only for local intent. Receiving a host/storage/PiP snapshot
  // must never save it again: queued snapshots can otherwise circulate forever.
  function changeProfile(next: Profile) {
    profileRef.current = next;
    setProfile(next);
    options.onProfile?.(next);
  }
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
        : selectedDice === 'percentile'
          ? { kind: 'percentile' as const, sides: 10 as const, count: 2, ...(bonusD4 ? { bonusD4: true } : {}) }
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
      setRollLog(current => [...current, ...history.filter(roll => historyDeadline(roll) > Date.now() && !current.some(value => value.id === roll.id && value.roller === roll.roller))].sort((a,b) => b.startsAt-a.startsAt).slice(0,100));
    }).catch(() => {}).finally(() => { if (active) setHistoryReady(true); });
    return () => { active = false; };
  }, [room?.code]);
  const tracks = useRef(new Map<string, ParticipantRoll>());
  const [trayRolls, setTrayRolls] = useState<
    Record<string, Pick<ParticipantRoll, 'id' | 'roller' | 'startsAt' | 'duration'> & { motionReady: boolean }>
  >({});
  const rememberTrack = useCallback((owner: string, roll: ParticipantRoll | null) => {
    const liveClock = clockRef.current;
    if (roll && liveClock && trayOpacity(roll, performance.now() + liveClock.offset) === 0) return;
    const key = roll ? `${owner}:${roll.id}` : null;
    const retainedMotion = key ? tracks.current.get(key)?.motion : undefined;
    if (roll && !roll.motion && retainedMotion) roll = { ...roll, motion: retainedMotion };
    if (roll) tracks.current.set(key!, roll);
    else for (const [id, value] of tracks.current) if (value.roller === owner) tracks.current.delete(id);
    setTrayRolls(old => {
      if (key && old[key]?.id === roll?.id && old[key]?.motionReady === Boolean(roll?.motion)) return old;
      const next = { ...old };
      if (roll) next[key!] = { id: roll.id, roller: owner, startsAt: roll.startsAt, duration: roll.duration, motionReady: Boolean(roll.motion) };
      else for (const [id, value] of Object.entries(next)) if (value.roller === owner) delete next[id];
      return next;
    });
  }, []);
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
  const ping = useAction(demo.clock);
  const chooseName = useMutation(demoV2.randomName);
  const clearSharedTray = useMutation(demoV2.clearTray);
  const leave = useMutation(demoV2.leave);
  const join = useMutation(demoV2.join),
    customize = useMutation(demoV2.customize),
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
        const current = profileRef.current;
        changeProfile({ ...current, name: current.name === 'Player' ? name : current.name });
        setNameReady(true);
      })
      .catch(e => {
        if (!cancelled) {
          setError(displayError(e, credential));
          if (options.nameProvider) { changeProfile(profileRef.current); setNameReady(true); }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chooseName, nameReady]);
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
      setShareError(kind === 'code' ? 'Select and copy the table code above.' : 'Could not copy the link. Try again or share the table code.');
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
    return () => {
      document.removeEventListener('visibilitychange', change);
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
  const receiptReports = useMemo(() => createPlaybackReports((rollKey, timing, uncertainty) => {
    const split = rollKey.indexOf(':');
    void record({ key: roomKey, credential, roller: rollKey.slice(0, split), sample: {
      viewer, roll: rollKey.slice(split + 1), uncertainty, ...timing,
    } }).catch(error => setError(displayError(error, credential)));
  }), [record, roomKey, credential, viewer]);
  useEffect(() => () => receiptReports.dispose(), [receiptReports]);
  const report = useCallback(
    (
      roll: ParticipantRoll,
      uncertainty: number,
      timing?: { firstFrame: number; revealFrame: number; frames: number; maxFrameGap: number },
    ) => {
      if (historyDeadline(roll) <= Date.now()) return;
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
        return [{ id, roller, name, faces, power, styles, startsAt, dice, modifier, total, edges, banes, source, historyExpiresAt: historyDeadline(roll) }, ...old]
          .sort((a, b) => b.startsAt - a.startsAt)
          .slice(0, 100);
      });
      if ((roll as DeliveredRoll).historical && !timing) return;
      const time = performance.now() + (clockRef.current?.offset ?? 0);
      receiptReports.report(rollKey, timing ?? { firstFrame: time, revealFrame: time, frames: 0, maxFrameGap: 0 }, uncertainty);
    },
    [receiptReports, viewer],
  );
  const delivery = useRef<Controller | null>(null);
  const [deliveryReady, setDeliveryReady] = useState(false);
  const joinedForDelivery = room?.participants.some(member => member.id === viewer);
  useEffect(() => {
    if (!joinedForDelivery || !historyReady || !clockReady) return;
    let active = true;
    const controller = createController({ key: roomKey, identity, profile: profileRef.current,
      clock: () => performance.now(), clockEstimate: () => clockRef.current ?? { offset: 0, uncertainty: 10000 },
      transport: reactTransport(client),
    });
    delivery.current = controller;
    controller.on('track', ({ owner, roll, activeRolls }) => {
      if (!active) return;
      if (!roll) { rememberTrack(owner, null); tray.current?.clear(owner); }
      else for (const current of activeRolls ?? [roll]) rememberTrack(owner, current);
    });
    controller.on('available', roll => report(roll, controller.clockEstimate().uncertainty));
    controller.on('error', error => setError(displayError(error, credential)));
    void controller.observe().then(() => { if (active) setDeliveryReady(true); })
      .catch(error => { if (active) setError(displayError(error, credential)); });
    return () => {
      active = false;
      setDeliveryReady(false);
      if (delivery.current === controller) delivery.current = null;
      void controller.dispose();
    };
  }, [joinedForDelivery, historyReady, clockReady, roomKey, viewer, credential, client, report, rememberTrack]);
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
          .warmThrows({ scale: trayDieScale(), obstacles: [] })
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
            { ...preferencesRef.current, colorTheme, transparent: options.trayHistory },
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
    tray.current?.setPreferences({...preferences, colorTheme});
  }, [preferences.motion, preferences.highContrast, colorTheme, graphics]);
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
      dicePoolCount(diceConfig),
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
      if (customizeTimer.current === timer) customizeTimer.current = null;
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
    customizeTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (customizeTimer.current === timer) customizeTimer.current = null;
    };
  }, [profile, initial, joined, viewer, credential, customize, options.popoutActive]);
  const [rollLockUntil, setRollLockUntil] = useState(0);
  const rollLock = useRef(0);
  const serverOffset = clock?.offset ?? Date.now() - performance.now();
  useDeadlineClock([
    rollLockUntil,
    ...(room?.participants ?? []).map(member => member.seenAt + 30000 - serverOffset),
    ...Object.values(trayRolls).flatMap(roll => [roll.startsAt, roll.startsAt + roll.duration, roll.startsAt + roll.duration + 5600].map(time => time - serverOffset)),
    ...rollLog.map(roll => historyDeadline(roll) - serverOffset),
  ], now, setNow);
  useEffect(() => {
    const cutoff = now + serverOffset;
    if (!rollLog.some(roll => historyDeadline(roll) <= cutoff)) return;
    setRollLog(current => current.filter(roll => historyDeadline(roll) > cutoff));
    // The built-in indexed read also prunes expired disk rows. Sweep only when
    // visible entries actually expire; never restore the returned rows or renew
    // their deadlines, and keep storage effects outside the React state updater.
    const loadHistory = optionsRef.current.loadHistory;
    const code = codeRef.current;
    if (loadHistory && code) void Promise.resolve().then(() => loadHistory(code)).catch(() => {});
  }, [now, serverOffset, rollLog]);
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
      const controller = delivery.current;
      if (!controller) throw new Error('The table is reconnecting. Try again shortly.');
      const matches = (known: Profile | undefined) => !!known &&
        known.name === profile.name && known.style.color === profile.style.color &&
        known.style.ink === profile.style.ink && known.style.pattern === profile.style.pattern &&
        known.style.font === profile.style.font;
      // A matching authoritative profile needs no save on an ordinary Roll tap.
      // Pending edits or an older queued tap retain the explicit profile write.
      if (customizeTimer.current || customizePending.current ||
          !matches(ownParticipant) || !matches(profileRef.current))
        await controller.profile({ name: profile.name, style: profile.style });
      await controller.roll(request, async (faces, dice) => {
        // Read current graphics after authority sampling; initial loading and a
        // missing cosmetic worker must never change the accepted logical result.
        if (!tray.current || preferences.hidden || !planner.current || !makeRestingScene.current) return undefined;
        const scene = makeRestingScene.current(tracks.current.values(), members, viewer,
          performance.now() + (clockRef.current?.offset ?? 0), faces.length);
        return (await planner.current.prepareThrow(faces, { ...scene, dice })).motion;
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
    const current = profileRef.current;
    changeProfile({ ...current, style: { ...current.style, ...patch } });
  }
  function reportBug() {
    if (!options.onReportBug) return;
    const secrets = [credential, viewer, roomKey, room?.code ?? '', profile.name,
      ...(room?.participants ?? []).flatMap(member => [member.id, member.name])];
    const context: BugContext = {
      surface: error ? 'error' : configuring ? 'settings' : socializing ? 'table-menu' : customizing ? 'customization' : options.trayHistory ? 'tray' : 'roller',
      selectedDice, diceCount, bonusD4, edges, banes, joined, expired: room?.expired, participants: room?.participants.length ?? 0,
      connected: connection.isWebSocketConnected, ready, pending, clearing, historyReady,
      clockOffset: clock?.offset, clockUncertainty: clock?.uncertainty, webgl: graphics && !fallback,
      theme: preferences.theme, motion: preferences.motion, sound: preferences.sound, highContrast: preferences.highContrast,
      ...profile.style, error: scrubDiagnosticText(error || presenceError || joinError, secrets),
      recentRolls: rollLog.slice(0,5).map(roll => ({ faces: [...roll.faces], total: roll.total, modifier: roll.modifier })),
    };
    // Snapshot before closing any existing dialog.
    options.onReportBug(context);
    socialDialog.current?.close(); customization.current?.close(); settingsDialog.current?.close();
  }
  const customizationContent = <>
    {customizing && fontsReady && !preferences.hidden && (
      <DicePreview style={profile.style} preferences={preferences} />
    )}
    {customizing && !fontsReady && !preferences.hidden && (
      <p role="status">{fallback ? '3D font preview unavailable.' : 'Loading dice fonts…'}</p>
    )}
    <fieldset disabled={busy} className="profile-fields">
      <DiceDesignControls disabled={busy} active={customizing} style={profile.style} onChange={edit} />
    </fieldset>

    {customizing && error && <ErrorAlert message={error} />}
  </>;
  const settingsContent = <>
    <ThemeOptions value={preferences.theme} onChange={theme => changePreferences({...preferences, theme})} />
    <AccessibilityControls preferences={preferences} onChange={changePreferences} />
    {options.onReportBug && <button type="button" className="leave-table" onClick={reportBug}>Report a bug</button>}
    <nav className="settings-links" aria-label="Click Clacks links">
      <a href="https://clickclacks.app/" target="_blank" rel="noopener noreferrer"
        aria-label="Website (opens in a new tab)">Website <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/illos/powerroller" target="_blank" rel="noopener noreferrer"
        aria-label="GitHub (opens in a new tab)">GitHub <span aria-hidden="true">↗</span></a>
    </nav>
    {configuring && error && <ErrorAlert message={error} />}
  </>;
  return (
    <main onPointerDown={unlockSound} onPointerUp={unlockSound} onKeyDown={unlockSound} data-theme={colorTheme} className={`lab v2${preferences.highContrast ? ' high-contrast' : ''}`}>
      <div className="roll-area">
        <header className="lab-header">
          <h1 className="power-title"><img className="click-clacks-logo" src={colorTheme === 'light' ? clickClacksLightLogo : clickClacksLogo} alt="Click Clacks" width="640" height="280" /></h1>
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
          <button type="button" className="customize-trigger" aria-label="Open settings"
            title="Settings" aria-haspopup="dialog" onClick={() => {
              settingsDialog.current?.showModal();
              setConfiguring(true);
            }}><Settings aria-hidden /></button>
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
            {options.trayHistory && <button type="button" className="mini-settings-trigger"
              aria-label="Open tray settings" title="Tray settings" aria-haspopup="dialog"
              onClick={() => {
                setJoinError('');
                setShareError('');
                selectSettingsTab('sharing');
                socialDialog.current?.showModal();
                setSocializing(true);
              }}><Settings aria-hidden /></button>}
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
            {selectedDice !== 'power' && selectedDice !== 'percentile' && (
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
                disabled={clearing || !ready || !deliveryReady || !ownParticipant?.ready || busy || room?.expired}
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
      <RollLog motion={preferences.motion} revision={rollLog.map(roll => `${roll.roller}:${roll.id}`).join("|")}>
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
      {createPortal(<span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>, (options.trayHistory && socializing ? socialDialog.current : customizing ? customization.current : socializing ? socialDialog.current : configuring ? settingsDialog.current : null) ?? host.current?.parentElement ?? document.body)}
      {error && !customizing && !socializing && !configuring && <ErrorAlert message={error} />}
      {options.popoutError && <p className="error" role="alert">{options.popoutError}</p>}
      {presenceError && <ErrorAlert message={presenceError} />}
      {room?.expired && (
        <p className="error">
          This room has expired. <a href={import.meta.env.BASE_URL}>Start a new room</a>
        </p>
      )}
      <dialog
        ref={socialDialog}
        onClose={() => { setSocializing(false); if (options.trayHistory) { setCustomizing(false); setConfiguring(false); } }}
        onPointerDown={backdropDown}
        onPointerUp={backdropUp}
        onPointerCancel={() => {
          backdropPointer.current = null;
        }}
        className={`dice-customization social-dialog${options.trayHistory ? ' mini-settings' : ''}`}
        aria-labelledby={`${instanceId}-join-table-title`}
      >
        <header>
          <h2 id={`${instanceId}-join-table-title`}>{options.trayHistory ? 'Settings' : 'Sharing'}</h2>
          <button
            type="button"
            aria-label={options.trayHistory ? 'Close settings' : 'Close social menu'}
            onClick={() => socialDialog.current?.close()}
          >
            <X aria-hidden />
          </button>
        </header>
        {options.trayHistory && <div className="mini-settings-tabs" role="tablist" aria-label="Tray settings">
          {settingsTabs.map((tab, index) => <button key={tab} type="button" role="tab"
            id={`${instanceId}-settings-${tab}`} aria-selected={settingsTab === tab}
            aria-controls={`${instanceId}-settings-${tab}-panel`} tabIndex={settingsTab === tab ? 0 : -1}
            onClick={() => selectSettingsTab(tab)} onKeyDown={event => {
              const next = event.key === 'ArrowRight' ? (index + 1) % settingsTabs.length
                : event.key === 'ArrowLeft' ? (index + settingsTabs.length - 1) % settingsTabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? settingsTabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              selectSettingsTab(settingsTabs[next]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }}>{tab === 'sharing' ? 'Sharing' : tab === 'dice' ? 'Dice' : 'Settings'}</button>)}
        </div>}
        <div role={options.trayHistory ? 'tabpanel' : undefined}
          id={`${instanceId}-settings-sharing-panel`} aria-labelledby={options.trayHistory ? `${instanceId}-settings-sharing` : undefined}
          hidden={options.trayHistory && settingsTab !== 'sharing'}>
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
            onChange={e => changeProfile({ ...profileRef.current, name: e.target.value })}
          />
        </label>
        {socializing && error && <ErrorAlert message={error} />}
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
        </div>
        {options.trayHistory && <div className="profile-dialog mini-settings-dice" role="tabpanel"
          id={`${instanceId}-settings-dice-panel`} aria-labelledby={`${instanceId}-settings-dice`}
          hidden={settingsTab !== 'dice'}>
          {customizationContent}
        </div>}
        {options.trayHistory && <div className="profile-dialog mini-settings-preferences" role="tabpanel"
          id={`${instanceId}-settings-settings-panel`} aria-labelledby={`${instanceId}-settings-settings`}
          hidden={settingsTab !== 'settings'}>
          {settingsContent}
        </div>}
      </dialog>
      {!options.trayHistory && <dialog
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
        {customizationContent}
      </dialog>}
      {!options.trayHistory && <dialog ref={settingsDialog}
        className="dice-customization profile-dialog app-settings" aria-labelledby={`${instanceId}-app-settings-title`}
        onClose={() => setConfiguring(false)} onPointerDown={backdropDown} onPointerUp={backdropUp}
        onPointerCancel={() => { backdropPointer.current = null; }}>
        <header>
          <h2 id={`${instanceId}-app-settings-title`}>Settings</h2>
          <button type="button" aria-label="Close settings" onClick={() => settingsDialog.current?.close()}><X aria-hidden /></button>
        </header>
        {settingsContent}
      </dialog>}
    </main>
  );
}

/** Compatibility aliases for existing embedded consumers. */
export const PowerRoller = ClickClacks;
export type PowerRollerOptions = ClickClacksOptions;
