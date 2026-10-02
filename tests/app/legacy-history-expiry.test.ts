// SPDX-License-Identifier: MIT
import { expect, test, vi } from "vitest";
import { api } from "../../component/_generated/api";
import { componentBackend } from "./fixtures/table";
const key = "12345678-1234-1234-1234-123456789010";
const viewer = "12345678-1234-1234-1234-123456789011";
const credential = "private-session-credential-for-tests-123456";
const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
const motion = { seed: 42, stepMs: 1000 / 60, samples: [...frame, ...frame], offsets: [0, 0, 0, 1, 0, 0, 0, 1] };
async function legacy(expiresAt?: number) {
  const t = componentBackend();
  await t.mutation(api.diceDemoV2.join, { key, viewer, credential, name: "Sappho", style: { color: "#a63a3a", ink: "#fff0dc", pattern: "solid" }, ready: true, uncertainty: 10 });
  const accepted = await t.mutation(api.diceDemoV2.acceptSupplied, { key, viewer, credential, id: "12345678-1234-1234-1234-123456789012", faces: [3, 4], motion });
  const { historyExpiresAt: _deadline, ...roll } = accepted;
  const trackId = await t.run(async ctx => {
    const track = (await ctx.db.query("diceDemoV2Tracks").withIndex("by_room_viewer", q => q.eq("key", key).eq("viewer", viewer)).unique())!;
    await ctx.db.patch(track._id, { roll, firstSequence: undefined, expiresAt });
    return track._id;
  });
  return { t, trackId, accepted, roll };
}

for (const expiry of [undefined, 1_000_000 + 86400000]) test(`cleanup physically removes stale legacy motion with expiresAt=${expiry}`, async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const { t, trackId } = await legacy(expiry);
    clock.mockReturnValue(4_600_000);
    await t.mutation(api.cleanup.expired, {});
    expect(await t.run(ctx => ctx.db.get(trackId))).toBeNull();
    expect(await t.run(ctx => ctx.db.query("diceDemoV2Presentations").withIndex("by_room_viewer", q => q.eq("key", key)).take(2))).toEqual([]);
  } finally { clock.mockRestore(); }
});

test("live legacy normalization preserves full motion and uses original request deadline", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const { t, trackId, roll } = await legacy(1_000_000 + 86400000);
    clock.mockReturnValue(1_100_000);
    await t.mutation(api.cleanup.expired, {});
    const track = await t.run(ctx => ctx.db.get(trackId));
    expect(track?.expiresAt).toBe(4_600_000);
    expect(track?.roll).toEqual({ ...roll, historyExpiresAt: 4_600_000 });
    expect(await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_history_expiry", q => q.eq("roll.historyExpiresAt", undefined)).take(8))).toEqual([]);
  } finally { clock.mockRestore(); }
});

for (const roomState of ["shortened", "expired", "orphaned"] as const) test(`legacy UUID and code reads respect ${roomState} actual room before normalization`, async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const { t, trackId } = await legacy(1_000_000 + 86400000);
    const code = (await t.query(api.diceDemoV2.view, { key })).code!;
    await t.run(async ctx => {
      const room = (await ctx.db.query("diceDemoV2Rooms").withIndex("by_key", q => q.eq("key", key)).unique())!;
      if (roomState === "orphaned") await ctx.db.delete(room._id);
      else await ctx.db.patch(room._id, { expiresAt: roomState === "shortened" ? 1_005_000 : 999_999 });
    });
    for (const alias of [key, code]) {
      const shared = await t.query(api.diceDemoV2.view, { key: alias });
      if (roomState === "shortened") expect(shared.canonicalKey).toBe(key);
      else expect(shared).not.toHaveProperty("canonicalKey");
      const metadata = await t.query(api.diceDemoV2.trackMetadata, { key: alias, viewer });
      if (roomState === "shortened") expect(metadata?.roll.historyExpiresAt).toBe(1_005_000);
      else {
        expect(metadata).toBeNull();
        expect(await t.query(api.diceDemoV2.motion, { key: alias, viewer, rollId: "12345678-1234-1234-1234-123456789012" })).toBeNull();
      }
    }
    await t.mutation(api.cleanup.expired, {});
    const track = await t.run(ctx => ctx.db.get(trackId));
    if (roomState === "shortened") expect(track?.expiresAt).toBe(1_005_000);
    else expect(track).toBeNull();
  } finally { clock.mockRestore(); }
});

test("four-row legacy normalization progresses rather than repeatedly selecting stamped rows", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  try {
    const { t, roll } = await legacy();
    await t.run(async ctx => {
      for (let i = 0; i < 8; i++) await ctx.db.insert("diceDemoV2Tracks", { key, viewer: `legacy-${i}`, roll, receipts: [] });
    });
    await t.mutation(api.cleanup.expired, {});
    expect(await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_history_expiry", q => q.eq("roll.historyExpiresAt", undefined)).take(10))).toHaveLength(5);
    await t.mutation(api.cleanup.expired, {});
    expect(await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_history_expiry", q => q.eq("roll.historyExpiresAt", undefined)).take(10))).toHaveLength(1);
    await t.mutation(api.cleanup.expired, {});
    expect(await t.run(ctx => ctx.db.query("diceDemoV2Tracks").withIndex("by_history_expiry", q => q.eq("roll.historyExpiresAt", undefined)).take(10))).toEqual([]);
  } finally { clock.mockRestore(); }
});
