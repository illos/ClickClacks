// SPDX-License-Identifier: MIT
export type JoinLogEntry = { kind: 'join'; id: string; participant: string; name: string; startsAt: number };

/** Session-only arrival notices, independent of dice delivery and backend history. */
export function createMembershipLog() {
  let room: string | undefined, revision = 0, sequence = 0;
  let present: Set<string> | undefined;
  let entries: JoinLogEntry[] = [];
  return {
    observe(nextRoom: string, nextRevision: number, members: readonly { id: string; name: string }[], now: number) {
      if (room !== nextRoom) { room = nextRoom; present = undefined; entries = []; }
      if (revision !== nextRevision) { revision = nextRevision; entries = []; }
      const current = new Set(members.map(member => member.id));
      // Existing participants in the first snapshot are not new arrivals.
      const arrivals = present ? members.filter(member => !present!.has(member.id)) : [];
      present = current;
      if (arrivals.length) entries = [
        ...arrivals.map(member => ({ kind: 'join' as const, id: String(++sequence), participant: member.id, name: member.name, startsAt: now })),
        ...entries,
      ].slice(0, 100);
      return entries;
    },
  };
}
