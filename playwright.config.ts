import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'fs'

// Load .env (Next.js convention) so specs can mint session cookies with the
// same AUTH_SECRET the dev server uses. Vars already in the process env (CI
// sets them explicitly on the workflow step) win; only missing ones are set.
// Kept dependency-free: dotenv is only a transitive dep of Next.js. Values are
// trimmed (dotenv behavior) — the local .env is CRLF with trailing spaces.
if (existsSync('.env')) {
  for (const rawLine of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

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
  // E2E_FAST (2026-08-12): suite is green — one retry is enough safety
  // margin; halves the worst-case cost of a flaky shard.
  retries: process.env.CI ? 1 : 0,
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
      // NAV_MOBILE_SKIP (2026-08-13): navigation-pages.spec.ts is 47
      // viewport-agnostic "route loads / SEO meta / 404" checks — the mobile
      // re-run re-cold-compiles all 46 routes (~2 min of G1's wall time).
      // Responsive coverage lives in responsive-a11y.spec.ts; drop the
      // duplicate here.
      testIgnore: /navigation-pages\.spec\.ts/,
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
