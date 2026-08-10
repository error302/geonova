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
 * --max-warnings; when a floor flag is omitted, the committed whole-repo
 * floor is auto-loaded from its dedicated baseline file instead (for ALL
 * runs, not just CI) — inert while the repo is within its floor, binding
 * once the grind shrinks it. CI therefore needs no inline floor reads.
 *
 * BASE-REF RESOLUTION (--paths-from-changed with no base-ref positional):
 * mirrors the workflow 'Determine base ref' step this script replaces —
 * pull_request events diff against origin/<base> (GITHUB_BASE_REF, fallback
 * origin/main), push events diff against the previous commit
 * (github.event.before read from the GITHUB_EVENT_PATH payload; an all-zero
 * 'first push' falls back to HEAD~1), and anything else (local runs,
 * workflow_dispatch) falls back to HEAD~1. CI is now a single flag call
 * with no inline bash.
 *
 * Usage (mirrors CI):
 *   node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]
 *   node scripts/lint-gate.mjs --paths-from-changed [base-ref] [--max-warnings N] [--member-floor N] [--floor-assignment N] [--floor-explicit-any N]
 *   exit 0 = pass, 1 = fail, 2 = usage error
 *
 * BASE PASS ISOLATION (--base-only, internal): the base pass lints `git show`
 * text via lintText, and @typescript-eslint's TS-program cache is MODULE-LEVEL
 * — shared by every ESLint instance in one process. Running the base pass in
 * the same process as the head pass therefore poisons the cached program, and
 * the head pass reports spurious "type cannot be resolved" warnings on fully
 * typed files (observed on the CI runner; the earlier two-instance isolation
 * did NOT fix it because the cache ignores instance count). The parent spawns
 * a fresh `node` process with --base-only so the head pass always lints
 * against a clean program cache.
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
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const MEMBER_RULE = '@typescript-eslint/no-unsafe-member-access'
const ASSIGNMENT_RULE = '@typescript-eslint/no-unsafe-assignment'
const EXPLICIT_ANY_RULE = '@typescript-eslint/no-explicit-any'
const ARGUMENT_RULE = '@typescript-eslint/no-unsafe-argument'

const args = process.argv.slice(2)

// Single pass: pull out known flags + their values; everything else is
// positional (base ref + file list). Flag order is irrelevant.
let PFC = false
let BASE_ONLY = false
let maxWarnings = null
let memberFloor = null
let assignmentFloor = null
let explicitAnyFloor = null
let argumentFloor = null
const positional = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--paths-from-changed') {
    PFC = true
  } else if (a === '--base-only') {
    BASE_ONLY = true
  } else if (a === '--max-warnings' || a === '--member-floor' || a === '--floor-assignment' || a === '--floor-explicit-any' || a === '--floor-argument') {
    const v = Number(args[++i])
    if (!Number.isFinite(v)) {
      console.error(`[lint-gate] ${a} requires a numeric value (got "${args[i]}").`)
      process.exit(2)
    }
    if (a === '--max-warnings') maxWarnings = v
    else if (a === '--member-floor') memberFloor = v
    else if (a === '--floor-assignment') assignmentFloor = v
    else if (a === '--floor-explicit-any') explicitAnyFloor = v
    else argumentFloor = v
  } else if (a.startsWith('--')) {
    console.error(`[lint-gate] unknown flag: ${a}`)
    process.exit(2)
  } else {
    positional.push(a)
  }
}

// Resolve the base ref for --paths-from-changed when CI passes no positional.
// Mirrors the 'Determine base ref' workflow step this script replaces: PRs
// diff against the merge target, pushes against the previous commit, and
// anything else falls back to HEAD~1 (first push, local runs).
function resolveBaseRefFromEnv() {
  const eventName = process.env.GITHUB_EVENT_NAME
  if (eventName === 'pull_request') {
    const base = process.env.GITHUB_BASE_REF
    return base ? `origin/${base}` : 'origin/main'
  }
  if (eventName === 'push') {
    const eventPath = process.env.GITHUB_EVENT_PATH
    if (eventPath) {
      try {
        const payload = JSON.parse(readFileSync(eventPath, 'utf8'))
        if (payload.before && !/^0+$/.test(payload.before)) return payload.before
      } catch { /* unreadable payload → HEAD~1 fallback */ }
    }
  }
  return 'HEAD~1'
}

let baseRef
let files
if (PFC) {
  // An explicit base-ref positional always wins; otherwise resolve it from
  // the CI event context (PR → origin/<base>, push → event.before, HEAD~1).
  if (positional.length > 0) {
    baseRef = positional.shift()
  } else {
    baseRef = resolveBaseRefFromEnv()
    console.log(`[lint-gate] no base ref given — resolved: ${baseRef}`)
  }
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
    const raw = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', diffRef, '--', 'src/middleware.ts', 'src/*.ts', 'src/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'], {
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
// The BASE pass runs in a CHILD PROCESS (--base-only), NOT a second instance:
// @typescript-eslint's TS-program cache is MODULE-LEVEL, so every ESLint
// instance inside one process shares it. The base pass lints `git show` text
// whose content differs from the on-disk HEAD files; sharing a process with
// the head pass lets it poison the cached program, and the head pass then
// reports spurious "type cannot be resolved" warnings on fully-typed files
// (observed on the CI runner — the earlier two-instance isolation did NOT
// fix it, because the cache is shared regardless of instance count). A fresh
// process gets a fresh module state, guaranteeing the head pass always lints
// against a clean program.
const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslintOptions = {
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
}

function countWarnings(messages) {
  let total = 0
  let member = 0
  let assignment = 0
  let explicitAny = 0
  let argument = 0
  for (const m of messages) {
    if (m.severity === 1) {
      total++
      if (m.ruleId === MEMBER_RULE) member++
      else if (m.ruleId === ASSIGNMENT_RULE) assignment++
      else if (m.ruleId === EXPLICIT_ANY_RULE) explicitAny++
      else if (m.ruleId === ARGUMENT_RULE) argument++
    }
  }
  return { total, member, assignment, explicitAny, argument }
}

// CHILD MODE (internal): compute the base warnings only and emit a single
// JSON line to stdout (diagnostics stay on stderr). Invoked by the parent via
// spawnSync so it runs in a fresh process with a clean TS-program cache.
if (BASE_ONLY) {
  const eslintBase = new ESLint(eslintOptions)
  let baseWarnings = 0
  let baseMember = 0
  let baseAssignment = 0
  let baseExplicitAny = 0
  let baseArgument = 0
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
      const res = await eslintBase.lintText(content, { filePath: path.resolve(process.cwd(), f) })
      const c = countWarnings(res.flatMap((r) => r.messages))
      baseWarnings += c.total
      baseMember += c.member
      baseAssignment += c.assignment
      baseExplicitAny += c.explicitAny
      baseArgument += c.argument
    } catch (err) {
      console.error(`[lint-gate] could not lint base version of ${f}: ${err.message}`)
      process.exit(2)
    }
  }
  console.log(JSON.stringify({ total: baseWarnings, member: baseMember, assignment: baseAssignment, explicitAny: baseExplicitAny, argument: baseArgument }))
  process.exit(0)
}

const eslintHead = new ESLint(eslintOptions)

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
  [ARGUMENT_RULE, 'scripts/argument-baseline.json'],
]) {
  try {
    if (existsSync(file)) {
      const b = JSON.parse(readFileSync(file, 'utf8'))
      committedFloors[rule] = b[rule] ?? null
    }
  } catch { /* informational only */ }
}

// 1. Baseline: warnings in the changed files at the base ref — computed in a
// child process (--base-only) so its TS-program cache can never leak into
// the head pass below.
const child = spawnSync(
  process.execPath,
  [path.resolve(process.argv[1]), '--base-only', baseRef, ...files],
  {
    encoding: 'utf8',
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
)
if (child.status !== 0) {
  console.error(`[lint-gate] base pass failed:` + (child.stderr ? `\n${child.stderr.trim()}` : ` exit ${child.status}`))
  process.exit(2)
}
let baseCounts
const stdoutLines = child.stdout.trim().split('\n')
try {
  baseCounts = JSON.parse(stdoutLines[stdoutLines.length - 1])
} catch {
  console.error(`[lint-gate] base pass produced unparseable output: ${child.stdout.slice(0, 200)}`)
  process.exit(2)
}
const baseWarnings = baseCounts.total
const baseMember = baseCounts.member
const baseAssignment = baseCounts.assignment
const baseExplicitAny = baseCounts.explicitAny
const baseArgument = baseCounts.argument

// 2. Head: lint the working-tree/committed changed files.
const results = await eslintHead.lintFiles(files)
const headErrors = results.reduce((n, r) => n + (r.errorCount || 0), 0)
let headWarnings = 0
let headMember = 0
let headAssignment = 0
let headExplicitAny = 0
let headArgument = 0
for (const r of results) {
  for (const m of r.messages) {
    if (m.severity === 1) {
      headWarnings++
      if (m.ruleId === MEMBER_RULE) headMember++
      else if (m.ruleId === ASSIGNMENT_RULE) headAssignment++
      else if (m.ruleId === EXPLICIT_ANY_RULE) headExplicitAny++
      else if (m.ruleId === ARGUMENT_RULE) headArgument++
    }
  }
}

const limit = maxWarnings === null ? baseWarnings : Math.max(baseWarnings, maxWarnings)
// Family ceilings default to the committed whole-repo floors (auto-loaded
// from the dedicated baseline files by the committedFloors block above) so
// CI needs no inline floor reads; an explicit --*-floor N still overrides.
// Each ceiling is max(base-in-changed-files, N) — inert while floors are
// large, binding once the grind shrinks them.
const memberFloorN = memberFloor !== null ? memberFloor : (committedFloors[MEMBER_RULE] ?? null)
const assignmentFloorN = assignmentFloor !== null ? assignmentFloor : (committedFloors[ASSIGNMENT_RULE] ?? null)
const explicitAnyFloorN = explicitAnyFloor !== null ? explicitAnyFloor : (committedFloors[EXPLICIT_ANY_RULE] ?? null)
const argumentFloorN = argumentFloor !== null ? argumentFloor : (committedFloors[ARGUMENT_RULE] ?? null)
const memberLimit = memberFloorN === null ? baseMember : Math.max(baseMember, memberFloorN)
const assignmentLimit = assignmentFloorN === null ? baseAssignment : Math.max(baseAssignment, assignmentFloorN)
const explicitAnyLimit = explicitAnyFloorN === null ? baseExplicitAny : Math.max(baseExplicitAny, explicitAnyFloorN)
const argumentLimit = argumentFloorN === null ? baseArgument : Math.max(baseArgument, argumentFloorN)

// Always show the comparison so CI logs are self-diagnosing (the FAIL line
// itself can still be buried under thousands of message lines).
console.error(
  `[lint-gate] changed files: ${files.length}, base ${baseWarnings} warnings (member ${baseMember}, assignment ${baseAssignment}, explicit-any ${baseExplicitAny}, argument ${baseArgument}) vs head ${headWarnings} warnings (member ${headMember}, assignment ${headAssignment}, explicit-any ${headExplicitAny}, argument ${headArgument}), errors ${headErrors}`
)

// Collect the failure instead of process.exit(1) mid-print: console.error to
// a pipe is async, and process.exit() drops pending writes — the FAIL line
// was vanishing from CI logs on the very failures the gate caught. Setting
// process.exitCode lets Node drain the output before exiting.
let failMessage = null

if (headErrors > 0) {
  for (const r of results) {
    if (r.errorCount > 0) {
      for (const m of r.messages.filter((x) => x.severity === 2)) {
        console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId || ''}`)
      }
    }
  }
  failMessage = `[lint-gate] FAIL: ${headErrors} error(s) in changed files.`
} else if (headWarnings > limit) {
  for (const r of results) {
    if (r.warningCount > 0) {
      for (const m of r.messages.filter((x) => x.severity === 1)) {
        console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId || ''}`)
      }
    }
  }
  failMessage = `[lint-gate] FAIL: warnings increased (base ${baseWarnings} → head ${headWarnings}, limit ${limit}).`
}

// Family-floor checks: fail when a gated family grows beyond its limit.
// Shared helper keeps the four (member-access, assignment, explicit-any, argument)
// checks identical — only the rule/counts differ. First failing family wins.
const familyFail = (rule, head, base, limit) => {
  if (failMessage || head <= limit) return
  for (const r of results) {
    for (const m of r.messages.filter((x) => x.severity === 1 && x.ruleId === rule)) {
      console.error(`  ${r.filePath}:${m.line}:${m.column}  ${m.message}  ${m.ruleId}`)
    }
  }
  const repoFloor = committedFloors[rule]
  failMessage =
    `[lint-gate] FAIL: ${rule} warnings increased in changed files (base ${base} → head ${head}, limit ${limit}).` +
    (repoFloor !== undefined && repoFloor !== null ? ` (whole-repo floor: ${repoFloor})` : '')
}
familyFail(MEMBER_RULE, headMember, baseMember, memberLimit)
familyFail(ASSIGNMENT_RULE, headAssignment, baseAssignment, assignmentLimit)
familyFail(EXPLICIT_ANY_RULE, headExplicitAny, baseExplicitAny, explicitAnyLimit)
familyFail(ARGUMENT_RULE, headArgument, baseArgument, argumentLimit)

if (failMessage) {
  console.error(failMessage)
  process.exitCode = 1
} else {
  const familyStats = [
    { rule: MEMBER_RULE, label: 'member-access', head: headMember, base: baseMember },
    { rule: ASSIGNMENT_RULE, label: 'assignment', head: headAssignment, base: baseAssignment },
    { rule: EXPLICIT_ANY_RULE, label: 'explicit-any', head: headExplicitAny, base: baseExplicitAny },
    { rule: ARGUMENT_RULE, label: 'argument', head: headArgument, base: baseArgument },
  ]
  const familyNotes = familyStats.map(({ rule, label, head, base }) => {
    const repoFloor = committedFloors[rule]
    return `${label} ${head} (base ${base}${repoFloor !== undefined && repoFloor !== null ? `, repo floor ${repoFloor}` : ''})`
  })
  console.log(
    `[lint-gate] OK: ${headWarnings} warnings (base ${baseWarnings}), 0 errors across ${files.length} file(s), ${familyNotes.join(', ')}.`
  )
  process.exitCode = 0
}
