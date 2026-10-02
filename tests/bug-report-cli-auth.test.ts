// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from "vitest";
import { runBugs } from "../scripts/bugs";
import { deriveSupportToken } from "../scripts/bug-report-auth";

const fixture = "fixture-cloudflare-token-not-a-secret-123456";
const reader = "060594d5f1da89060567d36b04f6fb1c6286431e7f09f62a8f8d2d1a2f7a6ede";
function brokerEnv() {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", fixture);
  vi.stubEnv("BUG_REPORT_READ_TOKEN", undefined);
  vi.stubEnv("BUG_REPORT_WRITE_TOKEN", undefined);
  vi.stubEnv("CLICKCLACKS_SUPPORT_URL", undefined);
}
afterEach(() => vi.unstubAllEnvs());

it("uses distinct reproducible role credentials and sends only the reader to production", async () => {
  brokerEnv();
  // Fixed vectors computed independently with Python's hmac/hashlib.
  expect(deriveSupportToken(fixture, "read")).toBe(reader);
  expect(deriveSupportToken(fixture, "write")).toBe("7d8ae4120691e7408cd13af23c3fa9e2f1ad0b11e449fb0d6f23c6cc79272ad5");
  expect(deriveSupportToken(fixture, "rate-salt")).toBe("61a6364fcf3152ae34842a1b541fabaf6bc0421e73bd6e8e7f2a0defda6f0d97");
  const request = vi.fn<typeof fetch>(async () => Response.json({ reports: [] }));
  await expect(runBugs(["list"], request)).resolves.toEqual({ reports: [] });
  expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(`Bearer ${reader}`);
});

it("never derives credentials for an alternate origin or staff write commands", async () => {
  brokerEnv();
  const request = vi.fn<typeof fetch>(async () => Response.json({}));
  for (const url of ["https://app.clickclacks.app", "https://other.example", "https://dice.clickclacks.app:444", "http://localhost:9695"])
    await expect(runBugs(["list", "--url", url], request)).rejects.toThrow("BUG_REPORT_READ_TOKEN");
  await expect(runBugs(["submit"], request)).rejects.toThrow("BUG_REPORT_WRITE_TOKEN");
  expect(request).not.toHaveBeenCalled();
});

it("honors explicit reader tokens and refuses requests without any credential", async () => {
  brokerEnv();
  vi.stubEnv("BUG_REPORT_READ_TOKEN", "explicit-reader-token-not-a-secret-123456");
  const request = vi.fn<typeof fetch>(async () => Response.json({ reports: [] }));
  await runBugs(["list", "--url", "http://localhost:9695"], request);
  expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer explicit-reader-token-not-a-secret-123456");
  vi.stubEnv("BUG_REPORT_READ_TOKEN", undefined);
  vi.stubEnv("CLOUDFLARE_API_TOKEN", undefined);
  await expect(runBugs(["list"], request)).rejects.toThrow("BUG_REPORT_READ_TOKEN");
  expect(request).toHaveBeenCalledTimes(1);
});
