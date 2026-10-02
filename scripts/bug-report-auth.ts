// SPDX-License-Identifier: MIT
import { createHmac } from "node:crypto";

// The broker's Cloudflare credential remains canonical. Distinct derived
// credentials restrict what the support API receives and permit reprovisioning.
export function deriveSupportToken(
  cloudflareToken: string,
  role: "read" | "write" | "rate-salt",
) {
  if (cloudflareToken.length < 32)
    throw new Error("A broker-provided Cloudflare credential is required.");
  return createHmac("sha256", cloudflareToken)
    .update(`clickclacks-app:bug-reports:v1:${role}`)
    .digest("hex");
}
