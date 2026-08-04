#!/usr/bin/env node
/**
 * A11y audit ratchet — regenerate the jsx-a11y audit and enforce a per-rule
 * baseline in CI.
 *
 * WHY: the axe-core sweep (scripts/axe-gnss-scan.mjs) catches runtime WCAG
 * violations on rendered pages, but it needs a dev server + browser. This
 * gate is the static complement: it re-runs ESLint's jsx-a11y ruleset over
 * the same scope as CI's whole-repo lint, regenerates the committed audit
 * evidence file (.a11y-audit.json) on every run, and FAILS if any jsx-a11y
 * rule's count exceeds the committed per-rule baseline (.a11y-baseline.json).
 * A rule absent from the baseline is treated as baseline 0 — so a brand-new
 * jsx-a11y violation (or a newly enabled rule firing) fails the gate.
 *
 * Usage:
 *   node scripts/a11y-audit.mjs              # verify: exit 1 if any jsx-a11y count > baseline
 *   node scripts/a11y-audit.mjs --write-audit  # verify AND regenerate .a11y-audit.json evidence
 *   node scripts/a11y-audit.mjs --update     # snapshot current counts as baseline (+ writes audit)
 *   node scripts/a11y-audit.mjs --baseline path.json   # custom baseline file
 *   node scripts/a11y-audit.mjs --scope a,b  # lint only these paths (testing)
 *   node scripts/a11y-audit.mjs --report     # print per-rule table (verify still runs)
 *   exit 0 = pass, 1 = ratchet exceeded, 2 = usage/run error
 *
 * The evidence file (.a11y-audit.json) is written ONLY with --write-audit or
 * --update, and always with repo-relative filePaths (machine-portable). Plain
 * verify runs are read-only so a scoped/testing run can never clobber the
 * committed evidence file. CI passes --write-audit to regenerate on each push.
 *
 * Plugin resolution is pinned to the repo root (same trick as lint-gate.mjs
 * and warning-ratchet.mjs) to avoid the duplicate-plugin conflict in worktrees.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const UPDATE = args.includes('--update')
const WRITE_AUDIT = args.includes('--write-audit')
const REPORT = args.includes('--report')
const baseIdx = args.indexOf('--baseline')
const BASELINE_PATH = baseIdx >= 0 && args[baseIdx + 1] ? args[baseIdx + 1] : 'scripts/a11y-baseline.json'
const scopeIdx = args.indexOf('--scope')
const SCOPE = scopeIdx >= 0 && args[scopeIdx + 1] ? args[scopeIdx + 1].split(',') : ['middleware.ts', 'src/']

// The regenerated audit evidence file (committed to the repo).
const AUDIT_PATH = '.a11y-audit.json'

const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
  extensions: ['.ts', '.tsx', '.js', '.mjs'],
})

async function runAudit() {
  const results = await eslint.lintFiles(SCOPE)
  // Count jsx-a11y findings per rule (they are configured as errors, but we
  // count any severity so a severity flip can never hide a regression).
  const counts = {}
  for (const r of results) {
    for (const m of r.messages) {
      if (m.ruleId && m.ruleId.startsWith('jsx-a11y/')) {
        counts[m.ruleId] = (counts[m.ruleId] || 0) + 1
      }
    }
  }
  return { results, counts }
}

let audit
try {
  audit = await runAudit()
} catch (err) {
  console.error(`[a11y-audit] eslint run failed: ${err.message.split('\n')[0]}`)
  process.exit(2)
}
const { counts } = audit
const total = Object.values(counts).reduce((a, b) => a + b, 0)

// Write the committed audit evidence file ONLY when explicitly requested
// (--write-audit or --update). filePaths are normalized to repo-relative so
// the file is machine-portable and regenerating on any machine yields the
// same content. Plain verify runs are read-only: a scoped or interrupted run
// can never truncate the committed 18MB evidence file.
function writeAudit() {
  const cwdPrefix = process.cwd().split(/[\\/]/).join('/') + '/'
  const normalized = audit.results.map((r) => ({
    ...r,
    filePath: r.filePath.split(/[\\/]/).join('/').replace(cwdPrefix, ''),
  }))
  try {
    writeFileSync(AUDIT_PATH, JSON.stringify(normalized, null, 2) + '\n')
    console.error(`[a11y-audit] audit regenerated → ${AUDIT_PATH} (${normalized.length} files)`)
  } catch (err) {
    console.error(`[a11y-audit] could not write audit file: ${err.message.split('\n')[0]}`)
    process.exit(2)
  }
}

if (WRITE_AUDIT) writeAudit()

if (UPDATE) {
  if (!WRITE_AUDIT) writeAudit()
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n')
  console.error(`[a11y-audit] baseline written to ${BASELINE_PATH} (${Object.keys(counts).length} rules, ${total} findings)`)
  process.exit(0)
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`[a11y-audit] baseline file "${BASELINE_PATH}" missing — run with --update first`)
  process.exit(2)
}

let base
try {
  base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  console.error(`[a11y-audit] baseline file "${BASELINE_PATH}" is not valid JSON`)
  process.exit(2)
}

const rules = new Set([...Object.keys(base), ...Object.keys(counts)])
const rows = [...rules]
  .map((rule) => ({ rule, prev: base[rule] || 0, now: counts[rule] || 0 }))
  .sort((a, b) => b.now - a.now)
const regressions = rows.filter((r) => r.now > r.prev)
const totalBase = Object.values(base).reduce((a, b) => a + b, 0)

if (REPORT || regressions.length) {
  console.error(`\n[a11y-audit] ${total} jsx-a11y finding(s) (baseline ${totalBase}) — ${regressions.length} rule(s) over baseline`)
  const w = Math.max(...rows.map((r) => r.rule.length), 8)
  console.error(`  ${'rule'.padEnd(w)}  base   now`)
  console.error(`  ${'-'.repeat(w + 12)}`)
  for (const r of rows) {
    const flag = r.now > r.prev ? '  ⚠ EXCEEDS' : ''
    console.error(`  ${r.rule.padEnd(w)}  ${String(r.prev).padStart(4)} ${String(r.now).padStart(5)}${flag}`)
  }
}

if (regressions.length) {
  console.error(`\n[a11y-audit] FAIL: ${regressions.length} jsx-a11y rule(s) exceeded the baseline. Fix, or run --update to ratchet deliberately.`)
  for (const r of regressions) console.error(`  ❌ ${r.rule}: ${r.prev} → ${r.now}`)
  process.exit(1)
}

console.error(`[a11y-audit] OK: ${total} jsx-a11y finding(s), all rules at/below baseline.`)
process.exit(0)
