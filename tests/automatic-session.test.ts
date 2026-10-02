// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutomaticSession, createController, type Identity, type Profile } from '../lib/client';
import { soloReturnDelayMs } from '../lib/automatic-session';
import type { Room, Participant } from '../shared/room';
import type { Motion } from '../shared/model';

// Fixed independent faces exercise acceptance/arithmetic, rather than randomness.
vi.mock('../lib/dice', () => ({ generatePool: (groups: { sides: number }[]) => groups.map((group, i) => ({ id: String(i), sides: group.sides, value: group.sides })) }));
const identity: Identity = { viewer: 'solo', credential: 'private' };
const profile: Profile = { name: 'Solo', style: { color: '#abcdef', ink: '#000000', pattern: 'solid', font: 'rune' } };
function member(id = identity.viewer): Participant { return { id, ...profile, seenAt: Date.now(), ready: true, uncertainty: 0, slot: id === identity.viewer ? 0 : 1 }; }
function room(peers = false): Room { return { code: 'ABCDEFGH', expired: false, cursor: 5, participants: [member(), ...(peers ? [member('peer')] : [])] }; }
function setup() {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  const session = createAutomaticSession(identity);
  const stop = session.subscribe(() => {});
  return { session, stop, observe: (peers = false, connected = true) => session.observe(room(peers), Date.now(), connected) };
}
async function soloMinutes(observe: () => void, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 10000) {
    await vi.advanceTimersByTimeAsync(Math.min(10000, milliseconds - elapsed)); observe();
  }
}
function controller(session: ReturnType<typeof createAutomaticSession>) {
  return createController({ transport: session.localTransport(profile), identity, profile, key: 'room', clockEstimate: () => ({ offset: 0, uncertainty: 0 }) });
}
afterEach(() => vi.useRealTimers());
describe('automatic solo authority', () => {
  it('waits for confirmed own membership, then switches immediately for even an unready newcomer', () => {
    const { session, stop, observe } = setup();
    session.observe(undefined, Date.now(), true);
    expect(session.getSnapshot().mode).toBe('checking');
    observe(); expect(session.getSnapshot().mode).toBe('local');
    const incoming = room(true); incoming.participants[1]!.ready = false;
    session.observe(incoming, Date.now(), true);
    expect(session.getSnapshot()).toEqual({ mode: 'shared', revision: 2 }); stop();
  });
  it('requires ten continuous minutes alone; a returning player resets the entire delay', async () => {
    const { session, stop, observe } = setup();
    observe(true); observe();
    await soloMinutes(observe, soloReturnDelayMs - 10000);
    expect(session.getSnapshot().mode).toBe('shared');
    observe(true); observe();
    await soloMinutes(observe, soloReturnDelayMs - 10000);
    expect(session.getSnapshot().mode).toBe('shared');
    await soloMinutes(observe, 10000);
    expect(session.getSnapshot().mode).toBe('local'); stop();
  });
  it('treats suspension/disconnection as unknown presence and starts a fresh delay after reconnect', async () => {
    const { session, stop, observe } = setup();
    observe(true); observe(); await soloMinutes(observe, soloReturnDelayMs - 10000);
    observe(false, false); await vi.advanceTimersByTimeAsync(soloReturnDelayMs);
    expect(session.getSnapshot().mode).toBe('shared');
    observe(); await soloMinutes(observe, soloReturnDelayMs - 10000);
    expect(session.getSnapshot().mode).toBe('shared');
    await soloMinutes(observe, 10000); expect(session.getSnapshot().mode).toBe('local'); stop();
  });
  it('detects a vanished peer through presence expiry, without treating a duplicate own identity as another player', async () => {
    const { session, stop } = setup();
    const snapshot = room(true); session.observe(snapshot, Date.now(), true);
    await vi.advanceTimersByTimeAsync(20000);
    snapshot.participants[0] = member(); session.observe(snapshot, Date.now(), true);
    await vi.advanceTimersByTimeAsync(10000); // Peer expires; own membership remains fresh.
    snapshot.participants = [member(), member()];
    session.observe(snapshot, Date.now(), true);
    await soloMinutes(() => { snapshot.participants = [member(), member()]; session.observe(snapshot, Date.now(), true); }, soloReturnDelayMs - 10000);
    expect(session.getSnapshot().mode).toBe('shared');
    await soloMinutes(() => session.observe(room(), Date.now(), true), 10000);
    expect(session.getSnapshot().mode).toBe('local'); stop();
  });
  it('never starts solo play from an expired room or an expired own heartbeat', () => {
    const { session, stop } = setup();
    const expired = room(); expired.expired = true;
    session.observe(expired, Date.now(), true); expect(session.getSnapshot().mode).toBe('checking');
    const stale = room(); stale.participants[0]!.seenAt -= 30000;
    session.observe(stale, Date.now(), true); expect(session.getSnapshot().mode).toBe('checking'); stop();
  });
  it('cancels a prepared local roll on a join and discards it rather than uploading it to shared play', async () => {
    const { session, stop, observe } = setup(); observe();
    const c = controller(session); await c.observe();
    let finish!: () => void, started!: () => void;
    const prepared = new Promise<void>(resolve => { started = resolve; });
    const pending = c.roll({ id: 'pending' }, () => new Promise(resolve => { finish = () => resolve(undefined); started(); }));
    await prepared; observe(true); finish();
    await expect(pending).rejects.toThrow('Local session changed');
    await c.dispose(); stop();
  });
  it('shares one local transport between main page and PiP, preserving delivery and a shared clear', async () => {
    const { session, stop, observe } = setup(); observe();
    const main = controller(session), pip = controller(session), mainTrack = vi.fn(), pipTrack = vi.fn(), available = vi.fn();
    main.on('track', mainTrack); pip.on('track', pipTrack); main.on('available', available);
    await main.observe(); await pip.observe();
    const roll = await pip.roll({ id: 'pip' });
    await vi.advanceTimersByTimeAsync(0);
    expect(mainTrack.mock.calls.at(-1)?.[0].roll.id).toBe('pip');
    expect(pipTrack.mock.calls.at(-1)?.[0].roll.id).toBe('pip');
    await vi.advanceTimersByTimeAsync(2200);
    expect(available).toHaveBeenCalledOnce(); expect(available.mock.calls[0]![0].local).toBe(true);
    await pip.clear(); expect(mainTrack.mock.calls.at(-1)?.[0].roll).toBeNull();
    expect(await pip.roll({ id: 'pip' })).toEqual(roll);
    expect(mainTrack.mock.calls.at(-1)?.[0].roll).toBeNull(); // Retry does not resurrect cleared dice.
    await pip.dispose(); // Closing PiP must not invalidate the main page's transport.
    await main.roll({ id: 'after-close' }); await main.dispose(); stop();
  });
  it.each([
    [{ kind: 'dice' as const, sides: 6 as const, count: 2, bonusD4: true }, 2, 1, 19], // 6+6+4 +5-2.
    [{ kind: 'percentile' as const, sides: 10 as const, count: 2, bonusD4: true }, 1, 0, 106], // 00/0 => 100, +4+2.
  ])('keeps generic and percentile arithmetic for %j', async (dice, edges, banes, total) => {
    const { session, stop, observe } = setup(); observe(); const c = controller(session); await c.observe();
    const roll = await c.roll({ dice, edges, banes }); expect(roll.total).toBe(total); expect(roll.local).toBe(true);
    expect(roll.styles).toHaveLength(dice.count + 1); await c.dispose(); stop();
  });
  it('reuses the cited Power preset and the original recorded motion/reveal timing', async () => {
    // Compendium rule/dice/natural-roll.md: natural 19/20 => tier 3, even with banes.
    const { session, stop, observe } = setup(); observe(); const c = controller(session); await c.observe();
    const motion: Motion = { seed: 1, stepMs: 1000 / 60, offsets: Array(8).fill(0), samples: Array.from({ length: 121 }, () => [0,0,0,0,0,0,1, 0,0,0,0,0,0,1]).flat() };
    const roll = await c.roll({ banes: 2 }, async () => motion);
    expect(roll.faces).toEqual([10,10]); expect(roll.power).toEqual({ edges: 0, banes: 2, total: 20, tier: 3 });
    expect(roll.motion).toEqual(motion); expect(roll.duration).toBeCloseTo(2000);
    expect(roll.revealAt).toBe(roll.startsAt + 600); await c.dispose(); stop();
  });
  it('starts with empty local history after shared play and rejects a conflicting retry', async () => {
    const { session, stop, observe } = setup(); observe(); const first = controller(session); await first.observe();
    await first.roll({ id: 'old' });
    await expect(first.roll({ id: 'old', edges: 1 })).rejects.toThrow('REQUEST_CONFLICT');
    observe(true); await first.dispose(); observe(); await soloMinutes(observe, soloReturnDelayMs);
    const fresh = controller(session), available = vi.fn(); fresh.on('available', available); await fresh.observe();
    expect(available).not.toHaveBeenCalled(); await fresh.dispose(); stop();
  });
});
