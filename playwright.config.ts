import { defineConfig, devices } from "@playwright/test";

// A real, checked-in e2e suite — not throwaway scratch scripts. Assumes
// `npm run dev` is already running on :3000 (webServer is left unset on
// purpose: this repo's dev server is usually already up during a
// session, and auto-starting a second one on the same port just
// collides). Run with `npx playwright test`.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false, // most specs share seeded accounts/state — parallel runs would race each other
  // This suite runs against a real, shared, live dev database — not an
  // isolated per-run fixture. workers: 1 is load-bearing, not just an
  // optimization: without it, Playwright still parallelizes ACROSS spec
  // files (fullyParallel only controls within-file ordering), so e.g.
  // employee-deactivation.spec.ts deactivating/reactivating a seeded
  // employee races directly against overview.spec.ts reading that same
  // employee's count in a different worker.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});
