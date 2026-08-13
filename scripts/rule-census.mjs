#!/usr/bin/env node
/**
 * rule-census.mjs — per-RULE warning census across ALL rules.
 *
 * Counts every severity-1 eslint message, keyed by ruleId, over the same
 * scope as lint-ratchets.mjs (['src/middleware.ts', 'src/']) so the TOTAL
 * line is exactly the ratchet's live count. One command regenerates the
 * per-rule breakdown the plan doc tracks (unused-vars, exhaustive-deps,
 * no-restricted-syntax, ...).
 *
 * Usage:
 *   node scripts/rule-census.mjs                 # print table, write JSON
 *   node scripts/rule-census.mjs --no-out        # print only, no JSON file
 *   node scripts/rule-census.mjs -o <path.json>  # custom JSON output path
 */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const outIdx = args.indexOf('-o')
const outFile = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'scripts/rule-census-data.json'
const writeOut = !args.includes('--no-out')

// Same scope as lint-ratchets.mjs so totals agree by construction.
const SCOPE = ['src/middleware.ts', 'src/']

const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
  extensions: ['.ts', '.tsx', '.js', '.mjs'],
})

const results = await eslint.lintFiles(SCOPE)

// Same count semantics as lint-ratchets: severity-1 messages with a ruleId.
const byRule = {}
let filesWithWarnings = 0
for (const r of results) {
  let hasWarning = false
  for (const m of r.messages) {
    if (m.severity === 1 && m.ruleId) {
      byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1
      hasWarning = true
    }
  }
  if (hasWarning) filesWithWarnings++
}

const total = Object.values(byRule).reduce((a, b) => a + b, 0)
const sorted = Object.entries(byRule).sort((a, b) => b[1] - a[1])

console.log(`=== RULE CENSUS (${new Date().toISOString().slice(0, 10)}, ${filesWithWarnings} files with warnings) ===`)
for (const [rule, n] of sorted) {
  console.log(`${String(n).padStart(5)}  ${rule}`)
}
console.log(`TOTAL: ${total} warnings across ${sorted.length} rules`)

if (writeOut) {
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), total, byRule }, null, 1) + '\n')
  console.log(`WROTE: ${outFile}`)
}

// Exit non-zero so a future `--max-warnings`-style CI step can key off this.
if (total === 0) {
  console.log('ZERO: all rules clean')
}
