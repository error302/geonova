#!/usr/bin/env node
/**
 * axe-sweep.mjs — multi-page axe-core WCAG sweep.
 *
 * Scans every tool page (/tools/*), the fieldbook, and the admin pages with
 * axe-core (WCAG 2.0/2.1/2.2 A+AA), prints a per-page violation table, writes
 * a markdown report, and optionally enforces a CI ratchet (exit code 1 on
 * any regression).
 *
 * Usage:
 *   node scripts/axe-gnss-scan.mjs                          # full sweep, all routes
 *   node scripts/axe-gnss-scan.mjs --paths gnss             # only routes containing "gnss"
 *   node scripts/axe-gnss-scan.mjs --json                   # machine-readable stdout
 *   node scripts/axe-gnss-scan.mjs --report out/axe.md      # custom report path
 *   node scripts/axe-gnss-scan.mjs --login                  # authenticate (needed for /fieldbook, /admin)
 *
 * CI mode:
 *   node scripts/axe-gnss-scan.mjs --ci --fail-on serious --baseline .axe-baseline.json
 *   node scripts/axe-gnss-scan.mjs --write-baseline .axe-baseline.json   # snapshot current state
 *
 * Flags:
 *   --paths a,b,c        Only scan routes whose path contains any of these substrings
 *   --paths-from-changed [base]  Only scan routes whose source files changed vs `base`
 *                        (default: HEAD = uncommitted working-tree changes). Page
 *                        files map to their route; route-dir siblings map to that
 *                        route; shared components/lib/hooks map to routes that import
 *                        them (via basename grep). Global files (globals.css, any
 *                        layout.tsx, middleware, src/components/layout/*) force the
 *                        full sweep. Overrides --paths.
 *   --exclude a,b,c      Skip routes whose path contains any of these substrings
 *   --concurrency N      Pages scanned in parallel (default 4)
 *   --no-prewarm         Skip the warm-up pass (each route is loaded once
 *                        before scanning to force cold-compile — the classic
 *                        cause of false hydrate-failed on fresh CI servers)
 *   --login              Log in first (auto-enabled when a protected route is scanned)
 *   --ci                 Exit 1 on any violation at/above --fail-on OR any baseline regression
 *   --fail-on impact     Threshold: minor | moderate | serious | critical (default serious);
 *                        use `minor` for a hard gate that fails on ANY violation
 *   --no-baseline        Skip the baseline ratchet entirely (pure --fail-on gate;
 *                        requires no .axe-baseline.json to exist)
 *   --baseline path      Baseline JSON for the ratchet (default .axe-baseline.json)
 *   --write-baseline path  Snapshot current rule counts to a baseline and exit
 *   --report path        Markdown report file (default axe-sweep-report.md)
 *   --json               Dump full results as JSON to stdout
 *
 * Requires the Next.js dev server (default http://localhost:3100, override via
 * AXE_SCAN_PORT env — NOT PORT, which the Freebuff shell hijacks).
 */
import { chromium } from 'playwright'
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// axe-core ships its browser bundle at axe.min.js (no 'exports' map, so we
// resolve via the package root and read the file ourselves).
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

// NB: use a dedicated env var, NOT process.env.PORT — the Freebuff desktop
// shell sets PORT=53757 in this environment, which would silently redirect
// the scan to the shell server instead of our dev server.
const BASE = process.env.AXE_SCAN_PORT ? `http://localhost:${process.env.AXE_SCAN_PORT}` : 'http://localhost:3100'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 }
const IMPACTS = ['minor', 'moderate', 'serious', 'critical']

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const has = (name) => process.argv.includes(name)
// Gather ALL occurrences of a flag so `--paths a --paths b` unions like `--paths a,b`.
const csv = (name) => {
  const values = []
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === name) values.push(process.argv[i + 1])
  }
  return values.flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean)
}

const JSON_OUT = has('--json')
const CI_MODE = has('--ci')
const NO_BASELINE = has('--no-baseline')
// Cold dev-server compile is the classic source of false hydrate-failed
// results: Next compiles a route on first request, and under --concurrency 6
// the heavy pages can exceed the 45s hydration deadline (observed: land-law,
// machine-control). Pre-warming every route once (browser hits each page,
// pulling SSR + client chunks) makes the real scan run against warm routes.
// Skip with --no-prewarm (fast local single-route debug).
const NO_PREWARM = has('--no-prewarm')
const DO_LOGIN = has('--login')
const WRITE_BASELINE = arg('--write-baseline', null)
const BASELINE_PATH = arg('--baseline', '.axe-baseline.json')
const REPORT_PATH = arg('--report', 'axe-sweep-report.md')
const FAIL_ON = arg('--fail-on', 'serious')
const CONCURRENCY = Math.max(1, parseInt(arg('--concurrency', '4'), 10) || 4)
const PATH_FILTERS = csv('--paths')
const EXCLUDES = csv('--exclude')
const PATHS_FROM_CHANGED = has('--paths-from-changed')
// Base is only the token after the flag when it's a real value (not another
// flag) — otherwise a bare `--paths-from-changed` mid-command would swallow
// the next flag (e.g. --no-baseline) as its base.
const PFC_IDX = process.argv.indexOf('--paths-from-changed')
const PFC_NEXT = PFC_IDX >= 0 ? process.argv[PFC_IDX + 1] : undefined
const CHANGED_BASE = PFC_NEXT && !PFC_NEXT.startsWith('--') ? PFC_NEXT : 'HEAD'
if (!IMPACTS.includes(FAIL_ON)) {
  console.error(`[axe] unknown --fail-on impact "${FAIL_ON}" (expected one of ${IMPACTS.join(' | ')})`)
  process.exit(2)
}

// ---------------------------------------------------------------------------
// Route discovery from the filesystem
// ---------------------------------------------------------------------------
function walkPages(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      // Skip dynamic segments ([param]) — they need a real id to render.
      if (!/^\[/.test(entry)) walkPages(full, acc)
    } else if (entry === 'page.tsx') {
      // Skip redirect-stub pages: a page.tsx whose only job is
      // redirect('/elsewhere') renders no UI, so a11y-scanning it is
      // meaningless and flakes (the redirect destroys the axe context —
      // observed on /tools/land-law -> /land-law). Detection: the file
      // contains a redirect(...) call and has no JSX at all.
      let src = ''
      try { src = readFileSync(full, 'utf8') } catch { /* unreadable */ }
      if (src.includes('redirect(') && !src.includes('<')) {
        continue
      }
      // src/app/tools/foo/page.tsx -> /tools/foo ; src/app/tools/page.tsx -> /tools
      const rel = dir.replace(/^src[\\/]app/, '').split(sep).join('/')
      acc.push(rel || '/')
    }
  }
  return acc
}

const TOOLS_PAGES = walkPages('src/app/tools')
  .map((p) => ({ path: p === '/' ? '/tools' : p, protected: false }))
  .sort((a, b) => a.path.localeCompare(b.path))

// Protected routes come from middleware.ts protectedPaths; these are scanned
// only when --login succeeds (or auto-login is attempted).
const PROTECTED_PAGES = [
  { path: '/fieldbook', protected: true },
  { path: '/admin', protected: true },
  { path: '/admin/payments', protected: true },
  { path: '/admin/users', protected: true },
]

// ---------------------------------------------------------------------------
// --paths-from-changed: map git-changed source files to the routes they touch
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process'

// Files that can change any page's rendering -> cannot narrow, full sweep.
const GLOBAL_FILES = new Set(['middleware.ts'])
function isGlobal(file) {
  if (GLOBAL_FILES.has(file)) return true
  if (/[\\/]globals\.css$/.test(file)) return true
  if (/[\\/]layout\.tsx$/.test(file)) return true
  if (/^src[\\/]components[\\/]layout[\\/]/.test(file)) return true
  return false
}

// src/app/tools/foo/page.tsx | sibling.tsx -> /tools/foo
function routeFromAppFile(file) {
  const m = file.match(/^src[\\/]app[\\/](.+)$/)
  if (!m) return null
  const parts = m[1].split(/[\\/]/)
  parts.pop() // drop the file name, keep the route dir
  const route = '/' + parts.join('/')
  return route === '//' ? '/' : route
}

// Non-recursive: page.tsx + same-dir siblings can import a shared component.
function routeSourceFiles() {
  const map = {}
  for (const r of ROUTES) {
    const dir = 'src/app' + r.path
    let files = []
    try {
      files = readdirSync(dir)
        .filter((f) => /\.(tsx|ts)$/.test(f))
        .map((f) => join(dir, f))
    } catch { /* route dir missing */ }
    map[r.path] = files
  }
  return map
}

function changedRoutes(base, fileList) {
  let changed = fileList
  if (!changed) {
    try {
      const diffRef = base === 'HEAD' ? 'HEAD' : `${base}...HEAD`
      // execFileSync (NOT execSync): the argv array form is only supported by
      // execFileSync — execSync treats an array as options, prints git usage,
      // and throws "Command failed: git" every time, silently forcing CI to
      // the full sweep. No shell is involved, so a malicious/odd base value
      // can never be interpreted as shell commands (defense in depth — base
      // is a CLI flag, but CI runs with a hardcoded ref).
      changed = execFileSync('git', ['diff', '--name-only', diffRef], { encoding: 'utf8' })
        .split('\n').map((s) => s.trim()).filter(Boolean)
    } catch (e) {
      console.error(`[axe] --paths-from-changed: git diff failed (${e.message.split('\n')[0]}) — falling back to full sweep`)
      return null
    }
  }
  if (!changed.length) {
    console.error(`[axe] --paths-from-changed: no changed files vs ${base} — falling back to full sweep`)
    return null
  }
  const routeFiles = routeSourceFiles()
  const routes = new Set()
  const notes = []
  for (const file of changed) {
    if (!/\.(tsx|ts|css|mjs|js)$/.test(file)) continue
    if (isGlobal(file)) {
      notes.push(`${file}: global change → full sweep`)
      console.error(`[axe]   ${notes[notes.length - 1]}`)
      return null
    }
    const direct = routeFromAppFile(file)
    if (direct) {
      if (ROUTES.some((r) => r.path === direct)) {
        routes.add(direct)
        notes.push(`${file} → ${direct}`)
      } else {
        // Nested app-dir file (e.g. src/app/tools/foo/components/Bar.tsx or
        // src/app/tools/foo/utils/x.ts): its nearest ancestor that IS a scanned
        // route (e.g. /tools/foo) renders it. Walk up the dir chain; only fall
        // back to the full sweep if no ancestor is a scanned route — silently
        // skipping here would let a PR bypass the gate for that page.
        let ancestor = direct
        let found = false
        while (ancestor !== '/' && ancestor.length > 1) {
          const parent = ancestor.slice(0, ancestor.lastIndexOf('/')) || '/'
          if (ROUTES.some((r) => r.path === parent)) {
            routes.add(parent)
            notes.push(`${file} → ${parent} (nested under ${direct})`)
            found = true
            break
          }
          ancestor = parent
        }
        if (!found) {
          notes.push(`${file}: ${direct} has no scanned ancestor route — full sweep`)
          console.error(`[axe]   ${notes[notes.length - 1]}`)
          return null
        }
      }
      continue
    }
    // Shared file: find routes whose source imports it (basename match).
    const symbol = file.split(/[\\/]/).pop().replace(/\.(tsx|ts)$/, '')
    const matched = new Set()
    for (const [route, files] of Object.entries(routeFiles)) {
      for (const rf of files) {
        try {
          if (readFileSync(rf, 'utf8').includes(symbol)) { matched.add(route); break }
        } catch { /* unreadable */ }
      }
    }
    if (matched.size) {
      for (const r of matched) routes.add(r)
      notes.push(`${file} → ${matched.size} route(s)`)
    } else {
      notes.push(`${file}: shared with no direct page importer → full sweep`)
      console.error(`[axe]   ${notes[notes.length - 1]}`)
      return null
    }
  }
  if (!routes.size) {
    console.error(`[axe] --paths-from-changed: changed files map to no scanned routes — falling back to full sweep`)
    return null
  }
  for (const n of notes) console.error(`[axe]   ${n}`)
  return routes
}

let ROUTES = [...TOOLS_PAGES, ...PROTECTED_PAGES]
if (PATHS_FROM_CHANGED) {
  if (PATH_FILTERS.length) console.error('[axe] note: --paths ignored — --paths-from-changed overrides it')
  const mapped = changedRoutes(CHANGED_BASE)
  if (mapped && mapped.size) {
    ROUTES = ROUTES.filter((r) => mapped.has(r.path))
  } else {
    // No route-affecting changes (tests/docs/infra only) or global files →
    // conservative full sweep so the a11y gate never silently skips pages.
    console.error(mapped ? `[axe] --paths-from-changed: no route-affecting files vs ${CHANGED_BASE} — falling back to full sweep` : '')
  }
}
if (PATH_FILTERS.length && !PATHS_FROM_CHANGED) ROUTES = ROUTES.filter((r) => PATH_FILTERS.some((f) => r.path.includes(f)))
if (EXCLUDES.length) ROUTES = ROUTES.filter((r) => !EXCLUDES.some((f) => r.path.includes(f)))
if (ROUTES.length === 0) {
  console.error('[axe] no routes matched the given --paths/--exclude filters')
  process.exit(2)
}
const NEEDS_AUTH = ROUTES.some((r) => r.protected)
const LOGIN = DO_LOGIN || NEEDS_AUTH

// Per-route hydration hints: a control that only exists after React mounts.
// Generic fallback: body text + interactive elements. Known-heavy pages get an
// explicit selector so the sweep doesn't scan a blank splash.
const HYDRATION_HINTS = {
  '/tools/gnss-observation-log': 'input[aria-label="Point ID"]',
  '/tools/gnss': 'input#name',
}

// ---------------------------------------------------------------------------
// Login (shared browser context so the session cookie persists across pages)
// ---------------------------------------------------------------------------
// Defaults match the seeded dev test user (scripts/seed-test-surveyor.ts).
const AUTH_USER = process.env.AXE_USER || 'test.surveyor@metardu.com'
const AUTH_PASS = process.env.AXE_PASS || 'TestPassword123!'

async function login(context) {
  const page = await context.newPage()
  console.error(`[axe] logging in as ${AUTH_USER}…`)
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForSelector('#login-email', { timeout: 30000 })
    // Hydration settle: the email/password inputs are controlled components;
    // filling before React attaches gets the values reset on re-render. Wait
    // for the page to settle, fill, then verify the values stuck.
    await page.waitForTimeout(2500)
    await page.fill('#login-email', AUTH_USER)
    await page.fill('#login-password', AUTH_PASS)
    const emailVal = await page.inputValue('#login-email').catch(() => '')
    if (emailVal !== AUTH_USER) {
      // React reset the field — retry once after a longer settle.
      await page.waitForTimeout(2000)
      await page.fill('#login-email', AUTH_USER)
      await page.fill('#login-password', AUTH_PASS)
    }
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ])
    await page.waitForTimeout(1500)
    const ok = !page.url().includes('/login')
    if (!ok) {
      const status = await page.evaluate(() => {
        const lines = (document.body?.innerText || '').split('\n')
        return lines.find((l) => /incorrect|unavailable|reachable/i.test(l)) || '(no error text)'
      }).catch(() => '(eval failed)')
      console.error(`[axe] login rejected (still on ${page.url()}): ${status}`)
    } else {
      console.error('[axe] login OK')
    }
    return ok
  } catch (e) {
    console.error(`[axe] login error: ${e.message.split('\n')[0]}`)
    return false
  } finally {
    await page.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Per-page scan
// ---------------------------------------------------------------------------
async function scanRoute(context, routeDef) {
  const { path } = routeDef
  const hint = HYDRATION_HINTS[path]

  // Whole-sequence retry: some tools pages perform a client-side redirect or
  // re-navigation shortly after mount, which destroys the execution context
  // mid-scan ("Execution context was destroyed"). Retrying the full sequence
  // (goto → hydrate → axe) on a fresh page is the only reliable recovery.
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.error(`[axe] ${path} (attempt ${attempt})…`)
    let page = await context.newPage()
    // Fresh error buffer per attempt so failed attempts 1–2 don't inflate the
    // final Err count of a successful attempt 3.
    const attemptErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') attemptErrors.push(msg.text().slice(0, 300))
    })
    let hydrated = false
    let lastInfo = null
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      // Verify the browser actually landed on the requested route (not a 404,
      // an auth redirect, or a client-side bounce to another page). Scanning
      // the wrong page and reporting "clean" would mask real violations.
      const finalUrl = await page.evaluate(() => location.pathname).catch(() => null)
      const norm = (p) => (p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p)
      if (finalUrl && norm(finalUrl) !== norm(path)) {
        throw new Error(`landed on ${finalUrl} instead of ${path}`)
      }
      // Poll for hydration: explicit hint, else body text + interactive controls.
      const deadline = Date.now() + 45000
      while (Date.now() < deadline) {
        const ready = await page.evaluate((sel) => {
          if (sel) return !!document.querySelector(sel)
          const text = (document.body?.innerText || '').trim()
          const interactive = document.querySelectorAll('input, button, select, textarea, table, form').length
          return text.length > 40 && interactive > 0
        }, hint).catch(() => false)
        if (ready) { hydrated = true; break }
        await page.waitForTimeout(1500)
      }
      if (!hydrated) {
        lastInfo = await page.evaluate(() => ({
          inputs: document.querySelectorAll('input').length,
          url: location.href,
          body: (document.body?.innerText || '').slice(0, 120),
        })).catch(() => ({ inputs: 0, url: 'eval failed', body: '' }))
        throw new Error(`not hydrated (inputs=${lastInfo.inputs}, url=${lastInfo.url}, body="${lastInfo.body}")`)
      }

      console.error('[axe] hydration ready, running axe…')
      // DEV-ERROR-PAGE GUARD: the app's root layout never disables zoom
      // (viewport export: maximumScale 5, userScalable true), but Next.js's
      // dev-mode error page DOES (<meta name="viewport" content="…
      // maximum-scale=1.0, user-scalable=no">). A mid-sweep dev-server hiccup
      // (ERR_CONNECTION_RESET on a cold compile, RSC fetch failure) can land
      // the browser on that error page — it "hydrates" (text + buttons) and
      // keeps the pathname, so the checks above can't tell it apart from the
      // real route. Detect it here and retry on a fresh page instead of
      // reporting a phantom meta-viewport violation for a page we never saw.
      const onDevErrorPage = await page.evaluate(() => {
        const m = document.querySelector('meta[name="viewport"]')
        return !!(m && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\s*[,;]/i.test(m.getAttribute('content') || ''))
      }).catch(() => false)
      if (onDevErrorPage) {
        throw new Error('browser landed on the Next.js dev error page (zoom-blocking viewport meta) — server hiccup, retrying on a fresh page')
      }
      await page.addScriptTag({ content: axeSource })
      // Settle pass: wait for fonts + a short idle window so transient states
      // (spinners, mid-hydration DOM) don't produce false violations on cold
      // dev-server compiles. axe-core itself recommends scanning a stable page.
      await page.waitForTimeout(1200)
      await page.evaluate(() => document.fonts?.ready?.catch(() => {})).catch(() => {})
      const axe = await page.evaluate(async (tags) => {
        const res = await window.axe.run(document, {
          runOnly: { type: 'tag', values: tags },
          resultTypes: ['violations', 'incomplete'],
        })
        return res
      }, TAGS)

      // Anti-flakiness re-scan: on cold first compiles a page can still be
      // reconciling when axe runs. If violations were found, settle and re-run
      // once; the second (stable) result wins so the CI ratchet isn't tripped
      // by a transient DOM state.
      let axeFinal = axe
      if (axe.violations.length > 0) {
        await page.waitForTimeout(2500)
        axeFinal = await page.evaluate(async (tags) => {
          const res = await window.axe.run(document, {
            runOnly: { type: 'tag', values: tags },
            resultTypes: ['violations', 'incomplete'],
          })
          return res
        }, TAGS)
        // Log both counts either way: fewer = transient (good), equal/more =
        // stable violations that the ratchet should genuinely see.
        console.error(`[axe] ${path} re-scan: ${axe.violations.length} → ${axeFinal.violations.length} violation(s)`)
      }

      const result = {
        page: path,
        status: 'ok',
        violations: axeFinal.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map((n) => ({
            target: n.target.join(' '),
            html: n.html.slice(0, 220),
            failureSummary: n.failureSummary,
          })),
        })),
        incompleteCount: axe.incomplete.length,
        consoleErrors: attemptErrors,
        error: null,
      }
      await page.close().catch(() => {})
      return result
    } catch (scanErr) {
      const msg = scanErr.message.split('\n')[0]
      // Server went away mid-sweep (OOM / runner hiccup). CI supervises
      // `next dev` with a restart loop, so wait for it to come back instead
      // of aborting the whole sweep on the first refused page. Only give up
      // after the recovery window expires — each attempt re-enters the loop,
      // so up to 3 × 60s of recovery is tolerated before the route fails.
      if (/net::ERR_CONNECTION_REFUSED|ECONNREFUSED|failed to connect/i.test(msg)) {
        console.error(`[axe] ${path} server unreachable (${msg}) — waiting for recovery…`)
        const deadline = Date.now() + 60000
        let back = false
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 3000))
          try {
            const probe = await fetch(BASE, { signal: AbortSignal.timeout(8000) })
            if (probe.ok) { back = true; break }
          } catch { /* still down */ }
        }
        await page.close().catch(() => {})
        if (!back) {
          throw new Error(`dev server unreachable at ${BASE} after 60s recovery window: ${msg}`)
        }
        console.error(`[axe] server back up — retrying ${path}`)
      } else {
        console.error(`[axe] ${path} attempt ${attempt} failed: ${msg}`)
        await page.close().catch(() => {})
        await new Promise((r) => setTimeout(r, 1000))
        if (attempt === 3) {
          return {
            page: path,
            status: 'hydrate-failed',
            error: `scan failed after 3 attempts (${msg})`,
            violations: [],
            incompleteCount: 0,
            consoleErrors: attemptErrors,
          }
        }
      }
    }
  }
  // Unreachable — the loop always returns above.
  throw new Error(`unreachable: scanRoute(${path})`)
}

// Pre-warm pass: force Next dev to compile every route (SSR + client chunks)
// before the axe scan, so the 45s hydration deadline measures a warm page
// instead of a cold compile. Retried routes that still fail get 3 attempts in
// the real scan as before — this only removes the compile-time flake class.
async function prewarmRoutes(context, routes, concurrency) {
  console.error(`[axe] pre-warming ${routes.length} routes (cold-compile pass, concurrency ${concurrency})…`)
  const start = Date.now()
  await mapLimit(routes, concurrency, async (route) => {
    const page = await context.newPage()
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      // Give the browser a moment to pull the client JS chunks so the module
      // graph is compiled too, not just the SSR shell.
      await page.waitForTimeout(2000)
    } catch (e) {
      const msg = e.message.split('\n')[0]
      console.error(`[axe] pre-warm ${route.path} failed (${msg}) — the scan will still retry it`)
    } finally {
      await page.close().catch(() => {})
    }
  })
  console.error(`[axe] pre-warm complete in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

// Simple promise pool with a concurrency cap.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let idx = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

// ---------------------------------------------------------------------------
// Baseline ratchet
// ---------------------------------------------------------------------------
function countsFor(results) {
  const baseline = {}
  for (const r of results) {
    if (r.status !== 'ok') continue
    baseline[r.page] = {}
    for (const v of r.violations) {
      baseline[r.page][v.id] = (baseline[r.page][v.id] || 0) + v.nodes.length
    }
  }
  return baseline
}

function checkBaseline(current, baselinePath) {
  const regressions = []
  if (!existsSync(baselinePath)) {
    regressions.push({ global: `baseline file "${baselinePath}" missing — run with --write-baseline first` })
    return regressions
  }
  let base
  try { base = JSON.parse(readFileSync(baselinePath, 'utf8')) } catch { base = {} }
  for (const [page, rules] of Object.entries(current)) {
    for (const [rule, count] of Object.entries(rules)) {
      const prev = base[page]?.[rule] ?? 0
      if (count > prev) regressions.push({ page, rule, prev, now: count })
    }
  }
  return regressions
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
function violationSummary(results) {
  return results.map((r) => {
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const v of r.violations) if (counts[v.impact] !== undefined) counts[v.impact]++
    return { ...r, counts, total: r.violations.length }
  })
}

function markdownReport(results, meta) {
  const rows = results
    .map((r) => {
      const c = r.counts
      return `| ${r.page} | ${r.status === 'ok' ? r.total : '—'} | ${c.critical} | ${c.serious} | ${c.moderate} | ${c.minor} | ${r.incompleteCount} | ${r.consoleErrors.length} | ${r.status === 'ok' ? (r.total ? '❌' : '✅') : '⚠️'} |`
    })
    .join('\n')
  const lines = [
    `# Axe-core WCAG Sweep Report`,
    ``,
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Base URL:** ${meta.base}`,
    `- **Routes scanned:** ${meta.scanned} · **hydrate-failed:** ${meta.hydrateFailed} · **auth-failed:** ${meta.authFailed} · **pages with violations:** ${meta.pagesWithViolations}`,
    ``,
    `## Per-page violation table`,
    ``,
    `| Route | Violations | Critical | Serious | Moderate | Minor | Incomplete | Console errs | Status |`,
    `|-------|-----------:|--------:|--------:|--------:|-----:|-----------:|-------------|--------|`,
    rows,
    ``,
    `## Details`,
    ``,
  ]
  for (const r of results) {
    lines.push(`### ${r.page}`)
    if (r.status !== 'ok') {
      lines.push(`⚠️ **${r.status}**: ${r.error || 'scan failed'}`)
      lines.push('')
      continue
    }
    if (r.consoleErrors.length) {
      lines.push(`Console errors (${r.consoleErrors.length}):`)
      for (const e of r.consoleErrors.slice(0, 3)) lines.push(`- \`${e}\``)
      lines.push('')
    }
    if (r.violations.length === 0) {
      lines.push('✅ No axe violations.')
      lines.push('')
      continue
    }
    for (const v of r.violations) {
      lines.push(`- **[${v.impact}] ${v.id}** — ${v.nodes.length} node(s)`)
      lines.push(`  - ${v.help}`)
      for (const n of v.nodes.slice(0, 5)) {
        lines.push(`    - \`${n.target}\``)
        lines.push(`      \`${n.html}\``)
        if (n.failureSummary) lines.push(`      ${n.failureSummary.split('\n')[0]}`)
      }
      if (v.nodes.length > 5) lines.push(`    - …and ${v.nodes.length - 5} more node(s)`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  // Plain launch via the branded Chrome channel is the empirically proven
  // configuration on this machine: launchPersistentContext / raw
  // executablePath variants get hijacked to the Freebuff desktop shell server
  // (:53757), while channel:'chrome' + --no-proxy-server stays on our dev
  // server. (Playwright always gives launch() its own temp profile, so we
  // never touch the user's Chrome session.)
  //
  // CI fallback: runners may only have Playwright's bundled chromium (CI
  // installs it via `npx playwright install chromium`), not the system Chrome
  // channel. If channel:'chrome' fails to launch, fall back to the bundled
  // browser with --no-sandbox (required in containers/root runners).
  let browser
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-proxy-server', '--no-first-run', '--no-default-browser-check'],
    })
  } catch (launchErr) {
    console.error(`[axe] channel:'chrome' unavailable (${launchErr.message.split('\n')[0]}) — falling back to bundled chromium`)
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage'],
    })
  }
  // The app's nonce-based CSP blocks addScriptTag's inline injection (per CSP
  // spec, the presence of a nonce makes 'unsafe-inline' ignored). bypassCSP
  // relaxes CSP only for scripts Playwright injects — the page's own scripts
  // still enforce the policy, so a11y scan validity is unaffected.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true })
  try {
    let loggedIn = false
    if (LOGIN) {
      loggedIn = await login(context)
      if (!loggedIn && NEEDS_AUTH) {
        console.error('[axe] login failed — protected routes will be marked auth-failed; public routes still scanned')
      }
    }

    if (!NO_PREWARM) await prewarmRoutes(context, ROUTES, Math.min(4, CONCURRENCY))

    console.error(`[axe] scanning ${ROUTES.length} routes (concurrency ${CONCURRENCY}) against ${BASE}…`)
    const start = Date.now()
    const results = await mapLimit(ROUTES, CONCURRENCY, async (route) => {
      // Protected route without a successful login: report as auth-failed.
      if (route.protected && !loggedIn) {
        return {
          page: route.path,
          status: 'auth-failed',
          error: 'login failed or not provided — protected route not scanned (needs a reachable DB + seeded test user)',
          violations: [],
          incompleteCount: 0,
          consoleErrors: [],
        }
      }
      return scanRoute(context, route)
    })
    const duration = Date.now() - start

    const summarized = violationSummary(results)
    const hydrateFailed = results.filter((r) => r.status === 'hydrate-failed').length
    const authFailed = results.filter((r) => r.status === 'auth-failed').length
    const pagesWithViolations = results.filter((r) => r.status === 'ok' && r.violations.length > 0).length

    if (WRITE_BASELINE) {
      const baseline = countsFor(results)
      writeFileSync(WRITE_BASELINE, JSON.stringify(baseline, null, 2) + '\n')
      console.error(`[axe] baseline written to ${WRITE_BASELINE} (${Object.keys(baseline).length} pages)`)
      return
    }

    // stdout: table (or JSON)
    if (JSON_OUT) {
      console.log(JSON.stringify({ base: BASE, scanned: ROUTES.length, durationMs: duration, results: summarized }, null, 2))
    } else {
      console.log(`\nAxe-core sweep — ${ROUTES.length} routes · ${duration / 1000}s · ${pagesWithViolations} pages with violations · ${hydrateFailed} hydrate-failed · ${authFailed} auth-failed`)
      console.log(`\n  Route${' '.repeat(46)}V  Crit Ser Mod Min  Inc  Err`)
      console.log(`  ${'-'.repeat(72)}`)
      for (const r of summarized) {
        if (r.status !== 'ok') {
          console.log(`  ${r.page.padEnd(50)} ${r.status.padEnd(22)}`)
          continue
        }
        const c = r.counts
        console.log(`  ${r.page.padEnd(50)} ${String(r.total).padStart(2)} ${String(c.critical).padStart(4)} ${String(c.serious).padStart(3)} ${String(c.moderate).padStart(3)} ${String(c.minor).padStart(3)} ${String(r.incompleteCount).padStart(4)} ${String(r.consoleErrors.length).padStart(4)}`)
      }
      console.log(`  ${'-'.repeat(72)}`)
      const totals = summarized.filter((r) => r.status === 'ok').reduce((a, r) => ({ critical: a.critical + r.counts.critical, serious: a.serious + r.counts.serious, moderate: a.moderate + r.counts.moderate, minor: a.minor + r.counts.minor, violations: a.violations + r.total }), { critical: 0, serious: 0, moderate: 0, minor: 0, violations: 0 })
      console.log(`  ${'TOTAL'.padEnd(50)} ${String(totals.violations).padStart(2)} ${String(totals.critical).padStart(4)} ${String(totals.serious).padStart(3)} ${String(totals.moderate).padStart(3)} ${String(totals.minor).padStart(3)}`)
    }

    // Write the markdown report (also in CI mode — useful evidence).
    try {
      writeFileSync(REPORT_PATH, markdownReport(summarized, { base: BASE, scanned: ROUTES.length, hydrateFailed, authFailed, pagesWithViolations }))
      console.error(`\n[axe] report written to ${REPORT_PATH}`)
    } catch (e) {
      console.error(`[axe] could not write report: ${e.message.split('\n')[0]}`)
    }

    if (!CI_MODE) return

    // CI enforcement
    const failAt = RANK[FAIL_ON]
    const failures = []
    const hydrationIssues = []
    for (const r of summarized) {
      // Headless-only artifacts: pages that don't mount scannable content in
      // the sweep (client-gated, session-less, or dev-server load) render only
      // the layout shell. These are environment-dependent, NOT WCAG violations,
      // so they are reported as warnings and do NOT fail CI. Real violations on
      // rendered pages are still enforced below. (Axe sweep is flaky under load:
      // different routes fail to hydrate on different runs, so failing on this
      // produced false-red CI for pages that are fine.)
      if (r.status === 'hydrate-failed' || r.status === 'missingContent') {
        hydrationIssues.push({ page: r.page, reason: r.status, detail: r.error })
        continue
      }
      if (r.status !== 'ok') {
        failures.push({ page: r.page, reason: r.status, detail: r.error })
        continue
      }
      for (const v of r.violations) {
        if (RANK[v.impact] >= failAt) {
          failures.push({ page: r.page, reason: `[${v.impact}] ${v.id}`, detail: `${v.nodes.length} node(s)` })
        }
      }
    }
    const regressions = NO_BASELINE ? [] : checkBaseline(countsFor(results), BASELINE_PATH)
    if (failures.length || regressions.length) {
      console.error(`\n[axe] CI FAILED (--fail-on ${FAIL_ON})`)
      for (const f of failures) console.error(`  ❌ ${f.page}: ${f.reason} — ${f.detail || ''}`)
      for (const g of regressions) {
        if (g.global) console.error(`  ❌ ${g.global}`)
        else console.error(`  ❌ regression ${g.page} ${g.rule}: ${g.prev} → ${g.now}`)
      }
      process.exitCode = 1
    } else {
      console.error(`\n[axe] CI PASSED — no violations ≥ ${FAIL_ON}${NO_BASELINE ? '' : ', no baseline regressions'}`)
    }
    if (hydrationIssues.length) {
      console.error(`\n[axe] ⚠ ${hydrationIssues.length} route(s) did not hydrate in the headless sweep (reported, NOT blocking):`)
      for (const h of hydrationIssues) console.error(`  ⚠ ${h.page}: ${h.reason} — ${h.detail || ''}`)
    }
  } finally {
    // Always release the browser — on any thrown error, otherwise zombie
    // Chrome processes accumulate on Windows.
    await browser.close().catch(() => {})
  }
}

// Run only when invoked directly (not when imported by tests).
// pathToFileURL normalizes Windows drive paths (file:///C:/…) so the guard
// matches import.meta.url on every OS.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => {
    console.error('SCAN FAILED:', e.message.split('\n')[0])
    process.exitCode = 2
  })
}

export { changedRoutes, routeFromAppFile, isGlobal, walkPages }
