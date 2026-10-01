// SPDX-License-Identifier: MIT
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { RollRequest, ResolvedResult } from "./dice";

export type Appearance = {
  color: string;
  ink: string;
  pattern: "solid" | "speckle" | "marble" | "frosted";
  font: "serif" | "modern" | "rune" | "gothic";
};
export type Member = {
  id: string;
  name: string;
  appearance: Appearance;
  activeUntil: number;
};
/** historical is local delivery metadata, not part of the persisted authority record. */
export type AcceptedRoll = {
  id: string;
  sequence: number;
  memberId: string;
  name: string;
  appearance: Appearance;
  request: RollRequest;
  result: ResolvedResult;
  acceptedAt: number;
  startsAt: number;
  revealAt: number;
  source: "generated" | "supplied";
  historical?: boolean;
};
export type RoomEvent = {
  sequence: number;
  kind: "roll" | "clear";
  memberId: string;
  roll?: AcceptedRoll;
};
export type RoomView = {
  id: string;
  expiresAt: number;
  members: Member[];
  cursor: number;
};
type Snapshot = {
  room: { id: string; expiresAt: number };
  members: Member[];
  cursor: number;
  latest: AcceptedRoll[];
};
export type Session = { roomId: string; credential: string; memberId: string };
export interface Transport {
  call(method: string, args: Record<string, unknown>): Promise<any>;
  watch(
    method: string,
    args: Record<string, unknown>,
    next: (value: any) => void,
    error: (error: Error) => void,
  ): () => void;
  close?(): Promise<void> | void;
}
export function convexTransport(url: string, client?: ConvexClient): Transport {
  const connection = client ?? new ConvexClient(url);
  return {
    call: (method, args) =>
      ["roll", "clock"].includes(method)
        ? connection.action(
            makeFunctionReference<"action">(`rooms:${method}`),
            args,
          )
        : ["view", "events"].includes(method)
          ? connection.query(
              makeFunctionReference<"query">(`rooms:${method}`),
              args,
            )
          : connection.mutation(
              makeFunctionReference<"mutation">(`rooms:${method}`),
              args,
            ),
    watch: (method, args, next, error) =>
      connection.onUpdate(
        makeFunctionReference<"query">(`rooms:${method}`),
        args,
        next,
        error,
      ),
    close: () => (client ? undefined : connection.close()),
  };
}
type Events = {
  "result.accepted": AcceptedRoll;
  "result.available": AcceptedRoll;
  room: RoomView;
  clear: string;
  status: string;
  error: Error;
};
export function createRoller(options: {
  transport: Transport;
  session?: Session;
  clock?: () => number;
  onSession?: (session: Session) => void;
}) {
  const listeners = new Map<keyof Events, Set<(data: any) => void>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const seen = new Set<string>();
  const trayOwners = new Set<string>();
  let session = options.session,
    cursor = 0,
    offset = 0,
    disposed = false,
    unwatch: (() => void)[] = [];
  let connectedRoom: string | undefined,
    generation = 0,
    refreshRequested = false;
  let syncing: Promise<void> | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined;
  const emit = <K extends keyof Events>(name: K, data: Events[K]) =>
    listeners.get(name)?.forEach((fn) => fn(data));
  const localClock = options.clock ?? Date.now;
  const now = () => localClock() + offset;
  const credentials = () => {
    if (!session) throw new Error("Join a table first.");
    return { roomId: session.roomId, credential: session.credential };
  };
  function accept(roll: AcceptedRoll, replayed = false) {
    if (disposed || seen.has(roll.id)) return;
    seen.add(roll.id);
    if (seen.size > 10000) seen.delete(seen.values().next().value!);
    const delay = Math.max(0, roll.revealAt - now());
    const delivered =
      replayed && delay === 0 ? { ...roll, historical: true } : roll;
    trayOwners.add(roll.memberId);
    emit("result.accepted", delivered);
    if (delay === 0) {
      emit("result.available", delivered);
      return;
    }
    timers.set(
      roll.id,
      setTimeout(() => {
        timers.delete(roll.id);
        if (!disposed) emit("result.available", delivered);
      }, delay),
    );
  }
  function snapshot(value: Snapshot) {
    emit("room", {
      ...value.room,
      members: value.members,
      cursor: value.cursor,
    });
  }
  async function recoverSnapshot(epoch: number) {
    const value = (await options.transport.call(
      "view",
      credentials(),
    )) as Snapshot;
    if (disposed || epoch !== generation) return;
    snapshot(value);
    const currentOwners = new Set(
      (value.latest ?? []).map((record) => record.memberId),
    );
    for (const owner of trayOwners) {
      if (!currentOwners.has(owner)) {
        trayOwners.delete(owner);
        emit("clear", owner);
      }
    }
    // Retained event history may have expired; latest trays remain authoritative.
    for (const record of value.latest ?? []) accept(record, true);
    cursor = value.cursor;
  }
  async function catchup() {
    refreshRequested = true;
    if (syncing) return syncing;
    const epoch = generation;
    const task = (async () => {
      let more = true;
      while ((more || refreshRequested) && !disposed && epoch === generation) {
        refreshRequested = false;
        let page: { events: RoomEvent[]; cursor: number; hasMore: boolean };
        try {
          page = await options.transport.call("events", {
            ...credentials(),
            after: cursor,
            limit: 100,
          });
        } catch (error) {
          if (String(error).includes("CURSOR_EXPIRED")) {
            await recoverSnapshot(epoch);
            more = true;
            continue;
          }
          throw error;
        }
        if (disposed || epoch !== generation) return;
        for (const event of page.events) {
          if (event.kind === "roll" && event.roll) accept(event.roll, true);
          else if (event.kind === "clear") {
            trayOwners.delete(event.memberId);
            emit("clear", event.memberId);
          }
          cursor = Math.max(cursor, event.sequence);
        }
        cursor = Math.max(cursor, page.cursor);
        more = page.hasMore;
      }
    })().finally(() => {
      if (syncing === task) syncing = undefined;
    });
    syncing = task;
    return task;
  }
  async function syncClock() {
    const epoch = generation,
      start = localClock();
    const server = await options.transport.call("clock", {});
    if (!disposed && epoch === generation)
      offset = server - (start + localClock()) / 2;
  }
  function stop(cancelResults = true) {
    unwatch.forEach((fn) => fn());
    unwatch = [];
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    if (cancelResults) {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    }
  }
  async function connect() {
    if (disposed) throw new Error("Roller has been disposed.");
    const room = credentials().roomId;
    // Reconnect retains deduplication and pending reveal timers in the same room.
    const changed = connectedRoom !== room;
    stop(changed);
    generation++;
    refreshRequested = false;
    // An old transport request can remain stalled indefinitely. Epoch checks retire it;
    // its eventual finalizer must not clear a newer room's catch-up ownership.
    syncing = undefined;
    if (changed) {
      cursor = 0;
      seen.clear();
      trayOwners.clear();
      connectedRoom = room;
    }
    const epoch = generation;
    await syncClock();
    if (disposed || epoch !== generation) return;
    unwatch.push(
      options.transport.watch(
        "view",
        credentials(),
        (value) => {
          if (disposed || epoch !== generation) return;
          snapshot(value);
          emit("status", "Connected");
          void catchup().catch(fail);
        },
        fail,
      ),
    );
    heartbeat = setInterval(() => {
      void options.transport.call("heartbeat", credentials()).catch(fail);
      void syncClock().catch(fail);
      void catchup().catch(fail);
    }, 10000);
    await catchup();
  }
  const fail = (error: Error) => {
    if (!disposed) {
      emit("status", "Connection interrupted");
      emit("error", error);
    }
  };
  return {
    on<K extends keyof Events>(name: K, listener: (data: Events[K]) => void) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
      };
    },
    async join(
      roomId: string | undefined,
      profile: { name: string; appearance: Appearance },
    ) {
      if (disposed) throw new Error("Roller has been disposed.");
      emit("status", "Connecting…");
      const previous = session;
      const credential =
        session && session.roomId === roomId
          ? session.credential
          : crypto.randomUUID();
      const response = await options.transport.call(
        roomId ? "join" : "create",
        { ...(roomId ? { roomId } : {}), credential, ...profile },
      );
      generation++; // Retire old query/roll responses before changing credentials.
      session = {
        roomId: response.room.id,
        credential,
        memberId: response.member.id,
      };
      if (previous && previous.roomId !== session.roomId) {
        // Best effort: a failed/expired old table must not block the newly joined table.
        void options.transport
          .call("leave", {
            roomId: previous.roomId,
            credential: previous.credential,
          })
          .catch(() => {});
      }
      options.onSession?.(session);
      await connect();
      return session!;
    },
    async resume() {
      if (!session) throw new Error("No saved session.");
      await connect();
      return session!;
    },
    async roll(request: RollRequest) {
      const epoch = generation;
      const record = (await options.transport.call("roll", {
        ...credentials(),
        request,
      })) as AcceptedRoll;
      if (epoch === generation && session) accept(record);
      return record;
    },
    async profile(profile: { name: string; appearance: Appearance }) {
      return options.transport.call("profile", {
        ...credentials(),
        ...profile,
      });
    },
    async clear() {
      return options.transport.call("clear", credentials());
    },
    async leave() {
      const args = session ? credentials() : undefined;
      generation++;
      stop();
      seen.clear();
      trayOwners.clear();
      cursor = 0;
      connectedRoom = undefined;
      session = undefined;
      if (args) await options.transport.call("leave", args);
    },
    clock: now,
    get session() {
      return session;
    },
    async dispose() {
      disposed = true;
      generation++;
      stop();
      listeners.clear();
      await options.transport.close?.();
    },
  };
}
export type Roller = ReturnType<typeof createRoller>;
