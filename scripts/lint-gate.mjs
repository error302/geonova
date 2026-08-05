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
 * Usage (mirrors CI):
 *   node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N]
 *   exit 0 = pass, 1 = fail, 2 = usage error
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
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const baseRef = args[0]
const rest = args.slice(1)
const maxWarningsIdx = rest.indexOf('--max-warnings')
let maxWarnings = null
let files = rest
if (maxWarningsIdx !== -1) {
  maxWarnings = Number(rest[maxWarningsIdx + 1])
  files = rest.slice(0, maxWarningsIdx).concat(rest.slice(maxWarningsIdx + 2))
}

if (!baseRef || files.length === 0) {
  console.error('usage: node scripts/lint-gate.mjs <base-ref> <file>... [--max-warnings N]')
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

async function countWarningsForContent(content, filename) {
  try {
    const results = await eslint.lintText(content, { filePath: path.resolve(process.cwd(), filename) })
    return results.reduce((n, r) => n + (r.warningCount || 0), 0)
  } catch (err) {
    console.error(`[lint-gate] could not lint base version of ${filename}: ${err.message}`)
    return 0
  }
}

// 1. Baseline: warnings in the changed files at the base ref.
let baseWarnings = 0
for (const f of files) {
  try {
    const content = execFileSync('git', ['show', `${baseRef}:${f}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    baseWarnings += await countWarningsForContent(content, f)
  } catch {
    // File did not exist at base (brand new file) → baseline 0.
  }
}

// 2. Head: lint the working-tree/committed changed files.
const results = await eslint.lintFiles(files)
const headErrors = results.reduce((n, r) => n + (r.errorCount || 0), 0)
const headWarnings = results.reduce((n, r) => n + (r.warningCount || 0), 0)

const limit = maxWarnings === null ? baseWarnings : Math.max(baseWarnings, maxWarnings)

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

console.log(
  `[lint-gate] OK: ${headWarnings} warnings (base ${baseWarnings}), 0 errors across ${files.length} file(s).`
)
process.exit(0)
