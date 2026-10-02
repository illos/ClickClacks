// SPDX-License-Identifier: MIT
import type { Identity, Profile, Transport } from './client';
import { generatePool } from './dice';
import { resolvePowerRoll } from './draw-steel';
import { defaultDice, dicePoolSides, genericModifier, naturalDiceTotal, rollCooldownMs, validateDiceConfiguration, type DiceConfiguration } from '../shared/dice';
import type { ParticipantRoll, Room } from '../shared/room';
import type { Motion } from '../shared/model';
import { recordedRevealDelay } from '../shared/timing';
import { validateMotion } from '../component/lib/recordedMotion';

/** One browser session, shared by its main page and same-origin floating tray. */
export function createLocalTransport(identity: Identity, initialRoom: Room, initialProfile: Profile, clock = Date.now) {
  let room = initialRoom, profile = initialProfile, sequence = 0, closed = false, lastStartedAt = -Infinity;
  const requests = new Map<string, { fingerprint: string; faces: number[]; semantic?: string; roll?: ParticipantRoll; expiresAt: number }>();
  const records: ParticipantRoll[] = [];
  let active: ParticipantRoll[] = [];
  const listeners = new Set<{ method: string; next: (value: any) => void }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleTrim() {
    clearTimeout(timer); timer = undefined;
    const deadlines = [...active.map(r => r.startsAt + r.duration + 5600), ...[...requests.values()].map(r => r.expiresAt)];
    if (!closed && deadlines.length) timer = setTimeout(() => { trim(); scheduleTrim(); }, Math.max(1, Math.min(...deadlines) - clock()));
  }
  function view() {
    const member = room.participants.find(p => p.id === identity.viewer)!;
    return { ...room, cursor: sequence, participants: [{ ...member, ...profile }] };
  }
  function trim() {
    const now = clock();
    active = active.filter(r => r.startsAt + r.duration + 5600 > now);
    const visible = new Set(active.map(r => r.id));
    while (records.length && (records[0]!.historyExpiresAt! <= now || records.length > 100)) records.shift();
    for (const [id, request] of requests) {
      if (request.expiresAt <= now) requests.delete(id);
      else if (request.roll && !visible.has(id)) delete request.roll.motion;
    }
  }
  function track() {
    trim();
    const roll = active.at(-1);
    return roll ? { roll, activeRolls: [...active], receipts: [] } : null;
  }
  function publish() {
    for (const listener of listeners) listener.next(listener.method === 'diceDemoV2:view' ? view() : track());
  }
  const transport: Transport = {
    async call(method, args) {
      if (closed) throw new Error('Local session changed.');
      trim();
      if (method === 'diceDemo:clock') return clock();
      if (method === 'diceDemoV2:view') return view();
      if (method === 'diceDemoV2:track') return track();
      if (method === 'diceDemoV2:events') {
        const rolls = records.filter(r => r.sequence! > Number(args.after)).slice(0, Number(args.limit ?? 20));
        const cursor = rolls.at(-1)?.sequence ?? sequence;
        return { rolls, cursor, hasMore: records.some(r => r.sequence! > cursor) };
      }
      if (method === 'diceDemoV2:customize') { profile = { name: String(args.name), style: args.style as Profile['style'] }; publish(); return null; }
      if (method === 'diceDemoV2:clearTray') { active = []; trim(); scheduleTrim(); publish(); return null; }
      if (method !== 'diceDemo:sampleFaces' && method !== 'diceDemoV2:throwDice') throw new Error(`Unsupported local operation: ${method}`);
      const configured = validateDiceConfiguration((args.dice as DiceConfiguration | undefined) ?? defaultDice);
      const dice = { kind: configured.kind, sides: configured.sides, count: configured.count, ...(configured.bonusD4 ? { bonusD4: true } : {}) };
      const id = String(args.id), fingerprint = JSON.stringify(dice);
      let request = requests.get(id);
      if (request && request.fingerprint !== fingerprint) throw new Error('REQUEST_CONFLICT: different dice for this request.');
      if (method === 'diceDemo:sampleFaces') {
        if (!request) {
          if (clock() - lastStartedAt < rollCooldownMs) throw new Error('Wait two seconds before another roll.');
          if (requests.size >= 1000) throw new Error('Local request limit reached. Start a new session.');
          request = { fingerprint, faces: generatePool(dicePoolSides(dice).map(sides => ({ sides, count: 1 }))).map(d => d.value), expiresAt: clock() + 3600000 };
          requests.set(id, request);
          lastStartedAt = clock();
          scheduleTrim();
        }
        return [...request.faces];
      }
      if (!request || JSON.stringify(args.faces) !== JSON.stringify(request.faces)) throw new Error('INVALID_REQUEST: sample this local roll first.');
      const faces = [...request.faces], edges = Number(args.edges ?? 0), banes = Number(args.banes ?? 0);
      const semantic = JSON.stringify([faces, edges, banes]);
      if (request.semantic && request.semantic !== semantic) throw new Error('REQUEST_CONFLICT: different modifiers for this request.');
      if (request.roll) return request.roll;
      const power = dice.kind === 'power' ? resolvePowerRoll(faces, edges, banes) : undefined;
      const modifier = power?.adjustment.modifier ?? genericModifier(edges, banes);
      const total = naturalDiceTotal(faces, dice) + modifier;
      const motion = args.motion as Motion | undefined;
      const duration = motion ? validateMotion(motion, faces.length) : 2200;
      const startsAt = clock();
      const roll: ParticipantRoll = {
        id, roller: identity.viewer, name: profile.name, faces, dice: { ...dice },
        styles: faces.map(() => ({ ...profile.style })), edges, banes, modifier, total,
        source: 'generated', local: true, sequence: ++sequence, startsAt, duration,
        historyExpiresAt: request.expiresAt, revealAt: startsAt + recordedRevealDelay({ duration, faces, motion }),
        ...(motion ? { motion } : {}), ...(power ? { power: { edges, banes, total, tier: power.tier } } : {}),
      };
      request.roll = roll; request.semantic = semantic;
      records.push(roll); active.push(roll); trim(); scheduleTrim(); publish();
      return roll;
    },
    watch(method, _args, next) {
      if (closed) throw new Error('Local session changed.');
      if (!['diceDemoV2:view', 'diceDemoV2:track'].includes(method)) throw new Error(`Unsupported local subscription: ${method}`);
      const listener = { method, next }; listeners.add(listener);
      next(method === 'diceDemoV2:view' ? view() : track());
      return () => { listeners.delete(listener); };
    },
  };
  return {
    transport,
    update(next: Room, nextProfile: Profile) { room = next; profile = nextProfile; },
    invalidate() { closed = true; clearTimeout(timer); timer = undefined; requests.clear(); records.length = 0; active = []; listeners.clear(); },
  };
}
