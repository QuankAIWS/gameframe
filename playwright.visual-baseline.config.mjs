import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/visual-baseline",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.001,
    },
  },
  reporter: [["line"]],
  outputDir: "test-results/visual-baseline",
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:8787",
    ...devices["Desktop Chrome"],
    reducedMotion: "reduce",
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
