// SPDX-License-Identifier: MIT
import { ConvexError } from "convex/values";
/** Public validation failures remain actionable even when ordinary server errors are redacted. */
export function validateInput<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw new ConvexError({
      code: "INVALID_REQUEST",
      message: error instanceof Error ? error.message : "Invalid roll input.",
    });
  }
}
