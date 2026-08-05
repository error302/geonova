#!/usr/bin/env node
/**
 * warn-scan.mjs — per-file warning census across ALL rules.
 * Outputs a JSON file ranked by total warnings, with per-file rule composition.
 * Usage: node scripts/warn-scan.mjs [out.json]
 */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const outFile = process.argv[2] || 'scripts/warn-plan-data.json'
const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)
const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
})

const SKIP = new Set(['react-hooks/exhaustive-deps'])
const results = await eslint.lintFiles(['src', 'middleware.ts'])

const perFile = []
for (const r of results) {
  const rel = r.filePath.split(/[\\/]/).join('/').replace(process.cwd().split(/[\\/]/).join('/') + '/', '')
  const rules = {}
  let total = 0
  for (const m of r.messages) {
    if (m.severity !== 1) continue
    if (SKIP.has(m.ruleId)) continue
    rules[m.ruleId] = (rules[m.ruleId] || 0) + 1
    total++
  }
  if (total > 0) perFile.push({ file: rel, total, rules })
}
perFile.sort((a, b) => b.total - a.total)

const byRule = {}
for (const f of perFile) {
  for (const [rule, n] of Object.entries(f.rules)) {
    byRule[rule] = (byRule[rule] || 0) + n
  }
}

writeFileSync(outFile, JSON.stringify({ byRule, files: perFile }, null, 1))
console.log('FILES:', perFile.length)
console.log('TOTAL:', perFile.reduce((s, f) => s + f.total, 0))
console.log('BY RULE:', JSON.stringify(byRule, null, 0))
console.log('TOP 25 FILES:')
for (const f of perFile.slice(0, 25)) {
  console.log(`  ${String(f.total).padStart(4)}  ${f.file}`)
}
