// SPDX-License-Identifier: MIT
import type { Identity, Profile, Transport } from './client.ts';
import type { Room } from '../shared/room.ts';
import { createLocalTransport } from './local-transport.ts';

export const soloReturnDelayMs = 10 * 60 * 1000;
export const presenceLifetimeMs = 30000;
export type RollSessionSnapshot = { mode: 'checking' | 'local' | 'shared'; revision: number };

/** Membership stays on Convex; only the rolling session changes authority. */
export function createAutomaticSession(identity: Identity, clock = Date.now) {
  let snapshot: RollSessionSnapshot = { mode: 'checking', revision: 0 };
  let room: Room | undefined, serverOffset = 0, connected = false, aloneSince: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let local: ReturnType<typeof createLocalTransport> | undefined;
  const listeners = new Set<() => void>();
  function setMode(mode: RollSessionSnapshot['mode']) {
    if (mode === snapshot.mode) return;
    local?.invalidate(); local = undefined;
    snapshot = { mode, revision: snapshot.revision + 1 };
    for (const notify of listeners) notify();
  }
  function evaluate() {
    clearTimeout(timer); timer = undefined;
    const now = clock(), serverNow = now + serverOffset;
    const alive = room && !room.expired ? room.participants.filter(p => p.seenAt > serverNow - presenceLifetimeMs) : [];
    const own = alive.find(p => p.id === identity.viewer);
    const peers = alive.filter(p => p.id !== identity.viewer);
    // A second participant always wins, including an unready player still loading.
    if (peers.length) { aloneSince = undefined; setMode('shared'); }
    if (!connected || !own) { aloneSince = undefined; return; }
    if (!peers.length) {
      if (snapshot.mode === 'checking') setMode('local');
      if (snapshot.mode === 'shared') {
        aloneSince ??= now;
        if (now - aloneSince >= soloReturnDelayMs) { aloneSince = undefined; setMode('local'); }
      }
    }
    // Re-evaluate expiry even if a peer vanishes without an explicit Leave.
    const deadlines = alive.map(p => p.seenAt + presenceLifetimeMs - serverOffset);
    if (aloneSince !== undefined) deadlines.push(aloneSince + soloReturnDelayMs);
    if (listeners.size && deadlines.length) timer = setTimeout(evaluate, Math.max(1, Math.min(...deadlines) - now));
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(notify: () => void) {
      listeners.add(notify); evaluate();
      return () => { listeners.delete(notify); if (!listeners.size) { clearTimeout(timer); timer = undefined; local?.invalidate(); local = undefined; } };
    },
    observe(next: Room | undefined, serverNow: number, isConnected: boolean) {
      room = next; serverOffset = serverNow - clock(); connected = isConnected; evaluate();
    },
    localTransport(profile: Profile): Transport {
      if (snapshot.mode !== 'local' || !room) throw new Error('The local session is unavailable.');
      local ??= createLocalTransport(identity, room, profile);
      local.update(room, profile);
      return local.transport;
    },
  };
}
export type AutomaticSession = ReturnType<typeof createAutomaticSession>;
