#!/usr/bin/env node
/**
 * member-scan.cjs — ranked remediation plan data for no-unsafe-member-access.
 *
 * Lints the whole repo (ESLint Node API, same scope as lint-ratchets.mjs),
 * then for every @typescript-eslint/no-unsafe-member-access message extracts
 * the identifier chain at the violation's line/column from the source text
 * and classifies the dominant "any source" per file:
 *
 *   refs    — .current / useRef / MutableRefObject chains
 *   events  — e / event / evt / ev / target / change handlers
 *   fetch   — res / response / data / json / result / body from fetches
 *   db      — rows / row / .Res query results (db.query)
 *   builders— doc / ctx / canvas / pdf (jsPDF / canvas 2d)
 *   ol      — map / layer / feature / view / source / ol.*
 *   props   — props / params / arg / args / ctx (request context)
 *   other   — anything not matched
 *
 * Usage: node scripts/member-scan.cjs [--top N] [--out path.json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const topIdx = args.indexOf('--top')
const TOP = topIdx >= 0 ? Number(args[topIdx + 1]) : 25
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : null

const { ESLint } = await import(
  pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
)

const eslint = new ESLint({
  cwd: process.cwd(),
  resolvePluginsRelativeTo: process.cwd(),
  useEslintrc: true,
})

const results = await eslint.lintFiles(['middleware.ts', 'src/**/*.{ts,tsx}'])

// Map a chain root to a broad any-source family. The root is the first
// identifier (or a recognizable container like rows[i]/obs/row/data/fetched
// results). Order matters: db-row containers win over generic names.
function classify(chain) {
  const s = chain.toLowerCase()
  const root = chain.split(/[.[]/)[0]
  const rl = root.toLowerCase()
  if (s.includes('.current')) return 'refs'
  if (/^rows?$/.test(root) || /^row$/.test(root) || /res\./.test(s) || /\.rows\[/.test(s) || /^records?$/.test(root) || /^record$/.test(root) || /^obs$/.test(root) || /^coord$/.test(root) || /^coords$/.test(root) || /^stations?$/.test(root) || /^points?$/.test(root) || /^boundarypoints?$/.test(root) || /^traverses?$/.test(root) || /^legs?$/.test(root) || /^parcels?$/.test(root)) return 'db'
  if (/^(e|ev|evt|event|evnt)$/.test(root)) return 'events'
  if (s.includes('.target')) return 'events'
  if (/^(res|resp|response|data|json|result|body|payload|fetched)$/.test(root) || /^fetch/.test(root)) return 'fetch'
  if (/^(doc|pdf)$/.test(root) || /^ctx$/.test(root) && s.includes('.beginpath') || /^canvas$/.test(root)) return 'builders'
  if (/^(map|layer|feature|view|source|vector)$/.test(root) || rl.startsWith('ol')) return 'ol'
  if (/^(props|params|arg|args|req|request)$/.test(root)) return 'props'
  if (/^(project|config|settings|options|data|result|output|input|item|obj|obj2|something|anything|value|values|current|prev|next)$/.test(root)) return 'other-object'
  return 'other'
}

// Extract the identifier chain ending at the violation column on its line.
function chainAtLine(lineText, column) {
  const clean = lineText.replace(/\r$/, '')
  const before = clean.slice(0, column - 1)
  const m = before.match(/([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[[^\]]*\])*)$/)
  return m ? m[1] : clean.trim().slice(0, 40)
}

const perFile = new Map() // path -> { total, categories: {cat: n}, samples: string[] }
let grand = 0

for (const r of results) {
  const rel = r.filePath.split(/[\\/]/).join('/').replace(process.cwd().split(/[\\/]/).join('/') + '/', '')
  const msgs = r.messages.filter((m) => m.ruleId === '@typescript-eslint/no-unsafe-member-access')
  if (!msgs.length) continue
  let entry = perFile.get(rel)
  if (!entry) {
    entry = { total: 0, categories: {}, samples: [] }
    perFile.set(rel, entry)
  }
  const lineCache = new Map()
  for (const m of msgs) {
    grand++
    entry.total++
    if (!lineCache.has(m.line)) {
      lineCache.set(m.line, r.source && r.source.split('\n')[m.line - 1] || '')
    }
    const chain = chainAtLine(lineCache.get(m.line), m.column)
    const cat = classify(chain)
    entry.categories[cat] = (entry.categories[cat] || 0) + 1
    if (entry.samples.length < 3) entry.samples.push(`${chain}`)
  }
}

const files = [...perFile.entries()]
  .map(([file, e]) => {
    const [dominant, domCount] = Object.entries(e.categories).sort((a, b) => b[1] - a[1])[0]
    return {
      file,
      total: e.total,
      dominant,
      domShare: Math.round((domCount / e.total) * 100),
      cats: e.categories,
      samples: e.samples,
    }
  })
  .sort((a, b) => b.total - a.total)

// Aggregate category totals + file counts
const catTotals = {}
for (const f of files) for (const [c, n] of Object.entries(f.cats)) catTotals[c] = (catTotals[c] || 0) + n

console.log(`\n=== MEMBER-ACCESS SCAN (whole repo) ===`)
console.log(`total member-access warnings: ${grand}  across ${files.length} files`)
console.log(`\n=== by any-source category ===`)
for (const [c, n] of Object.entries(catTotals).sort((a, b) => b[1] - a[1])) {
  const fcount = files.filter((f) => f.dominant === c).length
  console.log(`  ${c.padEnd(9)} ${String(n).padStart(5)} warnings  (dominant in ${String(fcount).padStart(3)} files)`)
}

console.log(`\n=== TOP ${TOP} FILES (by warning count) ===`)
console.log(`  ${'count'.padStart(5)}  ${'dom%'.padStart(4)}  dom     file`)
for (const f of files.slice(0, TOP)) {
  console.log(`  ${String(f.total).padStart(5)}  ${String(f.domShare).padStart(3)}%  ${f.dominant.padEnd(8)} ${f.file}`)
}

if (OUT) writeFileSync(OUT, JSON.stringify({ grand, files, catTotals }, null, 2))
console.log(`\n[member-scan] JSON written to ${OUT}`)
