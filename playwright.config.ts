// SPDX-License-Identifier: MIT
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:9591/powerroller/",
    ...devices["Desktop Chrome"],
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 9591 --strictPort",
    url: "http://127.0.0.1:9591/powerroller/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
