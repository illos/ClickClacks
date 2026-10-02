// SPDX-License-Identifier: MIT
import { expect, test, vi } from "vitest";
import { api } from "../../component/_generated/api";
import { api as hostApi } from "../../convex/_generated/api";
import { componentBackend, backend } from "./fixtures/table";
const key = "12345678-1234-1234-1234-123456789010";
const viewer = "12345678-1234-1234-1234-123456789011";
const credential = "private-session-credential-for-tests-123456";
const session = { key, viewer, credential };
const join = { ...session, name: "Sappho", style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" as const }, ready: true, uncertainty: 10 };
const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
const motion = { seed: 42, stepMs: 1000 / 60, samples: [...frame, ...frame], offsets: [0, 0, 0, 1, 0, 0, 0, 1] };
const roll = { ...session, id: "12345678-1234-1234-1234-123456789012", faces: [3, 4], motion };

test("compact metadata and isolated receipts preserve immutable motion and legacy reads", async () => {
  const t = componentBackend();
  await t.mutation(api.diceDemoV2.join, join);
  const accepted = await t.mutation(api.diceDemoV2.acceptSupplied, roll);
  const before = await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer", q => q.eq("key", key).eq("viewer", viewer)).unique());
  expect(before?.roll).not.toHaveProperty("motion");
  const metadata = await t.query(api.diceDemoV2.trackMetadata, { key, viewer });
  expect(metadata?.roll).not.toHaveProperty("motion");
  expect(metadata?.roll.faces).toEqual([3, 4]);
  expect(await t.query(api.diceDemoV2.motion, { key, viewer, rollId: roll.id })).toEqual({ ...motion, version: 1 });
  const sample = { viewer, roll: roll.id, firstFrame: accepted.startsAt, revealFrame: accepted.revealAt!, uncertainty: 10, frames: 2, maxFrameGap: 17 };
  await t.mutation(api.diceDemoV2.receipt, { key, credential, roller: viewer, sample });
  await t.mutation(api.diceDemoV2.receipt, { key, credential, roller: viewer, sample: { ...sample, frames: 3 } });
  await t.mutation(api.diceDemoV2.receipt, { key, credential, roller: viewer, sample: { ...sample, frames: 0 } });
  const after = await t.run(ctx => ctx.db.get(before!._id));
  expect(after).toEqual(before);
  expect((await t.query(api.diceDemoV2.track, { key, viewer }))?.roll).toEqual(accepted);
  expect((await t.query(api.diceDemoV2.trackMetadata, { key, viewer }))?.receipts).toEqual([{ ...sample, frames: 3 }]);
  expect(await t.run(ctx => ctx.db.query("diceDemoV2PlaybackReceipts").withIndex("by_roll_viewer", q => q.eq("key", key)).take(2))).toHaveLength(1);
  await t.mutation(api.diceDemoV2.clearTray, session);
  expect(await t.query(api.diceDemoV2.trackMetadata, { key, viewer })).toBeNull();
  expect(await t.query(api.diceDemoV2.motion, { key, viewer, rollId: roll.id })).toBeNull();
  expect(await t.mutation(api.diceDemoV2.acceptSupplied, roll)).toEqual(accepted);
  expect(await t.query(api.diceDemoV2.trackMetadata, { key, viewer })).toBeNull();
});

test("history expiry starts at sampling, prunes current paths and leaves a non-resampling tombstone", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const t = componentBackend();
    await t.mutation(api.diceDemoV2.join, join);
    const { motion: _motion, ...sample } = roll;
    await t.mutation(api.diceDemoV2.recordSample, sample);
    clock.mockReturnValue(1_005_000);
    const accepted = await t.mutation(api.diceDemoV2.throwDice, roll);
    expect(accepted.historyExpiresAt).toBe(4_600_000);
    clock.mockReturnValue(4_600_000);
    await t.mutation(api.diceDemoV2.join, join);
    expect(await t.query(api.diceDemoV2.track, { key, viewer })).toBeNull();
    expect(await t.query(api.diceDemoV2.trackMetadata, { key, viewer })).toBeNull();
    expect(await t.query(api.diceDemoV2.motion, { key, viewer, rollId: roll.id })).toBeNull();
    await expect(t.query(api.diceDemoV2.events, { ...session, after: 0 })).rejects.toThrow("CURSOR_EXPIRED");
    await t.mutation(api.cleanup.expired, {});
    const retained = await t.run(async ctx => ({
      tracks: await ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer", q => q.eq("key", key)).take(2),
      presentations: await ctx.db.query("diceDemoV2Presentations").withIndex("by_room_viewer", q => q.eq("key", key)).take(2),
      request: await ctx.db.query("diceDemoV2Requests").withIndex("by_request", q => q.eq("key", key).eq("viewer", viewer).eq("id", roll.id)).unique(),
      room: await ctx.db.query("diceDemoV2Rooms").withIndex("by_key", q => q.eq("key", key)).unique(),
    }));
    expect(retained.tracks).toEqual([]);
    expect(retained.presentations).toEqual([]);
    expect(retained.request?.faces).toEqual([]);
    expect(retained.request?.roll).toBeUndefined();
    expect(retained.request?.fingerprint).toBeUndefined();
    expect(retained.room?.requestCount).toBe(1);
    await expect(t.mutation(api.diceDemoV2.recordSample, sample)).rejects.toThrow("Request expired");
  } finally { clock.mockRestore(); }
});

for (const form of ["uuid", "code", "normalized"] as const) test(`leave via ${form} removes the canonical persisted track`, async () => {
  const t = componentBackend();
  await t.mutation(api.diceDemoV2.join, join);
  await t.mutation(api.diceDemoV2.acceptSupplied, roll);
  const code = (await t.query(api.diceDemoV2.view, { key })).code!;
  expect((await t.query(api.diceDemoV2.view, { key: ` ${code.toLowerCase()} ` })).canonicalKey).toBe(key);
  await t.mutation(api.diceDemoV2.leave, { ...session, key: form === "uuid" ? key : form === "code" ? code : ` ${code.toLowerCase()} ` });
  expect(await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer", q => q.eq("key", key)).take(2))).toEqual([]);
});

test("bounded expiry cleans legacy rooms without removing live ones", async () => {
  const t = componentBackend();
  await t.run(async ctx => {
    await ctx.db.insert("diceDemoRooms", { key: "expired", expiresAt: Date.now() - 1, viewers: [], roll: null, receipts: [] });
    await ctx.db.insert("diceDemoRooms", { key: "live", expiresAt: Date.now() + 3600000, viewers: [], roll: null, receipts: [] });
  });
  await t.mutation(api.cleanup.expired, {});
  expect(await t.run(ctx => ctx.db.query("diceDemoRooms").withIndex("by_key", q => q.eq("key", "expired")).unique())).toBeNull();
  expect(await t.run(ctx => ctx.db.query("diceDemoRooms").withIndex("by_key", q => q.eq("key", "live")).unique())).not.toBeNull();
});

test("host clock directly returns server time", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_234_567);
  try { expect(await backend().action(hostApi.diceDemo.clock, {})).toBe(1_234_567); }
  finally { clock.mockRestore(); }
});
