"use node";
import { randomInt } from "node:crypto";
import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { accepted, request, sessionArgs } from "./validators.js";
import { validateRequest } from "../dice.js";
export const roll = action({
  args: { ...sessionArgs, request },
  returns: accepted,
  handler: async (ctx, args) => {
    validateRequest(args.request);
    const receipt = await ctx.runQuery(internal.rooms.receipt, args);
    if (receipt) return receipt;
    const values = args.request.dice.flatMap((group) =>
      Array.from({ length: group.count }, () => randomInt(1, group.sides + 1)),
    );
    return await ctx.runMutation(internal.rooms.acceptGenerated, {
      ...args,
      values,
    });
  },
});
