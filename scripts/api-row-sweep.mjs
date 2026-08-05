#!/usr/bin/env node
/**
 * api-row-sweep.mjs — semi-automated row-typing worklist for API routes.
 *
 * Scans every route file (src, glob: route.ts anywhere under it) and reports, per file:
 *
 *   1. Every db.query / db.transaction(client.query) call:
 *        - line number, whether it already has a <RowType> generic,
 *        - the SQL (normalised, truncated),
 *        - the likely table (FROM/JOIN/UPDATE/INSERT ... RETURNING),
 *        - a SUGGESTED row-interface name for it (snake_case table ->
 *          PascalCase + "Row"), e.g. scheme_parcels -> SchemeParcelRow.
 *   2. The row interfaces ALREADY declared in that file (interface XxxRow),
 *      so you can see which suggested names already exist (and reuse them
 *      instead of redeclaring).
 *
 * The point is to let one pass over the report type dozens of routes:
 * for each untyped query, you add `db.query<SuggestedRow>(...)` and insert
 * the interface (copy from --draft output or a neighbouring file).
 *
 * Usage:
 *   node scripts/api-row-sweep.mjs                      # full report
 *   node scripts/api-row-sweep.mjs --top 40             # only the 40 busiest files
 *   node scripts/api-row-sweep.mjs --untyped-only       # only queries lacking <T>
 *   node scripts/api-row-sweep.mjs --json               # machine-readable JSON
 *   node scripts/api-row-sweep.mjs --no-member-scan     # skip eslint (faster)
 *   node scripts/api-row-sweep.mjs --routes 'scheme|rim'# only matching paths
 *
 * Output: per-file sections sorted by query count (desc), each listing the
 * queries, then the interfaces already declared.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nodeFs = require('node:fs')

const args = process.argv.slice(2)
const topIdx = args.indexOf('--top')
const TOP = topIdx >= 0 ? Number(args[topIdx + 1]) : Infinity
const untypedOnly = args.includes('--untyped-only')
const asJson = args.includes('--json')
const skipMember = args.includes('--no-member-scan')
const routesIdx = args.indexOf('--routes')
const ROUTES_RE = routesIdx >= 0 ? new RegExp(args[routesIdx + 1]) : null

// ---------------------------------------------------------------------------
// Route discovery — every Next.js route handler
// ---------------------------------------------------------------------------

function findRoutes() {
  let files = []
  if (typeof nodeFs.globSync === 'function') {
    files = nodeFs.globSync('src/**/route.ts', { cwd: process.cwd() }) ?? []
  } else {
    // Node < 22 fallback — tiny recursive walk
    const walk = (dir) => {
      for (const ent of nodeFs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(p)
        else if (ent.name === 'route.ts') files.push(p)
      }
    }
    walk('src')
  }
  return files
    .map((f) => f.split(/[\\/]/).join('/'))
    .filter((f) => !f.includes('/__tests__/'))
    .filter((f) => !ROUTES_RE || ROUTES_RE.test(f))
    .sort()
}

// ---------------------------------------------------------------------------
// Query extraction — find db.query / client.query calls with their SQL
// ---------------------------------------------------------------------------

const QUERY_RE = /\b(?:db|client)\.query\s*(?:<([^>]*?(?:<[^>]*>)?[^>]*)>)?\s*\(/g
const STRING_RE = /^\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/
const VAR_RE = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)/

/**
 * Extract `{ line, typed, typeArg, sql, table, suggested }` for every query.
 * Handles string, template, and parameterised (sql, params) call forms.
 */
function extractQueries(source) {
  const queries = []
  let m
  QUERY_RE.lastIndex = 0
  while ((m = QUERY_RE.exec(source))) {
    const typeArg = m[1]?.trim() || null
    const after = source.slice(QUERY_RE.lastIndex)
    const s = STRING_RE.exec(after)
    let sql = null
    let dynamicVar = null
    if (s) {
      sql = s[2]
      // Normalise: template-literal ${...} interpolations and escaped quotes
      if (s[1] === '`') {
        sql = sql.replace(/\$\{[^}]*\}/g, '${...}')
      }
    } else {
      const v = VAR_RE.exec(after)
      if (v) dynamicVar = v[1]
      // Resolve `const sql = \`...\`` / `let sql = '...'` defined above the call
      if (dynamicVar) {
        // const sql = '...' / \"...\" / `...` — char-class quote avoids backticks in the literal
        const decl = new RegExp('(?:const|let|var)\\s+' + dynamicVar + '\\s*=\\s*([\'"`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1', 'gs')
        let dm
        while ((dm = decl.exec(source)) && dm.index < m.index) {
          sql = dm[2].replace(/\$\{[^}]*\}/g, '${...}')
        }
      }
    }
    const line = source.slice(0, m.index).split('\n').length
    const table = sql ? tableFromSql(sql) : null
    queries.push({
      line,
      typed: !!typeArg,
      typeArg,
      sql: sql
        ? sql.replace(/\s+/g, ' ').trim().slice(0, 140)
        : dynamicVar
          ? `(dynamic sql via ${dynamicVar})`
          : '(dynamic sql — expression)',
      table,
      suggested: sql ? suggestedRowName(sql, table) : null,
    })
  }
  return queries
}

/** Best-guess table name from SQL (FROM/JOIN/UPDATE/INSERT ... RETURNING). */
function tableFromSql(sql) {
  const from = /\bFROM\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  const join = /\bJOIN\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  const update = /\bUPDATE\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  const insert = /\bINTO\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  return (from || update || insert) ? (from || update || insert)[1] : (join ? join[1] : null)
}

/** snake_case table -> PascalCase + Row. Falls back to a generic name. */
function suggestedRowName(sql, table) {
  if (!table) return null
  const parts = table.split('_').filter(Boolean)
  // Strip trailing plural for a singular row name (traverse_results -> TraverseResultRow)
  if (parts.length > 0) {
    const last = parts[parts.length - 1]
    if (last.endsWith('ies') && last.length > 4) parts[parts.length - 1] = last.slice(0, -3) + 'y'
    else if (last.endsWith('s') && !last.endsWith('ss') && last.length > 3) parts[parts.length - 1] = last.slice(0, -1)
  }
  const name = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('') + 'Row'
  // Don't suggest a name for SELECT 1 health checks
  if (/^select\s+1\b/i.test(sql)) return null
  return name
}

// ---------------------------------------------------------------------------
// Interface extraction — already-declared row interfaces
// ---------------------------------------------------------------------------

const INTERFACE_RE = /interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/g

function extractInterfaces(source) {
  const out = []
  let m
  INTERFACE_RE.lastIndex = 0
  while ((m = INTERFACE_RE.exec(source))) {
    const line = source.slice(0, m.index).split('\n').length
    out.push({ name: m[1], line })
  }
  return out
}

// ---------------------------------------------------------------------------
// Member-access warning counts per route (optional, for prioritisation)
// ---------------------------------------------------------------------------

async function memberCounts() {
  const { ESLint } = await import(
    pathToFileURL(path.resolve(process.cwd(), 'node_modules/eslint/lib/api.js')).href
  )
  const eslint = new ESLint({ cwd: process.cwd(), resolvePluginsRelativeTo: process.cwd(), useEslintrc: true })
  const results = await eslint.lintFiles(['src/**/route.ts'])
  const map = new Map()
  for (const r of results) {
    const rel = r.filePath.split(/[\\/]/).join('/').replace(process.cwd().split(/[\\/]/).join('/') + '/', '')
    const n = r.messages.filter((mm) => mm.ruleId === '@typescript-eslint/no-unsafe-member-access').length
    if (n > 0) map.set(rel, n)
  }
  return map
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function main() {
  const routes = findRoutes()
  const counts = skipMember ? new Map() : await memberCounts()
  const files = routes.map((rel) => {
    const source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    return {
      file: rel,
      queries: extractQueries(source),
      interfaces: extractInterfaces(source),
      memberWarnings: counts.get(rel) || 0,
    }
  })

  // Sort by member-access warnings desc, then query count desc
  files.sort((a, b) => (b.memberWarnings - a.memberWarnings) || (b.queries.length - a.queries.length))

  if (asJson) {
    console.log(JSON.stringify({ files }, null, 2))
    return
  }

  const shown = files.slice(0, TOP)
  const totalQueries = files.reduce((a, f) => a + f.queries.length, 0)
  const typedQueries = files.reduce((a, f) => a + f.queries.filter((q) => q.typed).length, 0)
  const untyped = totalQueries - typedQueries

  console.log(`\n=== API ROW SWEEP — ${files.length} route files, ${totalQueries} queries (${typedQueries} typed, ${untyped} untyped) ===`)
  if (!skipMember) console.log(`(member-access warnings from eslint; use --no-member-scan to skip)\n`)

  for (const f of shown) {
    console.log(`\n${'─'.repeat(78)}`)
    console.log(`${f.file}  — ${f.queries.length} queries (${f.queries.filter((q) => q.typed).length} typed) · ${f.memberWarnings} member-access warnings`)
    console.log('  declared row interfaces:', f.interfaces.length ? f.interfaces.map((i) => `${i.name}@${i.line}`).join(', ') : '(none)')

    for (const q of f.queries) {
      if (untypedOnly && q.typed) continue
      const status = q.typed ? `typed<${q.typeArg}>` : 'UN-TYPED'
      const sug = q.suggested ? ` → suggest ${q.suggested}` : ''
      console.log(`  L${String(q.line).padStart(4)} [${status.padEnd(14)}] ${q.table || '??'} ${sug}`)
      console.log(`         ${q.sql}`)
    }
  }

  console.log(`\n${'═'.repeat(78)}`)
  console.log('SUMMARY')
  console.log(`  routes: ${files.length}   queries: ${totalQueries}   typed: ${typedQueries}   untyped: ${untyped}`)
  const untypedFiles = files.filter((f) => f.queries.some((q) => !q.typed))
  console.log(`  files with ≥1 untyped query: ${untypedFiles.length}`)
  for (const f of untypedFiles.slice(0, TOP)) {
    const u = f.queries.filter((q) => !q.typed).length
    console.log(`  ${String(u).padStart(3)} untyped  ${String(f.memberWarnings).padStart(4)} warn  ${f.file}`)
  }
}

main().catch((err) => {
  console.error('[api-row-sweep] failed:', err)
  process.exit(1)
})
