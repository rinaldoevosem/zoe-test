import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    // Point at a preinstalled Chromium when the bundled one isn't downloaded (e.g. sandboxed CI).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    // Throwaway database and a pinned clock make the run deterministic.
    env: { ZOE_DB: "memory", ZOE_NOW: "2026-11-16T15:00:00Z", NEXT_DIST_DIR: ".next-e2e" },
  },
});
