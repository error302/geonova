#!/usr/bin/env node
/**
 * lint-ratchets.mjs — ONE ESLint pass, TWO per-rule ratchets.
 *
 * Replaces the two ~2-3 min whole-repo lint passes (a11y-audit.mjs +
 * warning-ratchet.mjs) with a single `eslint.lintFiles()` run. From that one
 * pass it computes:
 *
 *   1. WARNING ratchet — per-rule counts of severity-1 messages compared
 *      against scripts/warning-baseline.json.
 *   2. A11Y ratchet     — per-rule counts of jsx-a11y/* messages (any
 *      severity) compared against scripts/a11y-baseline.json.
 *   3. MEMBER-ACCESS floor — @typescript-eslint/no-unsafe-member-access
 *      against scripts/member-access-baseline.json. This floor is DECOUPLED
 *      from the general warning baseline: --update never touches it, so the
 *      grind's constant re-baselining cannot silently absorb growth in this
 *      family. It moves ONLY via --update-member-access, meaning any growth
 *      fails CI until the batch work genuinely lowers the count.
 *
 * A rule absent from a baseline counts as baseline 0 — so a brand-new
 * violation (or newly enabled rule) fails the gate. This is the blocking
 * whole-repo lint step in ci.yml / pr-checks.yml.
 *
 * Usage:
 *   node scripts/lint-ratchets.mjs                     # verify all ratchets
 *   node scripts/lint-ratchets.mjs --write-audit       # verify + regenerate .a11y-audit.json
 *   node scripts/lint-ratchets.mjs --update            # snapshot current counts as baselines (NOT the member-access floor)
 *   node scripts/lint-ratchets.mjs --update-member-access  # ratchet ONLY the member-access floor
 *   node scripts/lint-ratchets.mjs --report            # print per-rule tables (verify still runs)
 *   node scripts/lint-ratchets.mjs --scope a,b         # lint only these paths (testing)
 *   node scripts/lint-ratchets.mjs --baseline-warnings p.json --baseline-a11y p.json --baseline-member-access p.json
 *   exit 0 = pass, 1 = ratchet exceeded, 2 = usage/run error
 *
 * The a11y evidence file (.a11y-audit.json) is written ONLY with --write-audit
 * or --update, always with repo-relative filePaths (machine-portable). Plain
 * verify runs are read-only so a scoped run can never clobber the committed
 * evidence file.
 *
 * Plugin resolution is pinned to the repo root (same trick as lint-gate.mjs)
 * to avoid the duplicate-plugin conflict in worktrees.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const UPDATE = args.includes('--update')
const WRITE_AUDIT = args.includes('--write-audit')
const REPORT = args.includes('--report')
const wIdx = args.indexOf('--baseline-warnings')
const WARN_BASELINE = wIdx >= 0 && args[wIdx + 1] ? args[wIdx + 1] : 'scripts/warning-baseline.json'
const aIdx = args.indexOf('--baseline-a11y')
const A11Y_BASELINE = aIdx >= 0 && args[aIdx + 1] ? args[aIdx + 1] : 'scripts/a11y-baseline.json'
// Dedicated no-unsafe-member-access floor — decoupled from the general
// warning baseline (see header). Moved ONLY by --update-member-access.
const MEMBER_RULE = '@typescript-eslint/no-unsafe-member-access'
const mIdx = args.indexOf('--baseline-member-access')
const MEMBER_BASELINE = mIdx >= 0 && args[mIdx + 1] ? args[mIdx + 1] : 'scripts/member-access-baseline.json'
const UPDATE_MEMBER = args.includes('--update-member-access')
// These two write DIFFERENT baselines and would silently drop the other's
// update — refuse to combine them instead of surprising the caller.
if (UPDATE && UPDATE_MEMBER) {
  console.error('[lint-ratchets] cannot combine --update and --update-member-access — they ratchet different baselines. Run them separately.')
  process.exit(2)
}
const scopeIdx = args.indexOf('--scope')
const SCOPE = scopeIdx >= 0 && args[scopeIdx + 1] ? args[scopeIdx + 1].split(',') : ['middleware.ts', 'src/']

// Some scoped runs (tests) operate in a partial checkout that may lack
// middleware.ts — drop scope entries that don't exist instead of failing.
const EXISTING_SCOPE = SCOPE.filter((p) => existsSync(p) || /[\/*?]/.test(p))
if (EXISTING_SCOPE.length !== SCOPE.length) {
  console.error(`[lint-ratchets] note: ${SCOPE.length - EXISTING_SCOPE.length} scope path(s) not present in this checkout, linting ${EXISTING_SCOPE.join(', ')}`)
}
if (EXISTING_SCOPE.length === 0) {
  console.error('[lint-ratchets] FATAL: no scope paths exist in this checkout — refusing to pass with 0 findings.')
  process.exit(2)
}

// The regenerated a11y audit evidence file (committed to the repo).
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

let results
try {
  results = await eslint.lintFiles(EXISTING_SCOPE)
} catch (err) {
  console.error(`[lint-ratchets] eslint run failed: ${err.message.split('\n')[0]}`)
  process.exit(2)
}

// One pass → both count maps.
const warningCounts = {}   // all severity-1 messages, keyed by ruleId
const a11yCounts = {}      // jsx-a11y/* messages at any severity
for (const r of results) {
  for (const m of r.messages) {
    if (m.severity === 1 && m.ruleId) {
      warningCounts[m.ruleId] = (warningCounts[m.ruleId] || 0) + 1
    }
    if (m.ruleId && m.ruleId.startsWith('jsx-a11y/')) {
      a11yCounts[m.ruleId] = (a11yCounts[m.ruleId] || 0) + 1
    }
  }
}

const warnTotal = Object.values(warningCounts).reduce((a, b) => a + b, 0)
const a11yTotal = Object.values(a11yCounts).reduce((a, b) => a + b, 0)

// Write the committed a11y evidence file ONLY when explicitly requested.
function writeAudit() {
  const cwdPrefix = process.cwd().split(/[\\/]/).join('/') + '/'
  const normalized = results.map((r) => ({
    ...r,
    filePath: r.filePath.split(/[\\/]/).join('/').replace(cwdPrefix, ''),
  }))
  try {
    writeFileSync(AUDIT_PATH, JSON.stringify(normalized, null, 2) + '\n')
    console.error(`[lint-ratchets] audit regenerated → ${AUDIT_PATH} (${normalized.length} files)`)
  } catch (err) {
    console.error(`[lint-ratchets] could not write audit file: ${err.message.split('\n')[0]}`)
    process.exit(2)
  }
}

if (WRITE_AUDIT) writeAudit()

if (UPDATE) {
  if (!WRITE_AUDIT) writeAudit()
  writeFileSync(WARN_BASELINE, JSON.stringify(warningCounts, null, 2) + '\n')
  writeFileSync(A11Y_BASELINE, JSON.stringify(a11yCounts, null, 2) + '\n')
  console.error(
    `[lint-ratchets] baselines written → ${WARN_BASELINE} (${Object.keys(warningCounts).length} rules, ${warnTotal} warnings), ${A11Y_BASELINE} (${Object.keys(a11yCounts).length} rules, ${a11yTotal} a11y findings)`
  )
  console.error(
    `[lint-ratchets] note: --update does NOT move the ${MEMBER_RULE} floor — use --update-member-access for that.`
  )
  process.exit(0)
}

// The member-access floor is a separate, deliberately-slow-moving gate. The
// general --update above intentionally leaves it alone so that re-baselining
// after unrelated batch work can't mask growth in this family.
if (UPDATE_MEMBER) {
  const memberNow = warningCounts[MEMBER_RULE] || 0
  writeFileSync(MEMBER_BASELINE, JSON.stringify({ [MEMBER_RULE]: memberNow }, null, 2) + '\n')
  console.error(
    `[lint-ratchets] member-access floor written → ${MEMBER_BASELINE} (${MEMBER_RULE}: ${memberNow} warnings)`
  )
  process.exit(0)
}

// ── Verify helpers ──────────────────────────────────────────────────────────
function loadBaseline(p) {
  if (!existsSync(p)) {
    console.error(`[lint-ratchets] baseline file "${p}" missing — run with --update first`)
    process.exit(2)
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    console.error(`[lint-ratchets] baseline file "${p}" is not valid JSON`)
    process.exit(2)
  }
}

function checkOne(label, counts, total, baselinePath) {
  const base = loadBaseline(baselinePath)
  const rules = new Set([...Object.keys(base), ...Object.keys(counts)])
  const rows = [...rules]
    .map((rule) => ({ rule, prev: base[rule] || 0, now: counts[rule] || 0 }))
    .sort((a, b) => b.now - a.now)
  const regressions = rows.filter((r) => r.now > r.prev)
  const totalBase = Object.values(base).reduce((a, b) => a + b, 0)

  if (REPORT || regressions.length) {
    console.error(`\n[lint-ratchets] ${label}: ${total} finding(s) (baseline ${totalBase}) — ${regressions.length} rule(s) over baseline`)
    const w = Math.max(...rows.map((r) => r.rule.length), 8)
    console.error(`  ${'rule'.padEnd(w)}  base   now`)
    console.error(`  ${'-'.repeat(w + 12)}`)
    for (const r of rows) {
      const flag = r.now > r.prev ? '  ⚠ EXCEEDS' : ''
      console.error(`  ${r.rule.padEnd(w)}  ${String(r.prev).padStart(4)} ${String(r.now).padStart(5)}${flag}`)
    }
  }
  return regressions
}

const warnRegressions = checkOne('warnings', warningCounts, warnTotal, WARN_BASELINE)
const a11yRegressions = checkOne('jsx-a11y findings', a11yCounts, a11yTotal, A11Y_BASELINE)

// Dedicated floor for the member-access family (see header). Independent of
// the general warning baseline so the batch grind can't absorb growth in it.
const memberNow = warningCounts[MEMBER_RULE] || 0
const memberBase = loadBaseline(MEMBER_BASELINE)
const memberPrev = memberBase[MEMBER_RULE] || 0
const memberOver = memberNow > memberPrev
if (REPORT || memberOver) {
  console.error(
    `\n[lint-ratchets] ${MEMBER_RULE} floor: ${memberNow} (floor ${memberPrev})${memberOver ? '  ⚠ EXCEEDS' : ''}`
  )
}

if (warnRegressions.length || a11yRegressions.length || memberOver) {
  console.error(
    `\n[lint-ratchets] FAIL: ${warnRegressions.length} warning rule(s) + ${a11yRegressions.length} a11y rule(s) exceeded baselines${memberOver ? `, and ${MEMBER_RULE} exceeded its dedicated floor` : ''}. Fix, or ratchet deliberately (--update for warnings/a11y, --update-member-access for the member-access floor).`
  )
  for (const r of warnRegressions) console.error(`  ❌ [warn] ${r.rule}: ${r.prev} → ${r.now}`)
  for (const r of a11yRegressions) console.error(`  ❌ [a11y] ${r.rule}: ${r.prev} → ${r.now}`)
  if (memberOver) console.error(`  ❌ [member-access] ${MEMBER_RULE}: ${memberPrev} → ${memberNow}`)
  process.exit(1)
}

console.error(`[lint-ratchets] OK: ${warnTotal} warnings + ${a11yTotal} a11y findings, all rules at/below baseline (${MEMBER_RULE} within its ${memberPrev}-warning floor).`)
process.exit(0)
