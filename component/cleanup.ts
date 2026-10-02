// SPDX-License-Identifier: MIT
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { updateActivity } from "./lib/activity";
export const expired = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let count = 0,
      more = false;
    // Normalize pre-upgrade full-motion rows in bounded, progressing batches.
    // Optional legacy expiresAt could otherwise leave a recording indefinitely.
    // Share the 16 MiB read budget with room deletion and expiry: at most 26
    // max-packed V2 paths (565,656 bytes each), plus one old V1 document that
    // could contain a full 1 MiB packed payload, still leaves metadata headroom.
    const legacyTracks = await ctx.db.query("diceDemoV2Tracks")
      .withIndex("by_history_expiry", q => q.eq("roll.historyExpiresAt", undefined)).take(2);
    more ||= legacyTracks.length === 2;
    for (const track of legacyTracks) {
      const room = await ctx.db.query("diceDemoV2Rooms")
        .withIndex("by_key", q => q.eq("key", track.key)).unique();
      const request = await ctx.db.query("diceDemoV2Requests")
        .withIndex("by_request", q => q.eq("key", track.key).eq("viewer", track.viewer).eq("id", track.roll.id)).unique();
      const expiresAt = Math.min(room?.expiresAt ?? 0, track.expiresAt ?? Infinity,
        request?.roll ? (request.roll.historyExpiresAt ?? request.expiresAt) : track.roll.startsAt + 3600000);
      if (expiresAt <= now) {
        await ctx.db.delete(track._id);
        count++;
      } else await ctx.db.patch(track._id, {
        roll: { ...track.roll, historyExpiresAt: expiresAt }, expiresAt,
      });
    }
    for (const table of [
      "diceDemoV2Rooms",
      "diceDemoV2Tracks",
      "diceDemoV2Presentations",
      "diceDemoV2Sessions",
      "diceDemoV2PlaybackReceipts",
      "diceDemoRooms",
    ] as const) {
      const docs = await ctx.db
        .query(table)
        .withIndex("by_expiry", (q) =>
          q.gt("expiresAt", 0).lte("expiresAt", now),
        )
        .take(
          table === "diceDemoV2Rooms" || table === "diceDemoRooms"
            ? 1
            : (table === "diceDemoV2Tracks" || table === "diceDemoV2Presentations")
              ? 8
              : 100,
        );
      more ||=
        docs.length ===
        (table === "diceDemoV2Rooms" || table === "diceDemoRooms"
          ? 1
          : (table === "diceDemoV2Tracks" || table === "diceDemoV2Presentations")
            ? 8
            : 100);
      for (const doc of docs) {
        if (table === "diceDemoV2Rooms") {
          const room = await ctx.db.get(doc._id as import("./_generated/dataModel").Id<"diceDemoV2Rooms">);
          if (room) await updateActivity(ctx, room, [], now);
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
          fingerprint: undefined,
          faces: [],
          expiresAt: receipt.roomExpiresAt,
        });
    }
    if (more) await ctx.scheduler.runAfter(0, api.cleanup.expired, {});
    return count;
  },
});
