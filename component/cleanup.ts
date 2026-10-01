// SPDX-License-Identifier: MIT
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
export const expired = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let count = 0,
      more = false;
    for (const table of [
      "diceDemoV2Rooms",
      "diceDemoV2Tracks",
      "diceDemoV2Presentations",
      "diceDemoV2Sessions",
    ] as const) {
      const docs = await ctx.db
        .query(table)
        .withIndex("by_expiry", (q) =>
          q.gt("expiresAt", 0).lte("expiresAt", now),
        )
        .take(
          table === "diceDemoV2Rooms"
            ? 1
            : (table === "diceDemoV2Tracks" || table === "diceDemoV2Presentations")
              ? 8
              : 100,
        );
      more ||=
        docs.length ===
        (table === "diceDemoV2Rooms"
          ? 1
          : (table === "diceDemoV2Tracks" || table === "diceDemoV2Presentations")
            ? 8
            : 100);
      for (const doc of docs) {
        if (table === "diceDemoV2Rooms") {
          const tracks = await ctx.db
            .query("diceDemoV2Tracks")
            .withIndex("by_room_viewer", (q) => q.eq("key", doc.key))
            .take(8);
          for (const track of tracks) await ctx.db.delete(track._id);
        }
        await ctx.db.delete(doc._id);
        count++;
      }
    }
    const receipts = await ctx.db
      .query("diceDemoV2Requests")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .take(10);
    more ||= receipts.length === 10;
    for (const receipt of receipts) {
      if (receipt.roomExpiresAt <= now) {
        await ctx.db.delete(receipt._id);
        count++;
      } else
        await ctx.db.patch(receipt._id, {
          roll: undefined,
          faces: [],
          expiresAt: receipt.roomExpiresAt,
        });
    }
    if (more) await ctx.scheduler.runAfter(0, api.cleanup.expired, {});
    return count;
  },
});
