import { internalMutation } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
/** Bounded batches. Tombstones survive receipt expiration until their room expires. */
export const expired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let removed = 0;
    let more = false;
    for (const table of [
      "presentation",
      "rolls",
      "members",
      "rooms",
    ] as const) {
      const docs = await ctx.db
        .query(table)
        .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
        .take(100);
      more ||= docs.length === 100;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        removed++;
      }
    }
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .take(100);
    more ||= receipts.length === 100;
    for (const receipt of receipts) {
      if (receipt.roomExpiresAt <= now) {
        await ctx.db.delete(receipt._id);
        removed++;
      } else
        await ctx.db.patch(receipt._id, {
          roll: undefined,
          expiresAt: receipt.roomExpiresAt,
        });
    }
    if (more) await ctx.scheduler.runAfter(0, internal.cleanup.expired, {});
    return removed;
  },
});
