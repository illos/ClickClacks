// SPDX-License-Identifier: MIT
import { expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { demoV2 } from "../../web/dice-demo-v2/api";
import { backend } from "./fixtures/table";

test("another roll is accepted at two seconds while the previous animation is still running, retaining both results", async () => {
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
    await t.mutation(internal.diceDemoV2.recordSample, firstSample);
    const initial = await t.mutation(demoV2.throwDice, first);
    expect(initial.duration).toBe(5000);

    clock.mockReturnValue(initial.startsAt + 1999);
    const next = {
      ...session,
      id: "12345678-1234-1234-1234-123456789013",
      faces: [2, 3],
    };
    await t.mutation(internal.diceDemoV2.recordSample, next);
    await expect(t.mutation(demoV2.throwDice, next)).rejects.toThrow("Wait two seconds");
    expect((await t.query(demoV2.track, { key: session.key, viewer: session.viewer }))?.roll.id).toBe(first.id);

    clock.mockReturnValue(initial.startsAt + 2000);
    await expect(t.mutation(demoV2.throwDice, { ...next, credential: "wrong-private-session-credential" })).rejects.toThrow("private session credential");
    await t.mutation(demoV2.throwDice, next);
    const current = await t.query(demoV2.track, { key: session.key, viewer: session.viewer });
    expect(current?.roll.id).toBe(next.id);
    expect(current?.roll.faces).toEqual([2, 3]);
    expect(Date.now()).toBeLessThan(initial.startsAt + initial.duration);

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
