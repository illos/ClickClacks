"use node";
import { randomInt } from "node:crypto";
import { internalAction } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { accepted, request, sessionArgs } from "../src/component/validators.js";
import { validateInput } from "../src/component/errors.js";
import { validateRequest } from "../src/dice.js";
export const roll = internalAction({
  args: { ...sessionArgs, request },
  returns: accepted,
  handler: async (ctx, args) => {
    validateInput(() => validateRequest(args.request));
    const receipt = await ctx.runQuery(
      components.powerroller.rooms.receipt,
      args,
    );
    if (receipt) return receipt;
    const values = args.request.dice.flatMap((group) =>
      Array.from({ length: group.count }, () => randomInt(1, group.sides + 1)),
    );
    return await ctx.runMutation(components.powerroller.rooms.acceptGenerated, {
      ...args,
      values,
    });
  },
});
