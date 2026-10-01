// SPDX-License-Identifier: MIT
import { ConvexError, type Infer } from "convex/values";
import { resolveRoll, type ResolvedResult, type RollRequest } from "../dice.js";
import { result } from "./validators.js";
import { validateInput } from "./errors.js";
/** A trusted host resolves custom semantics; this verifies the immutable dice envelope. */
export function approveResolution(
  request: RollRequest,
  approved: Infer<typeof result>,
): ResolvedResult {
  const reject = (message: string): never => {
    throw new ConvexError({ code: "INVALID_RESOLUTION", message });
  };
  const custom = request.context?.ruleset;
  if (
    request.ruleset !== "sum" ||
    typeof custom !== "string" ||
    !custom.trim() ||
    custom.length > 128
  )
    return reject(
      "Custom resolutions use a sum dice envelope with a bounded context.ruleset identifier.",
    );
  const baseline = validateInput(() =>
    resolveRoll(
      request,
      approved.dice.map((die) => die.value),
    ),
  );
  if (
    approved.dice.length !== baseline.dice.length ||
    approved.dice.some((die, index) => {
      const expected = baseline.dice[index]!;
      return (
        die.id !== expected.id ||
        die.sides !== expected.sides ||
        die.value !== expected.value ||
        die.kept !== expected.kept
      );
    }) ||
    approved.naturalTotal !== baseline.naturalTotal
  )
    return reject(
      "Approved resolution must retain request dice identities, sides, values, keep policy and natural total.",
    );
  if (
    !Number.isFinite(approved.total) ||
    Math.abs(approved.total) > 1_000_000_000 ||
    !approved.summary.trim() ||
    approved.summary.length > 4096
  )
    return reject(
      "Approved totals must be finite and bounded; summaries contain 1–4096 characters.",
    );
  if (approved.tier !== undefined && ![1, 2, 3].includes(approved.tier))
    return reject(
      "Supported tier values are 1, 2 and 3. Use context for other host-specific metadata.",
    );
  return approved as ResolvedResult;
}
