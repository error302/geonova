#!/usr/bin/env node
/**
 * suppression-gate.mjs — blocks the "fake green" attack where warnings are
 * silenced with // eslint-disable comments instead of real fixes.
 *
 * WHY: the warning/family ratchets count eslint MESSAGES. A comment like
 * `// eslint-disable-next-line @typescript-eslint/no-unused-vars` makes the
 * rule emit nothing, so the counter drops while the code quality neither
 * improves nor is revealed anywhere. An agent wanting a lower number can
 * sprinkle thousands of these and every gate reads "green". This script makes
 * the suppression itself a tracked, hard-capped resource:
 *
 *   - counts EVERY eslint-disable token in the linted src/ surface
 *   - compares it to a committed floor (scripts/suppression-baseline.json)
 *   - fails --check when the count exceeds the floor, listing the offending
 *     files and the per-file delta vs the last commit (so the diagnosis is
 *     self-explanatory in CI logs)
 *   - --update can only LOWER the floor — you may never ratchet suppression
 *     upward (the floor is hard-capped; growth requires removing suppressions
 *     elsewhere first). 114 is the committed floor today.
 *
 * Matching is token-based (matches eslint-disable, eslint-disable-next-line,
 * eslint-disable-line, and block eslint-disable even when scoped to a rule),
 * which is exactly the surface the warning ratchets can be gamed through.
 *
 * Usage:
 *   node scripts/suppression-gate.mjs --check        # CI: fail if count > floor
 *   node scripts/suppression-gate.mjs --report       # drift table (floor, committed, now)
 *   node scripts/suppression-gate.mjs --update       # re-baseline (downward only)
 *   node scripts/suppression-gate.mjs --scope a,b    # scan only these paths (testing)
 *   exit 0 = pass, 1 = floor exceeded, 2 = usage/update-refusal/error
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const REPORT = args.includes('--report')
const UPDATE = args.includes('--update')
const scopeIdx = args.indexOf('--scope')
const SCOPE = scopeIdx >= 0 && args[scopeIdx + 1] ? args[scopeIdx + 1].split(',') : ['src']
const BASELINE = 'scripts/suppression-baseline.json'

const modeFlags = [['--check', CHECK], ['--report', REPORT], ['--update', UPDATE]].filter(([, on]) => on)
if (modeFlags.length > 1) {
  console.error(`[suppression-gate] cannot combine ${modeFlags.map(([f]) => f).join(' and ')} — run them separately.`)
  process.exit(2)
}
if (modeFlags.length === 0) {
  console.error('[suppression-gate] usage: --check | --report | --update')
  process.exit(2)
}

/* ── Recursive file walk (no fs.globSync — Node 20 compatible) ── */
function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full)
  }
  return out
}

const files = SCOPE.flatMap((s) => (statSync(s, { throwIfNoEntry: false })?.isDirectory() ? walk(s) : existsSync(s) ? [s] : []))

/* Count eslint-disable tokens in a file's text. */
function countDisables(text) {
  const re = /eslint-disable(?:-next-line|-line)?(?:\s+[\w@/.-]+(?:\s*,\s*[\w@/.-]+)*)?/g
  return text.match(re)?.length || 0
}

/* Per-file count map for a set of repo files (working tree uses disk). */
function countTree() {
  const counts = {}
  for (const f of files) {
    const rel = f.split(/[\\/]/).join('/')
    const n = countDisables(readFileSync(f, 'utf8'))
    if (n > 0) counts[rel] = n
  }
  return counts
}

/* Per-file count map at HEAD via git show (rel path normalized). */
function countHead() {
  const counts = {}
  for (const f of files) {
    const rel = f.split(/[\\/]/).join('/')
    try {
      const n = countDisables(execFileSync('git', ['show', `HEAD:${rel}`], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }))
      if (n > 0) counts[rel] = n
    } catch {
      /* file untracked or new — treat as 0 */
    }
  }
  return counts
}

const now = countTree()
const nowTotal = Object.values(now).reduce((a, b) => a + b, 0)

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))['eslint-disable'] ?? null
  } catch {
    return null
  }
}

function loadHeadBaseline() {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${BASELINE}`], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 }))['eslint-disable'] ?? null
  } catch {
    return null
  }
}

const floor = loadBaseline()

if (floor === null && !UPDATE) {
  console.error(`[suppression-gate] baseline "${BASELINE}" missing/invalid — run with --update first.`)
  process.exit(2)
}

if (REPORT) {
  const head = loadHeadBaseline()
  const headStr = head === null ? 'n/a' : String(head)
  const floorStr = floor === null ? 'n/a' : String(floor)
  const delta = head === null ? '' : ` (Δ ${nowTotal - head > 0 ? '+' : ''}${nowTotal - head})`
  console.error(
    `[suppression-gate] eslint-disable floor: ${nowTotal} (committed ${headStr}, baseline ${floorStr})${delta}${floor !== null && nowTotal > floor ? '  ⚠ EXCEEDS' : ''}`
  )
  process.exit(0)
}

if (UPDATE) {
  if (floor !== null && nowTotal > floor) {
    console.error(
      `[suppression-gate] REFUSED: re-baselining would RAISE the floor (${floor} → ${nowTotal}). Suppression is hard-capped; remove ${nowTotal - floor} eslint-disable comment(s) first, or fix the code instead.`
    )
    process.exit(2)
  }
  writeFileSync(BASELINE, JSON.stringify({ 'eslint-disable': nowTotal }, null, 2) + '\n')
  console.error(`[suppression-gate] floor written → ${BASELINE} (eslint-disable: ${nowTotal})`)
  process.exit(0)
}

/* --check */
if (!CHECK) process.exit(0)
if (floor !== null && nowTotal <= floor) {
  console.error(`[suppression-gate] OK: ${nowTotal} eslint-disable comment(s), within the ${floor} floor.`)
  process.exit(0)
}

/* Exceeded — build the self-diagnosing offender list (working tree vs HEAD). */
const head = countHead()
const offenders = []
const allRel = new Set([...Object.keys(now), ...Object.keys(head)])
for (const rel of allRel) {
  const nowN = now[rel] || 0
  const headN = head[rel] || 0
  if (nowN > headN) offenders.push({ rel, added: nowN - headN, nowN })
}
offenders.sort((a, b) => b.added - a.added)

console.error(`[suppression-gate] FAIL: ${nowTotal} eslint-disable comment(s) exceed the ${floor} floor (+${nowTotal - floor}).`)
console.error(`[suppression-gate] The suppression floor is hard-capped — silence with real fixes, never with new eslint-disable comments.`)
console.error(`[suppression-gate] To remove the cap you must first delete suppressions back to the floor, then: node scripts/suppression-gate.mjs --update`)
if (offenders.length) {
  console.error(`[suppression-gate] offenders vs last commit (file, disables added, current total):`)
  for (const o of offenders) console.error(`  +${o.added.toString().padStart(3)}  (now ${o.nowN})  ${o.rel}`)
} else {
  console.error(`[suppression-gate] (no per-file growth vs HEAD — the working tree is at/over the floor globally; inspect the diff manually)`)
}
process.exit(1)