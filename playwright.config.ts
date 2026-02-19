import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    navigationTimeout: 60000,
    actionTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
