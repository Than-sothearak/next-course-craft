import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/browser",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.TEST_APP_ORIGIN, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
});
