import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "pc",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } }
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"], channel: "chrome" }
    }
  ]
});
