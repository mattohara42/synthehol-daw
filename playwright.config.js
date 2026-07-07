import { defineConfig, devices } from '@playwright/test';

// Local-only smoke suite (see docs/brainstorms/2026-07-07-playwright-smoke-
// test-requirements.md) — proves things a Node-environment Vitest run
// structurally can't: real rendering/visibility, the AudioContext user-
// gesture rule, and actual canvas pixel output. Not wired into CI yet (none
// exists in this repo); run manually via `npm run test:e2e`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This environment's @playwright/test version (see package.json)
        // expects a newer bundled Chromium revision than what's
        // pre-installed in the sandbox. Point at the pre-installed browser
        // explicitly instead of triggering a download — see the repo's
        // system-prompt note on PLAYWRIGHT_BROWSERS_PATH. On a machine
        // where `npx playwright install chromium` has been run normally,
        // this override is unnecessary but harmless to remove.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
