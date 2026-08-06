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
 * FAMILY FLOORS: the fast changed-files analogue of the whole-repo per-rule
 * ratchets in lint-ratchets.mjs. A changed file must not ADD warnings in a
 * gated family (head > base in that family fails the gate) — so a PR gets a
 * ~30s regression check before the slow whole-repo ratchet runs. Currently
 * gated: no-unsafe-member-access (--member-floor), no-unsafe-assignment
 * (--floor-assignment), no-explicit-any (--floor-explicit-any). Each
 * --*-floor N raises that family's ceiling to max(baseFamily, N), mirroring
 * --max-warnings.
 *
 * Usage (mirrors CI):
 *   node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]
 *   node scripts/lint-gate.mjs --paths-from-changed [base-ref] [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]
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
const ASSIGNMENT_RULE = '@typescript-eslint/no-unsafe-assignment'
const EXPLICIT_ANY_RULE = '@typescript-eslint/no-explicit-any'

const args = process.argv.slice(2)

// Single pass: pull out known flags + their values; everything else is
// positional (base ref + file list). Flag order is irrelevant.
let PFC = false
let maxWarnings = null
let memberFloor = null
let assignmentFloor = null
let explicitAnyFloor = null
const positional = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--paths-from-changed') {
    PFC = true
  } else if (a === '--max-warnings' || a === '--member-floor' || a === '--floor-assignment' || a === '--floor-explicit-any') {
    const v = Number(args[++i])
    if (!Number.isFinite(v)) {
      console.error(`[lint-gate] ${a} requires a numeric value (got "${args[i]}").`)
      process.exit(2)
    }
    if (a === '--max-warnings') maxWarnings = v
    else if (a === '--member-floor') memberFloor = v
    else if (a === '--floor-assignment') assignmentFloor = v
    else explicitAnyFloor = v
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
  console.error('usage: node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]')
  console.error('   or: node scripts/lint-gate.mjs --paths-from-changed [base-ref] [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]')
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
  let assignment = 0
  let explicitAny = 0
  for (const m of messages) {
    if (m.severity === 1) {
      total++
      if (m.ruleId === MEMBER_RULE) member++
      else if (m.ruleId === ASSIGNMENT_RULE) assignment++
      else if (m.ruleId === EXPLICIT_ANY_RULE) explicitAny++
    }
  }
  return { total, member, assignment, explicitAny }
}

// Committed whole-repo family floors — informational context only. The
// changed-files gate is a regression check (head > base), not the repo floor.
// Every family lives in its own decoupled baseline file (written by
// lint-ratchets --update-<family>). Each load is isolated so a malformed or
// missing file only drops that family's context.
const committedFloors = {}
for (const [rule, file] of [
  [MEMBER_RULE, 'scripts/member-access-baseline.json'],
  [ASSIGNMENT_RULE, 'scripts/assignment-baseline.json'],
  [EXPLICIT_ANY_RULE, 'scripts/explicit-any-baseline.json'],
]) {
  try {
    if (existsSync(file)) {
      const b = JSON.parse(readFileSync(file, 'utf8'))
      committedFloors[rule] = b[rule] ?? null
    }
  } catch { /* informational only */ }
}

// 1. Baseline: warnings in the changed files at the base ref.
let baseWarnings = 0
let baseMember = 0
let baseAssignment = 0
let baseExplicitAny = 0
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
    baseAssignment += c.assignment
    baseExplicitAny += c.explicitAny
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
let headAssignment = 0
let headExplicitAny = 0
for (const r of results) {
  for (const m of r.messages) {
    if (m.severity === 1) {
      headWarnings++
      if (m.ruleId === MEMBER_RULE) headMember++
      else if (m.ruleId === ASSIGNMENT_RULE) headAssignment++
      else if (m.ruleId === EXPLICIT_ANY_RULE) headExplicitAny++
    }
  }
}

const limit = maxWarnings === null ? baseWarnings : Math.max(baseWarnings, maxWarnings)
const memberLimit = memberFloor === null ? baseMember : Math.max(baseMember, memberFloor)
const assignmentLimit = assignmentFloor === null ? baseAssignment : Math.max(baseAssignment, assignmentFloor)
const explicitAnyLimit = explicitAnyFloor === null ? baseExplicitAny : Math.max(baseExplicitAny, explicitAnyFloor)

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

// Family-floor checks: fail when a gated family grows beyond its limit.
// Shared helper keeps the three (member-access, assignment, explicit-any)
// checks identical — only the rule/counts differ.
const familyFail = (rule, head, base, limit) => {
  if (head <= limit) return
  for (const r of results) {
    for (const m of r.messages.filter((x) => x.severity === 1 && x.ruleId === rule)) {
      console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId}`)
    }
  }
  const repoFloor = committedFloors[rule]
  console.error(
    `[lint-gate] FAIL: ${rule} warnings increased in changed files (base ${base} → head ${head}, limit ${limit}).` +
    (repoFloor !== undefined && repoFloor !== null ? ` (whole-repo floor: ${repoFloor})` : '')
  )
  process.exit(1)
}
familyFail(MEMBER_RULE, headMember, baseMember, memberLimit)
familyFail(ASSIGNMENT_RULE, headAssignment, baseAssignment, assignmentLimit)
familyFail(EXPLICIT_ANY_RULE, headExplicitAny, baseExplicitAny, explicitAnyLimit)

const familyStats = [
  { rule: MEMBER_RULE, label: 'member-access', head: headMember, base: baseMember },
  { rule: ASSIGNMENT_RULE, label: 'assignment', head: headAssignment, base: baseAssignment },
  { rule: EXPLICIT_ANY_RULE, label: 'explicit-any', head: headExplicitAny, base: baseExplicitAny },
]
const familyNotes = familyStats.map(({ rule, label, head, base }) => {
  const repoFloor = committedFloors[rule]
  return `${label} ${head} (base ${base}${repoFloor !== undefined && repoFloor !== null ? `, repo floor ${repoFloor}` : ''})`
})
console.log(
  `[lint-gate] OK: ${headWarnings} warnings (base ${baseWarnings}), 0 errors across ${files.length} file(s), ${familyNotes.join(', ')}.`
)
process.exit(0)
