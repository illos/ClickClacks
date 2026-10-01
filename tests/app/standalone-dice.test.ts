// SPDX-License-Identifier: MIT
import { afterEach, expect, test, vi } from "vitest";
import { backend } from "./fixtures/table";
import { demoV2 } from "../../web/dice-demo-v2/api";
import { demo } from "../../web/dice-demo/api";
import { internal } from "../../convex/_generated/api";
import type { DiceConfiguration } from "../../shared/dice";
const key = "12345678-1234-1234-1234-123456789010",
  viewer = "12345678-1234-1234-1234-123456789011",
  peer = "12345678-1234-1234-1234-123456789012";
const credential = "a-private-random-session-key-for-tests-1234",
  other = "other-private-random-session-key-tests-1234";
const style = { color: "#a63a3a", ink: "#fff0dc", pattern: "marble" as const };
const id = (n: number) =>
  `12345678-1234-1234-1234-${String(n).padStart(12, "0")}`;
async function joined() {
  const t = backend();
  await t.mutation(demoV2.join, {
    key,
    viewer,
    credential,
    name: "Hypatia",
    style,
    ready: true,
    uncertainty: 10,
  });
  return t;
}
afterEach(() => vi.useRealTimers());
test("secure sampling is bound to stable requests; headless generic rolls persist without motion and survive shared clear", async () => {
  const t = await joined(),
    dice: DiceConfiguration = { kind: "dice", sides: 6, count: 3 },
    args = { key, viewer, credential, id: id(100), dice };
  const faces = await t.action(demo.sampleFaces, args);
  expect(faces).toHaveLength(3);
  expect(faces.every((n) => n >= 1 && n <= 6 && Number.isInteger(n))).toBe(
    true,
  );
  expect(await t.action(demo.sampleFaces, args)).toEqual(faces);
  await expect(
    t.action(demo.sampleFaces, { ...args, dice: { ...dice, sides: 8 } }),
  ).rejects.toThrow("already used");
  await expect(
    t.mutation(demoV2.throwDice, {
      ...args,
      faces: faces.map((n) => (n === 6 ? 1 : n + 1)),
    }),
  ).rejects.toThrow("already used");
  const roll = await t.mutation(demoV2.throwDice, {
    ...args,
    faces,
    edges: 2,
    banes: 0,
  });
  expect(roll.power).toBeUndefined();
  expect(roll.total).toBe(faces.reduce((a, b) => a + b, 0) + 4);
  expect(roll.modifier).toBe(4);
  expect(roll.source).toBe("generated");
  expect(roll.motion).toBeUndefined();
  expect(roll.revealAt).toBe(roll.startsAt + 2200);
  expect((await t.query(demoV2.track, { key, viewer }))?.roll).toEqual(roll);
  await t.mutation(demoV2.clearTray, { key, viewer, credential });
  expect(await t.query(demoV2.track, { key, viewer })).toBeNull();
  expect(
    await t.mutation(demoV2.throwDice, { ...args, faces, edges: 2 }),
  ).toEqual(roll);
  const events = await t.query(demoV2.events, {
    key,
    viewer,
    credential,
    after: 0,
  });
  expect(events.rolls).toEqual([roll]);
  await expect(
    t.mutation(demoV2.throwDice, { ...args, faces, edges: 1 }),
  ).rejects.toThrow("already used");
});
test("public IDs cannot authorize writes, credentials are never public and shared clear retains its original scope", async () => {
  const t = await joined();
  await t.mutation(demoV2.join, {
    key,
    viewer: peer,
    credential: other,
    name: "Cicero",
    style,
    ready: true,
    uncertainty: 10,
  });
  expect(JSON.stringify(await t.query(demoV2.view, { key }))).not.toContain(
    credential,
  );
  await expect(
    t.mutation(demoV2.join, {
      key,
      viewer,
      credential: other,
      name: "Impersonator",
      style,
      ready: true,
      uncertainty: 10,
    }),
  ).rejects.toThrow("private session");
  await expect(
    t.mutation(demoV2.customize, {
      key,
      viewer,
      credential: viewer,
      name: "Impersonator",
      style,
    }),
  ).rejects.toThrow("private session");
  for (const [owner, secret, n] of [
    [viewer, credential, 200],
    [peer, other, 201],
  ] as const) {
    const args = { key, viewer: owner, credential: secret, id: id(n) };
    const faces = await t.action(demo.sampleFaces, args);
    await t.mutation(demoV2.throwDice, { ...args, faces });
  }
  await t.mutation(demoV2.clearTray, { key, viewer: peer, credential: other });
  expect(await t.query(demoV2.track, { key, viewer })).toBeNull();
  expect(await t.query(demoV2.track, { key, viewer: peer })).toBeNull();
  expect(
    (await t.query(demoV2.events, { key, viewer, credential, after: 0 })).rolls,
  ).toHaveLength(2);
});
test("expired sampling receipts reject retries after bounded cleanup rather than regenerating", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  const t = await joined(),
    args = { key, viewer, credential, id: id(300) };
  await t.action(demo.sampleFaces, args);
  vi.advanceTimersByTime(3600001);
  await t.mutation(demoV2.join, {
    key,
    viewer,
    credential,
    name: "Hypatia",
    style,
    ready: true,
    uncertainty: 10,
  });
  await t.mutation(internal.cleanup.expired, {});
  await expect(t.action(demo.sampleFaces, args)).rejects.toThrow(
    "Request expired",
  );
});
test("packed twenty-die trajectories retain all original 60Hz frames and compact catch-up excludes them", async () => {
  const t = await joined(),
    dice: DiceConfiguration = { kind: "dice", sides: 20, count: 20 },
    args = { key, viewer, credential, id: id(400), dice };
  const faces = await t.action(demo.sampleFaces, args);
  const frame = Array.from({ length: 20 }, () => [0, 1, 0, 0, 0, 0, 1]).flat(),
    values = Array.from({ length: 481 }, () => frame).flat(),
    packed = new Float64Array(values).buffer;
  const motion = {
    seed: 42,
    stepMs: 1000 / 60,
    samples: [],
    packed,
    offsets: Array.from({ length: 20 }, () => [0, 0, 0, 1]).flat(),
  };
  const roll = await t.mutation(demoV2.throwDice, { ...args, faces, motion });
  expect(roll.duration).toBeCloseTo(8000);
  const persisted = (await t.query(demoV2.track, { key, viewer }))!.roll;
  expect(persisted.motion?.packed?.byteLength).toBe(538720);
  expect(Array.from(new Float64Array(persisted.motion!.packed!))).toEqual(
    values,
  );
  expect(
    (await t.query(demoV2.events, { key, viewer, credential, after: 0 }))
      .rolls[0]?.motion,
  ).toBeUndefined();
});
test("trusted supplied results are labelled and power interpretation retains its source-derived rules", async () => {
  const t = await joined();
  const roll = await t.mutation(internal.diceDemoV2.acceptSupplied, {
    key,
    viewer,
    credential,
    id: id(500),
    faces: [7, 8],
    edges: 1,
    banes: 0,
  });
  // Compendium rule/dice/edge.md single edge +2; tier-outcome.md >=17 tier3.
  expect(roll.power).toEqual({ edges: 1, banes: 0, total: 17, tier: 3 });
  expect(roll.source).toBe("supplied");
  expect((await t.query(demoV2.track, { key, viewer }))?.roll).toEqual(roll);
  await expect(
    t.mutation(demoV2.throwDice, {
      key,
      viewer,
      credential,
      id: id(500),
      faces: [7, 8],
      edges: 1,
    }),
  ).rejects.toThrow("already used");
});

test("leaving removes only caller presence and track; room cursor and pending result archive survive", async () => {
  const t = await joined();
  const dice: DiceConfiguration = {kind:"dice",sides:4,count:1};
  const args = {key,viewer,credential,id:id(400),dice};
  const faces = await t.action(demo.sampleFaces,args);
  await t.mutation(demoV2.throwDice,{...args,faces});
  await t.mutation(demoV2.join,{key,viewer:peer,credential:other,name:"Livia",style,ready:true,uncertainty:10});
  await t.mutation(demoV2.leave,{key,viewer,credential});
  const room = await t.query(demoV2.view,{key});
  expect(room.participants.map(p=>p.id)).toEqual([peer]);
  expect(room.cursor).toBe(1);
  expect(await t.query(demoV2.track,{key,viewer})).toBeNull();
  const events = await t.query(demoV2.events,{key,viewer:peer,credential:other,after:0});
  expect(events.rolls.map(r=>r.id)).toEqual([args.id]);
  await expect(t.mutation(demoV2.clearTray,{key,viewer,credential})).rejects.toThrow("credential");
});
