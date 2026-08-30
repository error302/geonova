/**
 * Unit tests for the axe-sweep scanner's ROUTE MAPPING and the
 * dev-error-page viewport guard (scripts/axe-gnss-scan.mjs).
 *
 * Why these matter:
 *  - `--paths-from-changed` narrows the CI sweep on PRs. A mapping bug that
 *    silently skips a page (or falls back to full sweep every time) either
 *    weakens the a11y gate or makes CI minutes explode. The mapping logic
 *    (global files, nested app dirs, shared-component basename matching) has
 *    exactly zero other tests.
 *  - The dev-error-page guard exists because a mid-sweep dev-server hiccup
 *    landed the browser on Next's error page and produced a PHANTOM
 *    meta-viewport violation for /tools/gnss-baseline (fixed in 876f7445).
 *    The guard regex is now exported so its semantics stay pinned.
 *
 * The scanner is ESM (.mjs) and jest runs CommonJS, so the real module is
 * loaded inside a plain-node subprocess (tests/helpers/axe-routing-checker.mjs)
 * against a fixture app tree; this file asserts on the checker's JSON
 * verdicts. Same real-code-under-test guarantee as the schema-drift gate
 * tests, which spawn the gate CLI directly.
 */
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = path.join(__dirname, '..')
const CHECKER = path.join(__dirname, 'helpers', 'axe-routing-checker.mjs')

interface Verdict {
  name: string
  pass: boolean
  detail: unknown
}

/**
 * Fixture app tree:
 *   src/app/tools/gnss/page.tsx              (imports ScaleBadge — shared-component case)
 *   src/app/tools/gnss/components/Panel.tsx  (nested under a route)
 *   src/app/tools/gnss-rinex/page.tsx
 *   src/app/tools/[id]/page.tsx              (dynamic — never scanned)
 *   src/app/tools/redirect-stub/page.tsx     (redirect, no JSX — skipped)
 *   src/app/tools/mixed/page.tsx             (redirect AND JSX — kept)
 *   src/app/tools/deep/orphan/page.tsx       (no scanned ancestor when its inline.tsx changes)
 *   src/components/gnss/ScaleBadge.tsx       (imported by gnss/page.tsx)
 *   src/components/gnss/Unimported.tsx       (imported by nobody)
 */
function buildFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'axe-routing-'))
  const mk = (p: string, content = 'export default function P() { return null }') => {
    const full = path.join(root, p)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  mk('src/app/tools/gnss-rinex/page.tsx')
  mk('src/app/tools/[id]/page.tsx')
  mk('src/app/tools/redirect-stub/page.tsx', "import { redirect } from 'next/navigation'\nexport default function P() { redirect('/tools') }\n")
  mk('src/app/tools/mixed/page.tsx', "import { redirect } from 'next/navigation'\nexport default function P() { if (false) redirect('/tools'); return <div/> }\n")
  mk('src/app/tools/deep/orphan/page.tsx')
  mk('src/app/tools/deep/inline.tsx', 'export const x = 1') // deep/ has no page.tsx → no scanned ancestor
  mk('src/app/tools/gnss/components/Panel.tsx', 'export function Panel() { return null }')
  mk('src/components/gnss/ScaleBadge.tsx', 'export function ScaleBadge() { return null }')
  mk('src/components/gnss/Unimported.tsx', 'export function Unimported() { return null }')
  writeFileSync(
    path.join(root, 'src', 'app', 'tools', 'gnss', 'page.tsx'),
    "import { ScaleBadge } from '@/components/gnss/ScaleBadge'\nexport default function P() { return null }\n",
    'utf8'
  )
  return root
}

let verdicts: Verdict[] = []

// NOTE: runs at module scope (NOT in beforeAll) — describe.each needs the
// table at collection time, which happens before any hook fires.
const fixture = buildFixture()
try {
  // The checker imports the REAL scanner with cwd = fixture root, so the
  // scanner's module-level walkPages('src/app/tools') sees the fixture
  // routes, and changedRoutes() maps against them.
  const output = execFileSync('node', [CHECKER, fixture], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  verdicts = JSON.parse(output.trim().split('\n').pop() as string)
} finally {
  rmSync(fixture, { recursive: true, force: true })
}

test('checker produced verdicts for every case', () => {
  expect(verdicts.length).toBeGreaterThanOrEqual(18)
})

describe.each(verdicts)('axe-sweep: $name', ({ name, pass, detail }) => {
  test(`${name}`, () => {
    if (!pass) {
      throw new Error(`checker failed: ${JSON.stringify(detail)}`)
    }
  })
})
