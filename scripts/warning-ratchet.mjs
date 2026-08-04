#!/usr/bin/env node
/**
 * Warning ratchet — per-rule warning baselines for CI.
 *
 * WHY: the whole-repo lint (`--max-warnings 20000`) is a single global
 * ceiling. It can't tell WHICH rules are growing, so a big jump in
 * `no-unsafe-member-access` could be masked by a drop elsewhere. This
 * script snapshots the warning count PER RULE and fails when ANY rule
 * exceeds its baseline — a true per-rule ratchet toward zero.
 *
 * Usage:
 *   node scripts/warning-ratchet.mjs              # verify: exit 1 if any rule > baseline
 *   node scripts/warning-ratchet.mjs --update     # snapshot current counts as the new baseline
 *   node scripts/warning-ratchet.mjs --baseline path.json   # custom baseline file
 *   node scripts/warning-ratchet.mjs --report     # print full per-rule table (verify still runs)
 *   exit 0 = pass, 1 = ratchet exceeded, 2 = usage/run error
 *
 * The baseline file is a JSON map: { "<ruleId>": count }. Rules absent from
 * the baseline are treated as baseline 0 (any occurrence is a regression —
 * this is what stops NEW rule activations from sneaking in).
 *
 * Plugin resolution is pinned to the repo root (same trick as lint-gate.mjs)
 * to avoid the duplicate-plugin conflict in worktrees.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const UPDATE = args.includes('--update')
const REPORT = args.includes('--report')
const baseIdx = args.indexOf('--baseline')
const BASELINE_PATH = baseIdx >= 0 && args[baseIdx + 1] ? args[baseIdx + 1] : 'scripts/warning-baseline.json'

// Same scope as the CI whole-repo lint step (ci.yml).
const LINT_ARGS = ['middleware.ts', 'src/']

const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
  extensions: ['.ts', '.tsx', '.js', '.mjs'],
})

async function countByRule() {
  const results = await eslint.lintFiles(LINT_ARGS)
  const counts = {}
  for (const r of results) {
    for (const m of r.messages) {
      if (m.severity !== 1) continue // warnings only (errors are lint-gate's job)
      const rule = m.ruleId || '(parse)'
      counts[rule] = (counts[rule] || 0) + 1
    }
  }
  return counts
}

let current
try {
  current = await countByRule()
} catch (err) {
  console.error(`[warning-ratchet] eslint run failed: ${err.message.split('\n')[0]}`)
  process.exit(2)
}

const total = Object.values(current).reduce((a, b) => a + b, 0)

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
  console.error(`[warning-ratchet] baseline written to ${BASELINE_PATH} (${Object.keys(current).length} rules, ${total} warnings)`)
  process.exit(0)
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`[warning-ratchet] baseline file "${BASELINE_PATH}" missing — run with --update first (or the whole-repo lint gate can't ratchet)`)
  process.exit(2)
}

let base
try {
  base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  console.error(`[warning-ratchet] baseline file "${BASELINE_PATH}" is not valid JSON`)
  process.exit(2)
}

// Every rule in either map, sorted by current count desc.
const rules = new Set([...Object.keys(base), ...Object.keys(current)])
const rows = [...rules]
  .map((rule) => ({ rule, prev: base[rule] || 0, now: current[rule] || 0 }))
  .sort((a, b) => b.now - a.now)

const regressions = rows.filter((r) => r.now > r.prev)
const totalBase = Object.values(base).reduce((a, b) => a + b, 0)
const totalNow = total

if (REPORT || regressions.length) {
  console.error(`\n[warning-ratchet] ${totalNow} warnings (baseline ${totalBase}) — ${regressions.length} rule(s) over baseline`)
  const w = Math.max(...rows.map((r) => r.rule.length), 8)
  console.error(`  ${'rule'.padEnd(w)}  base   now`)
  console.error(`  ${'-'.repeat(w + 12)}`)
  for (const r of rows) {
    const flag = r.now > r.prev ? '  ⚠ EXCEEDS' : ''
    console.error(`  ${r.rule.padEnd(w)}  ${String(r.prev).padStart(4)} ${String(r.now).padStart(5)}${flag}`)
  }
}

if (regressions.length) {
  console.error(`\n[warning-ratchet] FAIL: ${regressions.length} rule(s) exceeded their baseline. Fix or --update the baseline deliberately.`)
  for (const r of regressions) console.error(`  ❌ ${r.rule}: ${r.prev} → ${r.now}`)
  process.exit(1)
}

console.error(`[warning-ratchet] OK: ${totalNow} warnings, ${Object.keys(base).length} rules at/below baseline.`)
process.exit(0)
