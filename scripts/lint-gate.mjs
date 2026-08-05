#!/usr/bin/env node
/**
 * Lint gate — true "no new warnings" ratchet for CI.
 *
 * WHY: `eslint $CHANGED --max-warnings 0` fails whenever a touched file
 * carries PRE-EXISTING warnings (e.g. @typescript-eslint/no-unsafe-* in
 * legacy code), even if the change added zero warnings. That made the gate
 * impossible to pass on real PRs touching dirty files.
 *
 * This script lints the changed files at the BASE ref and at HEAD, then
 * fails ONLY when the HEAD warning count exceeds the base count (i.e. new
 * warnings). Pre-existing warnings pass through, exactly as the ratchet
 * intent ("no new warnings allowed") describes.
 *
 * MEMBER-ACCESS FLOOR: the fast changed-files analogue of the whole-repo
 * member-access ratchet in lint-ratchets.mjs. The changed files must not
 * ADD @typescript-eslint/no-unsafe-member-access warnings (head > base in
 * the member-access family fails the gate) — so a PR gets a ~30s regression
 * check before the slow whole-repo ratchet runs. --member-floor N raises the
 * ceiling to max(baseMember, N), mirroring --max-warnings.
 *
 * Usage (mirrors CI):
 *   node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N] [--member-floor N]
 *   node scripts/lint-gate.mjs --paths-from-changed [base-ref] [--max-warnings N] [--member-floor N]
 *   exit 0 = pass, 1 = fail, 2 = usage error
 *
 * --paths-from-changed computes the changed TS/TSX files via
 * `git diff --name-only --diff-filter=ACMR <base>...HEAD` (same filter as
 * the CI step; tests excluded), so CI can collapse its two git calls into
 * one script invocation.
 *
 * Plugin resolution is pinned to the repo root node_modules to avoid the
 * duplicate-plugin conflict seen in worktrees (nested eslint-plugin-* copies
 * under other packages).
 *
 * Known asymmetry: the BASE pass uses ESLint's lintText (which does NOT apply
 * .eslintignore), while the HEAD pass uses lintFiles (which DOES). For a file
 * that is eslint-ignored, base warnings are inflated, which only makes the
 * gate more lenient — never more strict — so it is a safe direction. src/ is
 * not ignored today, so this is theoretical.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const MEMBER_RULE = '@typescript-eslint/no-unsafe-member-access'

const args = process.argv.slice(2)

// Single pass: pull out known flags + their values; everything else is
// positional (base ref + file list). Flag order is irrelevant.
let PFC = false
let maxWarnings = null
let memberFloor = null
const positional = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--paths-from-changed') {
    PFC = true
  } else if (a === '--max-warnings' || a === '--member-floor') {
    const v = Number(args[++i])
    if (!Number.isFinite(v)) {
      console.error(`[lint-gate] ${a} requires a numeric value (got "${args[i]}").`)
      process.exit(2)
    }
    if (a === '--max-warnings') maxWarnings = v
    else memberFloor = v
  } else if (a.startsWith('--')) {
    console.error(`[lint-gate] unknown flag: ${a}`)
    process.exit(2)
  } else {
    positional.push(a)
  }
}

let baseRef
let files
if (PFC) {
  // Base ref is the first positional if it's a real ref, else default HEAD.
  baseRef = positional[0] && positional[0] !== 'HEAD' ? positional.shift() : 'HEAD'
  files = null // computed below from git diff
} else {
  baseRef = positional.shift()
  files = positional
}


// --paths-from-changed: compute changed TS/TSX files (tests excluded), the
// same way the CI step builds $CHANGED. Any file git can list counts.
if (PFC) {
  const diffRef = baseRef === 'HEAD' ? 'HEAD' : `${baseRef}...HEAD`
  try {
    const raw = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', diffRef, '--', 'middleware.ts', 'src/*.ts', 'src/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    files = raw.split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !/\.(test|spec)\.(ts|tsx)$/.test(s))
  } catch (e) {
    console.error(`[lint-gate] git diff failed (${e.message.split('\n')[0]}) — cannot compute changed files.`)
    process.exit(2)
  }
  if (!files.length) {
    console.log('[lint-gate] no changed TS/TSX files vs ' + diffRef + ' — skipping lint gate.')
    process.exit(0)
  }
}

if (!baseRef || !files || files.length === 0) {
  console.error('usage: node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N] [--member-floor N]')
  console.error('   or: node scripts/lint-gate.mjs --paths-from-changed [base-ref] [--max-warnings N] [--member-floor N]')
  process.exit(2)
}

// Load the project's ESLint (8.x, legacy .eslintrc.json) via its Node API.
const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
})

function countWarnings(messages) {
  let total = 0
  let member = 0
  for (const m of messages) {
    if (m.severity === 1) {
      total++
      if (m.ruleId === MEMBER_RULE) member++
    }
  }
  return { total, member }
}

// Committed whole-repo member-access floor — informational context only. The
// changed-files gate is a regression check (head > base), not the repo floor.
let committedFloor = null
try {
  if (existsSync('scripts/member-access-baseline.json')) {
    const b = JSON.parse(readFileSync('scripts/member-access-baseline.json', 'utf8'))
    committedFloor = b[MEMBER_RULE] ?? null
  }
} catch { /* informational only */ }

// 1. Baseline: warnings in the changed files at the base ref.
let baseWarnings = 0
let baseMember = 0
for (const f of files) {
  let content
  try {
    content = execFileSync('git', ['show', `${baseRef}:${f}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // no fatal stderr noise for new files
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    // File did not exist at base (brand new file) → baseline 0.
    continue
  }
  try {
    const res = await eslint.lintText(content, { filePath: path.resolve(process.cwd(), f) })
    const c = countWarnings(res.flatMap((r) => r.messages))
    baseWarnings += c.total
    baseMember += c.member
  } catch (err) {
    console.error(`[lint-gate] could not lint base version of ${f}: ${err.message}`)
    process.exit(2)
  }
}

// 2. Head: lint the working-tree/committed changed files.
const results = await eslint.lintFiles(files)
const headErrors = results.reduce((n, r) => n + (r.errorCount || 0), 0)
let headWarnings = 0
let headMember = 0
for (const r of results) {
  for (const m of r.messages) {
    if (m.severity === 1) {
      headWarnings++
      if (m.ruleId === MEMBER_RULE) headMember++
    }
  }
}

const limit = maxWarnings === null ? baseWarnings : Math.max(baseWarnings, maxWarnings)
const memberLimit = memberFloor === null ? baseMember : Math.max(baseMember, memberFloor)

if (headErrors > 0) {
  for (const r of results) {
    if (r.errorCount > 0) {
      for (const m of r.messages.filter((x) => x.severity === 2)) {
        console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId || ''}`)
      }
    }
  }
  console.error(`[lint-gate] FAIL: ${headErrors} error(s) in changed files.`)
  process.exit(1)
}

if (headWarnings > limit) {
  for (const r of results) {
    if (r.warningCount > 0) {
      for (const m of r.messages.filter((x) => x.severity === 1)) {
        console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId || ''}`)
      }
    }
  }
  console.error(
    `[lint-gate] FAIL: warnings increased (base ${baseWarnings} → head ${headWarnings}, limit ${limit}).`
  )
  process.exit(1)
}

if (headMember > memberLimit) {
  for (const r of results) {
    for (const m of r.messages.filter((x) => x.severity === 1 && x.ruleId === MEMBER_RULE)) {
      console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId}`)
    }
  }
  console.error(
    `[lint-gate] FAIL: ${MEMBER_RULE} warnings increased in changed files (base ${baseMember} → head ${headMember}, limit ${memberLimit}).` +
    (committedFloor !== null ? ` (whole-repo member-access floor: ${committedFloor})` : '')
  )
  process.exit(1)
}

const floorNote = committedFloor !== null ? `, member-access ${headMember} (base ${baseMember}, repo floor ${committedFloor})` : `, member-access ${headMember} (base ${baseMember})`
console.log(
  `[lint-gate] OK: ${headWarnings} warnings (base ${baseWarnings}), 0 errors across ${files.length} file(s)${floorNote}.`
)
process.exit(0)
