// SPDX-License-Identifier: MIT
import { expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { api as componentApi } from "../../component/_generated/api";
import { demoV2 } from "../../web/dice-demo-v2/api";
import { backend, componentBackend } from "./fixtures/table";

test("sampling and preparation count toward the two-second cooldown while both results are retained", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const t = backend();
    const session = {
      key: "12345678-1234-1234-1234-123456789010",
      viewer: "12345678-1234-1234-1234-123456789011",
      credential: "private-session-credential-for-tests-123456",
    };
    await t.mutation(demoV2.join, {
      ...session,
      name: "Sappho",
      style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" },
      ready: true,
      uncertainty: 10,
    });
    const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
    const first = {
      ...session,
      id: "12345678-1234-1234-1234-123456789012",
      faces: [9, 10],
      motion: {
        seed: 42,
        stepMs: 1000 / 60,
        samples: Array.from({ length: 301 }, () => frame).flat(),
        offsets: [0, 0, 0, 1, 0, 0, 0, 1],
      },
    };
    const { motion: _motion, ...firstSample } = first;
    clock.mockReturnValue(1_000_100);
    await t.mutation(internal.diceDemoV2.recordSample, firstSample);
    const sampledAt = Date.now();
    clock.mockReturnValue(sampledAt + 1200);
    const initial = await t.mutation(demoV2.throwDice, first);
    expect(initial.duration).toBe(5000);

    clock.mockReturnValue(sampledAt + 1999);
    const next = {
      ...session,
      id: "12345678-1234-1234-1234-123456789013",
      faces: [2, 3],
    };
    await t.mutation(internal.diceDemoV2.recordSample, next);
    await expect(t.mutation(demoV2.throwDice, next)).rejects.toThrow("Wait two seconds");
    expect((await t.query(demoV2.track, { key: session.key, viewer: session.viewer }))?.roll.id).toBe(first.id);

    clock.mockReturnValue(sampledAt + 2000);
    await expect(t.mutation(demoV2.throwDice, { ...next, credential: "wrong-private-session-credential" })).rejects.toThrow("private session credential");
    await t.mutation(demoV2.throwDice, next);
    const current = await t.query(demoV2.track, { key: session.key, viewer: session.viewer });
    expect(current?.roll.id).toBe(next.id);
    expect(current?.roll.faces).toEqual([2, 3]);
    expect(Date.now()).toBeLessThan(initial.startsAt + initial.duration);
    expect(Date.now() - initial.startsAt).toBeLessThan(1000);

    const history = await t.query(demoV2.events, { ...session, after: 0 });
    expect(history.rolls.map(roll => ({ id: roll.id, faces: roll.faces, sequence: roll.sequence }))).toEqual([
      { id: first.id, faces: [9, 10], sequence: 1 },
      { id: next.id, faces: [2, 3], sequence: 2 },
    ]);
    // A retry returns its original receipt, without replacing the newer track.
    expect((await t.mutation(demoV2.throwDice, first)).id).toBe(first.id);
    expect((await t.query(demoV2.track, { key: session.key, viewer: session.viewer }))?.roll.id).toBe(next.id);
  } finally {
    clock.mockRestore();
  }
});

test("overlap metadata stays bounded to eight and each path response carries only one recording", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(4_000_000);
  try {
    const t = componentBackend();
    const session = {
      key: "12345678-1234-1234-1234-123456789040",
      viewer: "12345678-1234-1234-1234-123456789041",
      credential: "private-session-credential-for-tests-123456",
    };
    await t.mutation(componentApi.diceDemoV2.join, {
      ...session, name: "Cicero", ready: true, uncertainty: 10,
      style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" },
    });
    const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
    const motion = {
      seed: 42, stepMs: 1000 / 60,
      samples: Array.from({ length: 301 }, () => frame).flat(),
      offsets: [0, 0, 0, 1, 0, 0, 0, 1],
    };
    const requests = Array.from({ length: 9 }, (_, index) => ({
      ...session, id: `12345678-1234-1234-1234-1234567890${50 + index}`, faces: [3, 4],
    }));
    for (const [index, request] of requests.entries()) {
      clock.mockReturnValue(4_000_100 + index * 250);
      await t.mutation(componentApi.diceDemoV2.recordSample, request);
    }
    // Several previously sampled requests can finish their preparations together.
    clock.mockReturnValue(4_010_000);
    for (const request of requests)
      await t.mutation(componentApi.diceDemoV2.throwDice, { ...request, motion });
    const trackArgs = { key: session.key, viewer: session.viewer };
    const late = await t.query(componentApi.diceDemoV2.track, trackArgs);
    expect(late?.activeRolls?.map(roll => roll.id)).toEqual(requests.slice(1).map(request => request.id));
    expect(late?.activeRolls?.every(roll => !("motion" in roll))).toBe(true);
    expect(late?.roll.motion).toBeDefined();
    const retained = await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: requests[1]!.id });
    expect(retained?.roll.motion).toBeDefined();
    expect(retained).not.toHaveProperty("activeRolls");
    expect(await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: requests[0]!.id })).toBeNull();
  } finally {
    clock.mockRestore();
  }
});

test("late observers fetch overlapping paths separately; clear prevents retained history from resurfacing", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(3_000_000);
  try {
    const t = componentBackend();
    const session = {
      key: "12345678-1234-1234-1234-123456789030",
      viewer: "12345678-1234-1234-1234-123456789031",
      credential: "private-session-credential-for-tests-123456",
    };
    await t.mutation(componentApi.diceDemoV2.join, {
      ...session, name: "Hypatia", ready: true, uncertainty: 10,
      style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" },
    });
    const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
    const motion = {
      seed: 42, stepMs: 1000 / 60,
      samples: Array.from({ length: 301 }, () => frame).flat(),
      offsets: [0, 0, 0, 1, 0, 0, 0, 1],
    };
    const first = { ...session, id: "12345678-1234-1234-1234-123456789032", faces: [9, 10], motion };
    clock.mockReturnValue(3_000_100);
    await t.mutation(componentApi.diceDemoV2.acceptSupplied, first);
    clock.mockReturnValue(3_002_101);
    const second = { ...first, id: "12345678-1234-1234-1234-123456789033", faces: [1, 2] };
    await t.mutation(componentApi.diceDemoV2.acceptSupplied, second);
    const trackArgs = { key: session.key, viewer: session.viewer };
    const late = await t.query(componentApi.diceDemoV2.track, trackArgs);
    expect(late?.roll.id).toBe(second.id);
    expect(late?.activeRolls?.map(roll => roll.id)).toEqual([first.id, second.id]);
    expect(late?.activeRolls?.every(roll => !("motion" in roll))).toBe(true);
    const oldPath = await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: first.id });
    expect(oldPath?.roll.motion?.samples).toEqual(motion.samples);
    expect(oldPath).not.toHaveProperty("activeRolls");
    expect(await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: "unknown" })).toBeNull();
    const history = await t.query(componentApi.diceDemoV2.events, { ...session, after: 0 });
    expect(history.rolls.map(roll => roll.id)).toEqual([first.id, second.id]);
    expect(history.rolls.every(roll => !("motion" in roll))).toBe(true);

    clock.mockReturnValue(3_002_200);
    await t.mutation(componentApi.diceDemoV2.clearTray, session);
    expect(await t.query(componentApi.diceDemoV2.track, trackArgs)).toBeNull();
    expect(await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: first.id })).toBeNull();
    clock.mockReturnValue(3_002_300);
    const third = { ...first, id: "12345678-1234-1234-1234-123456789034" };
    await t.mutation(componentApi.diceDemoV2.acceptSupplied, third);
    const fresh = await t.query(componentApi.diceDemoV2.track, trackArgs);
    expect(fresh?.activeRolls?.map(roll => roll.id)).toEqual([third.id]);
    expect(await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: first.id })).toBeNull();
    expect((await t.query(componentApi.diceDemoV2.events, { ...session, after: 0 })).rolls).toHaveLength(3);
    clock.mockReturnValue(fresh!.roll.startsAt + fresh!.roll.duration + 5600);
    expect((await t.query(componentApi.diceDemoV2.track, trackArgs))?.activeRolls).toEqual([]);
    expect(await t.query(componentApi.diceDemoV2.track, { ...trackArgs, rollId: third.id })).toBeNull();
  } finally {
    clock.mockRestore();
  }
});

test("trusted supplied rolls use their server receipt time and pruned receipts fall back to presentation start", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(2_000_000);
  try {
    const t = componentBackend();
    const session = {
      key: "12345678-1234-1234-1234-123456789020",
      viewer: "12345678-1234-1234-1234-123456789021",
      credential: "private-session-credential-for-tests-123456",
    };
    await t.mutation(componentApi.diceDemoV2.join, {
      ...session, name: "Plato", ready: true, uncertainty: 10,
      style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" },
    });
    clock.mockReturnValue(2_000_100);
    const first = {
      ...session, id: "12345678-1234-1234-1234-123456789022", faces: [3, 4],
    };
    await t.mutation(componentApi.diceDemoV2.acceptSupplied, first);
    const requestedAt = await t.run(async ctx => {
      const receipt = await ctx.db.query("diceDemoV2Requests")
        .withIndex("by_request", q => q.eq("key", session.key).eq("viewer", session.viewer).eq("id", first.id))
        .unique();
      return receipt!._creationTime;
    });
    const next = { ...first, id: "12345678-1234-1234-1234-123456789023" };
    clock.mockReturnValue(Math.floor(requestedAt) + 1999);
    await expect(t.mutation(componentApi.diceDemoV2.acceptSupplied, next)).rejects.toThrow("Wait two seconds");
    clock.mockReturnValue(Math.ceil(requestedAt + 2000));
    const accepted = await t.mutation(componentApi.diceDemoV2.acceptSupplied, next);
    expect(accepted.id).toBe(next.id);
    await t.run(async ctx => {
      const receipt = await ctx.db.query("diceDemoV2Requests")
        .withIndex("by_request", q => q.eq("key", session.key).eq("viewer", session.viewer).eq("id", next.id))
        .unique();
      await ctx.db.delete(receipt!._id);
    });
    const third = { ...first, id: "12345678-1234-1234-1234-123456789024" };
    clock.mockReturnValue(accepted.startsAt + 1999);
    await expect(t.mutation(componentApi.diceDemoV2.acceptSupplied, third)).rejects.toThrow("Wait two seconds");
    clock.mockReturnValue(accepted.startsAt + 2000);
    await t.mutation(componentApi.diceDemoV2.acceptSupplied, third);
    expect((await t.query(componentApi.diceDemoV2.track, { key: session.key, viewer: session.viewer }))?.roll.id).toBe(third.id);
  } finally {
    clock.mockRestore();
  }
});
