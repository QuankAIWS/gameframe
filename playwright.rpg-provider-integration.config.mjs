import { defineConfig, devices } from "@playwright/test";

if (!process.env.RPG_GM_RUNTIME_ROOT?.trim()) {
  throw new Error("RPG_GM_RUNTIME_ROOT must point to a checked-out rpg-gm-runtime repository.");
}

const browserPort = process.env.GAMEFRAME_RPG_PROVIDER_BROWSER_PORT?.trim() || "18887";
const browserOrigin = `http://127.0.0.1:${browserPort}`;

export default defineConfig({
  testDir: "./test/rpg-integration",
  testMatch: "**/*.provider.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["line"]],
  outputDir: "test-results/rpg-provider-integration",
  use: {
    baseURL: browserOrigin,
    ...devices["Desktop Chrome"],
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "node --experimental-strip-types scripts/run-rpg-provider-browser-integration-stack.mjs",
    url: `${browserOrigin}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
