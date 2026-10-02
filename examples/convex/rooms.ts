// SPDX-License-Identifier: MIT
// Copy into your app's convex/ directory after installing the component.
import { v } from 'convex/values';
import { query, action } from './_generated/server';
import { components } from './_generated/api';
export const view = query({
  args: { key: v.string() },
  returns: v.object({
    expired: v.boolean(),
    participants: v.array(v.object({
      id: v.string(), name: v.string(), slot: v.number(), ready: v.boolean(),
      uncertainty: v.number(), seenAt: v.number(),
      style: v.object({color:v.string(),ink:v.string(),pattern:v.union(v.literal('solid'),v.literal('speckle'),v.literal('marble'),v.literal('frosted')),font:v.optional(v.union(v.literal('serif'),v.literal('modern'),v.literal('rune'),v.literal('gothic')))}),
    })),
    code: v.union(v.string(),v.null()), cursor: v.optional(v.number()),
  }),
  handler: (ctx,args)=>ctx.runQuery(components.clickclacks.diceDemoV2.view,args),
});
export const clock = action({args:{},returns:v.number(),handler:async()=>Date.now()});
// Expose only the operations your app needs. Derive authenticated identity and
// private credentials in trusted host code before calling component mutations.
// The complete guest-site forwarders are in convex/diceDemo.ts and diceDemoV2.ts.
