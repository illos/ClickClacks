import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import appSchema from "../convex/schema.js";
import componentSchema from "../src/component/schema.js";
import { api } from "../convex/_generated/api.js";
import {
  api as componentApi,
  internal as componentInternal,
} from "../src/component/_generated/api.js";
import type { RollRequest } from "../src/dice.js";
const appModules = import.meta.glob("../convex/**/*.ts");
const componentModules = import.meta.glob("../src/component/**/*.ts");
const credential = "a".repeat(36),
  otherCredential = "b".repeat(36);
const request: RollRequest = {
  requestId: "request-a",
  dice: [{ sides: 10, count: 2 }],
  ruleset: "draw-steel/power",
};
function setup() {
  const t = convexTest(appSchema, appModules);
  t.registerComponent("powerroller", componentSchema, componentModules);
  return t;
}
function clock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
}
afterEach(() => vi.useRealTimers());
describe("isolated collaborative component through community app wrappers", () => {
  it("secure server acceptance persists without graphics and retries survive clear", async () => {
    clock();
    const t = setup();
    const joined = await t.mutation(api.rooms.create, {
      name: "River",
      credential,
    });
    const args = { roomId: joined.room.id, credential };
    const roll = await t.action(api.rooms.roll, { ...args, request });
    expect(roll.source).toBe("generated");
    expect(roll.result.dice).toHaveLength(2);
    expect(
      roll.result.dice.every(
        (d: { value: number }) => d.value >= 1 && d.value <= 10,
      ),
    ).toBe(true);
    expect(roll.revealAt - roll.acceptedAt).toBe(2200);
    const state = await t.query(api.rooms.view, args);
    expect(state.latest).toEqual([roll]);
    expect(state.members[0].id).not.toBe(credential);
    expect(JSON.stringify(state)).not.toContain(credential);
    await t.mutation(api.rooms.clear, args);
    const retry = await t.action(api.rooms.roll, { ...args, request });
    expect(retry).toEqual(roll);
    expect((await t.query(api.rooms.view, args)).latest).toEqual([]);
    const events = await t.query(api.rooms.events, { ...args, after: 0 });
    expect(events.events.map((e: { kind: string }) => e.kind)).toEqual([
      "roll",
      "clear",
    ]);
    expect(events.events[0].roll).toEqual(roll);
    await expect(
      t.action(api.rooms.roll, {
        ...args,
        request: { ...request, modifiers: { characteristic: 1 } },
      }),
    ).rejects.toThrow("REQUEST_CONFLICT");
  });
  it("rapid sequential rolls and clear before reveal are delivered by bounded cursor", async () => {
    clock();
    const t = setup();
    const { room } = await t.mutation(api.rooms.create, {
      name: "Sky",
      credential,
    });
    const args = { roomId: room.id, credential };
    const first = await t.action(api.rooms.roll, { ...args, request });
    vi.advanceTimersByTime(250);
    const second = await t.action(api.rooms.roll, {
      ...args,
      request: { ...request, requestId: "request-b" },
    });
    await t.mutation(api.rooms.clear, args);
    const page1 = await t.query(api.rooms.events, {
      ...args,
      after: 0,
      limit: 1,
    });
    expect(page1.events[0].roll).toEqual(first);
    expect(page1.hasMore).toBe(true);
    const page2 = await t.query(api.rooms.events, {
      ...args,
      after: page1.cursor,
      limit: 1,
    });
    expect(page2.events[0].roll).toEqual(second);
    expect(page2.hasMore).toBe(true);
    const page3 = await t.query(api.rooms.events, {
      ...args,
      after: page2.cursor,
      limit: 1,
    });
    expect(page3.events[0].kind).toBe("clear");
    expect(page3.hasMore).toBe(false);
    expect(Date.now()).toBeLessThan(first.revealAt);
  });
  it("expired receipt rejects after compaction instead of generating another result", async () => {
    clock();
    const t = convexTest(componentSchema, componentModules);
    const { room } = await t.mutation(componentApi.rooms.create, {
      name: "Ash",
      credential,
    });
    const args = { roomId: room.id, credential };
    await t.mutation(componentApi.rooms.acceptGenerated, {
      ...args,
      request,
      values: [7, 8],
    });
    vi.advanceTimersByTime(3_600_001);
    await t.mutation(componentInternal.cleanup.expired, {});
    await expect(
      t.mutation(componentApi.rooms.acceptGenerated, {
        ...args,
        request,
        values: [7, 8],
      }),
    ).rejects.toThrow("REQUEST_EXPIRED");
    const receipts = await t.run((ctx) =>
      ctx.db
        .query("receipts")
        .withIndex("by_room", (q) => q.eq("roomId", room.id))
        .take(10),
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].roll).toBeUndefined();
    await expect(
      t.query(componentApi.rooms.events, { ...args, after: 0 }),
    ).rejects.toThrow("CURSOR_EXPIRED");
    vi.advanceTimersByTime(24 * 3_600_000);
    await t.mutation(componentInternal.cleanup.expired, {});
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("receipts")
          .withIndex("by_room", (q) => q.eq("roomId", room.id))
          .take(10),
      ),
    ).toHaveLength(0);
    await expect(
      t.mutation(componentApi.rooms.acceptGenerated, {
        ...args,
        request,
        values: [7, 8],
      }),
    ).rejects.toThrow("ROOM_EXPIRED");
  });
  it("public member ID grants no access, credentials are room-scoped and clear affects only its caller", async () => {
    clock();
    const t = setup();
    const owner = await t.mutation(api.rooms.create, {
      name: "Ember",
      credential,
    });
    const args = { roomId: owner.room.id, credential };
    const visitor = await t.mutation(api.rooms.join, {
      roomId: owner.room.id,
      name: "Rain",
      credential: otherCredential,
    });
    const visitorArgs = { roomId: owner.room.id, credential: otherCredential };
    const mine = await t.action(api.rooms.roll, { ...args, request });
    const theirs = await t.action(api.rooms.roll, { ...visitorArgs, request });
    await t.mutation(api.rooms.clear, visitorArgs);
    expect((await t.query(api.rooms.view, args)).latest).toEqual([mine]);
    await expect(
      t.mutation(api.rooms.profile, {
        roomId: owner.room.id,
        credential: visitor.member.id,
        name: "Impersonation",
      }),
    ).rejects.toThrow();
    const alien = await t.mutation(api.rooms.create, {
      name: "Alien",
      credential: otherCredential,
    });
    await expect(
      t.query(api.rooms.view, { roomId: alien.room.id, credential }),
    ).rejects.toThrow("UNAUTHORIZED");
    const readback = await t.query(api.rooms.events, { ...args, after: 0 });
    expect(readback.events[1].roll).toEqual(theirs);
    await t.mutation(api.rooms.leave, visitorArgs);
    await expect(
      t.action(api.rooms.roll, {
        ...visitorArgs,
        request: { ...request, requestId: "left" },
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  it("current tray survives 100 events and archive expiry while stale sessions cannot exceed capacity", async () => {
    clock();
    const t = convexTest(componentSchema, componentModules);
    const { room } = await t.mutation(componentApi.rooms.create, {
      name: "First",
      credential,
    });
    const args = { roomId: room.id, credential };
    const roll = await t.mutation(componentApi.rooms.acceptGenerated, {
      ...args,
      request,
      values: [7, 8],
    });
    await t.mutation(componentApi.rooms.join, {
      roomId: room.id,
      name: "Other",
      credential: otherCredential,
    });
    for (let i = 0; i < 102; i++) {
      await t.mutation(componentApi.rooms.clear, {
        roomId: room.id,
        credential: otherCredential,
      });
      vi.advanceTimersByTime(250);
    }
    expect((await t.query(componentApi.rooms.view, args)).latest).toEqual([
      roll,
    ]);
    vi.advanceTimersByTime(3_600_001);
    await t.mutation(componentInternal.cleanup.expired, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(componentApi.rooms.heartbeat, args);
    expect((await t.query(componentApi.rooms.view, args)).latest).toEqual([
      roll,
    ]);
    vi.advanceTimersByTime(30_001);
    for (let i = 0; i < 8; i++)
      await t.mutation(componentApi.rooms.join, {
        roomId: room.id,
        name: `New ${i}`,
        credential: `${i}`.repeat(36),
      });
    await expect(
      t.mutation(componentApi.rooms.heartbeat, args),
    ).rejects.toThrow("ROOM_FULL");
    await expect(
      t.mutation(componentApi.rooms.acceptGenerated, {
        ...args,
        values: [7, 8],
        request: { ...request, requestId: "fresh" },
      }),
    ).rejects.toThrow("ROOM_FULL");
    expect(
      (
        await t.query(componentApi.rooms.view, {
          roomId: room.id,
          credential: "0".repeat(36),
        })
      ).members,
    ).toHaveLength(8);
  });
  it("trusted hosts configure bounded room policy and register model side counts", async () => {
    clock();
    const t = convexTest(componentSchema, componentModules);
    const { room } = await t.mutation(componentApi.rooms.create, {
      name: "Host",
      credential,
      policy: {
        capacity: 1,
        ttlMs: 60_000,
        revealDelayMs: 0,
        models: [{ id: "prism7", sides: 7 }],
      },
    });
    const args = { roomId: room.id, credential };
    expect(room.expiresAt - Date.now()).toBe(60_000);
    await expect(
      t.mutation(componentApi.rooms.join, {
        roomId: room.id,
        name: "No seat",
        credential: otherCredential,
      }),
    ).rejects.toThrow("ROOM_FULL");
    const custom = {
      requestId: "custom",
      dice: [{ sides: 7, count: 1 }],
      ruleset: "sum" as const,
    };
    const roll = await t.mutation(componentApi.rooms.acceptSupplied, {
      ...args,
      request: custom,
      values: [7],
    });
    expect(roll.revealAt).toBe(roll.acceptedAt);
    expect(roll.startsAt).toBe(roll.acceptedAt);
    const motion = {
      version: 1 as const,
      modelIds: ["prism7"],
      dieIds: [roll.result.dice[0].id],
      values: [7],
      frames: [],
    };
    await t.mutation(componentApi.rooms.attachPresentation, {
      ...args,
      rollId: roll.id,
      motion,
    });
    expect(
      await t.query(componentApi.rooms.getPresentation, {
        ...args,
        rollId: roll.id,
      }),
    ).toEqual(motion);
    await expect(
      t.mutation(componentApi.rooms.create, {
        name: "Bad",
        credential,
        policy: { capacity: 33 },
      }),
    ).rejects.toThrow("INVALID_POLICY");
  });
  it("invalid logical requests return structured actionable errors and do not persist rolls", async () => {
    clock();
    const t = setup();
    const { room } = await t.mutation(api.rooms.create, {
      name: "Errors",
      credential,
    });
    const args = { roomId: room.id, credential };
    await expect(
      t.action(api.rooms.roll, {
        ...args,
        request: { ...request, dice: [{ sides: 1, count: 2 }] },
      }),
    ).rejects.toThrow("INVALID_REQUEST");
    const state = await t.query(api.rooms.view, args);
    expect(state.cursor).toBe(0);
    expect(state.latest).toEqual([]);
    const component = convexTest(componentSchema, componentModules);
    const joined = await component.mutation(componentApi.rooms.create, {
      name: "Supplied",
      credential,
    });
    await expect(
      component.mutation(componentApi.rooms.acceptSupplied, {
        roomId: joined.room.id,
        credential,
        request,
        values: [0, 11],
      }),
    ).rejects.toThrow("INVALID_REQUEST");
    expect(
      (
        await component.query(componentApi.rooms.view, {
          roomId: joined.room.id,
          credential,
        })
      ).cursor,
    ).toBe(0);
  });
  it("trusted supplied path is labelled and presentation must match persisted acceptance", async () => {
    clock();
    const t = convexTest(componentSchema, componentModules);
    const owner = await t.mutation(componentApi.rooms.create, {
      name: "Fern",
      credential,
    });
    const args = { roomId: owner.room.id, credential };
    const roll = await t.mutation(componentApi.rooms.acceptSupplied, {
      ...args,
      request,
      values: [7, 8],
    });
    expect(roll.source).toBe("supplied");
    expect(
      (await t.query(componentApi.rooms.view, args)).latest[0].result.total,
    ).toBe(15);
    const motion = {
      version: 1 as const,
      modelIds: ["d10", "d10"],
      dieIds: roll.result.dice.map((d: { id: string }) => d.id),
      values: [7, 8],
      frames: [0, 1],
    };
    await expect(
      t.mutation(componentApi.rooms.attachPresentation, {
        ...args,
        rollId: roll.id,
        motion: { ...motion, values: [8, 8] },
      }),
    ).rejects.toThrow("INVALID_PRESENTATION");
    await t.mutation(componentApi.rooms.attachPresentation, {
      ...args,
      rollId: roll.id,
      motion,
    });
    expect(
      await t.query(componentApi.rooms.getPresentation, {
        ...args,
        rollId: roll.id,
      }),
    ).toEqual(motion);
    await t.mutation(componentApi.rooms.join, {
      roomId: owner.room.id,
      name: "Willow",
      credential: otherCredential,
    });
    await expect(
      t.mutation(componentApi.rooms.attachPresentation, {
        roomId: owner.room.id,
        credential: otherCredential,
        rollId: roll.id,
        motion,
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
});
