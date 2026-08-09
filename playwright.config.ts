import { defineConfig, devices } from '@playwright/test'

// CI_E2E_PROD=1 boots a production server (next build + next start) instead of
// the dev server. Prod page loads are ~1-2s vs 10-16s lazy dev compiles, which
// is what lets the 288-test E2E job fit inside the GitHub Actions timeout.
// Local runs keep the dev server (fast boot, hot reload).
const useProd = process.env.CI_E2E_PROD === 'true'
// CI_E2E_SKIP_BUILD=true means the .next build artifact was already restored
// (uploaded by the `build` job) — start it directly instead of rebuilding.
const skipBuild = process.env.CI_E2E_SKIP_BUILD === 'true'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: 'e2e-results' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    // E2E_STANDALONE (2026-08-09): the build uses `output: 'standalone'`, and
    // `next start` is unsupported there — Next prints a warning and the edge
    // middleware (auth redirects, CSRF, rate limits, CSP) is not served, so
    // protected routes render for unauthenticated users. Run the standalone
    // server like production does (node .next/standalone/server.js), after
    // copying public/ and .next/static beside it.
    command: useProd
      ? (skipBuild
        ? 'cp -r public .next/standalone/public 2>/dev/null || true; cp -r .next/static .next/standalone/.next/static 2>/dev/null || true; PORT=3099 node .next/standalone/server.js'
        : 'npx next build && cp -r public .next/standalone/public 2>/dev/null || true; cp -r .next/static .next/standalone/.next/static 2>/dev/null || true; PORT=3099 node .next/standalone/server.js')
      : 'npx next dev -p 3099',
    port: 3099,
    reuseExistingServer: true,
    // Prod path must cover the full next build (~5-10 min) before the port opens.
    timeout: useProd ? 900_000 : 120_000,
  },
})
