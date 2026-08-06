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
 * --verify (with --apply): after the mechanical edit, typechecks the edited
 * file with the real TypeScript compiler (project tsconfig options, `@/*`
 * paths aliases) and attributes each diagnostic to a generated interface
 * column (wrong declared type / missing column) so the review loop is
 * mechanical: run --apply --verify, fix what it flags, re-run until "OK —
 * 0 diagnostics". Exits 1 when the file still has diagnostics. NOTE: this
 * is a per-file approximation of the full project check — ambient
 * declarations in tsconfig include (next-env.d.ts, .next/types/**) and
 * errors inside imported modules are not surfaced; run `npx tsc --noEmit`
 * once after a batch to catch project-wide issues.
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
 *   node scripts/api-row-sweep.mjs --batch N [--batch-size S]  # per-line worklist for batch N
 *   node scripts/api-row-sweep.mjs --check [base-ref]   # CI regression gate (see below)
 *   node scripts/api-row-sweep.mjs --apply <route-file>             # auto-type one route (see below)
 *   node scripts/api-row-sweep.mjs --apply <file> --verify           # …then typecheck it & attribute failures
 *
 * --batch N: prints a precise per-line worklist for batch N (files chunked
 * by cumulative untyped-query count, default 30 per batch — --batch-size
 * overrides). Mirrors member-scan.mjs --batch so a grind session starts from
 * an exact list of files + query lines instead of scanning the JSON report.
 * Chunking by untyped-query count keeps batches identical under
 * --no-member-scan (untyped counts don't depend on eslint), so the fast path
 * prints the same worklist as a full scan. Cannot be combined with --json.
 *
 * --check: the row-typing regression gate. Computes the changed route files
 * via `git diff --name-only --diff-filter=ACMR <base>...HEAD` filtered to
 * route.ts paths under src/ (same base-ref resolution as lint-gate.mjs: pull_request -> origin/<base>,
 * push -> github.event.before, anything else -> HEAD~1; an explicit base-ref
 * positional always wins), then fails (exit 1) if ANY changed route file
 * contains an untyped `db.query` / `client.query` call. This stops PRs from
 * re-adding the `any`-rows pattern the grind has been removing — every route
 * file a PR touches must keep all its queries typed. Exit 0 = pass, 1 = fail,
 * 2 = usage/git error.
 *
 * --apply <route-file>: mechanical one-file typing. For each untyped
 * db.query/client.query with resolvable output columns (a SELECT column list,
 * or INSERT/UPDATE/DELETE ... RETURNING), it wraps the call as
 * db.query<Row>(...), synthesises a suggested row interface (column names
 * parsed from the SQL, best-effort types — REVIEW them: pg returns
 * bigint/numeric as string and timestamptz as Date, nullable columns need
 * `| null`), and reuses an already-declared interface when one exists.
 * Queries whose columns can't be resolved (SELECT *, dynamic SQL, INSERT
 * without RETURNING) are left untyped and listed as manual. After applying,
 * the review step is: verify/adjust column types (esp. `| null`, pg string
 * bigint/numeric), complete missing columns for `RETURNING *` (only the
 * INSERT column list is synthesised — id/created_at etc. need adding), and
 * remove now-redundant `rows[0] as Record<string, unknown>` casts (they
 * conflict with a concrete row interface). Edits in place (CRLF preserved);
 * exactly one route file per invocation. Pass --verify to typecheck the
 * edited file and get the wrong guesses attributed automatically.
 *
 * Output: per-file sections sorted by query count (desc), each listing the
 * queries, then the interfaces already declared.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
const batchIdx = args.indexOf('--batch')
const BATCH = batchIdx >= 0 ? Number(args[batchIdx + 1]) : null
const sizeIdx = args.indexOf('--batch-size')
const BATCH_SIZE = sizeIdx >= 0 ? Number(args[sizeIdx + 1]) : 30
if (BATCH !== null && (args[batchIdx + 1] === undefined || args[batchIdx + 1].startsWith('--') || !Number.isInteger(BATCH) || BATCH < 1)) {
  console.error(`[api-row-sweep] --batch requires a positive integer (got "${args[batchIdx + 1]}").`)
  process.exit(2)
}
if (sizeIdx >= 0 && (args[sizeIdx + 1] === undefined || args[sizeIdx + 1].startsWith('--') || !Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1)) {
  console.error(`[api-row-sweep] --batch-size requires a positive integer (got "${args[sizeIdx + 1]}").`)
  process.exit(2)
}
if (BATCH !== null && asJson) {
  console.error('[api-row-sweep] cannot combine --batch with --json (batch prints the human worklist; use --json alone for machine output).')
  process.exit(2)
}
const routesIdx = args.indexOf('--routes')
const ROUTES_RE = routesIdx >= 0 ? new RegExp(args[routesIdx + 1]) : null
const checkMode = args.includes('--check')

// In --check mode the token immediately after --check (if not a flag) is the
// base ref; otherwise it is resolved from the CI event env, mirroring
// lint-gate.mjs. Lookup is gated to that slot so value-taking flags like
// `--top 40` can't be misread as a base ref.
const checkIdx = args.indexOf('--check')
const CHECK_BASE = checkMode && args[checkIdx + 1] && !args[checkIdx + 1].startsWith('--')
  ? args[checkIdx + 1]
  : null
const applyIdx = args.indexOf('--apply')
const APPLY_FILE = applyIdx >= 0 ? args[applyIdx + 1] : null
if (applyIdx >= 0 && (!APPLY_FILE || APPLY_FILE.startsWith('--'))) {
  console.error('[api-row-sweep] --apply requires a route file argument (e.g. --apply src/app/api/x/route.ts).')
  process.exit(2)
}
const verifyApply = args.includes('--verify')
if (verifyApply && !APPLY_FILE) {
  console.error('[api-row-sweep] --verify requires --apply <route-file> (it typechecks the file after applying).')
  process.exit(2)
}

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
        // const sql = '...' / "..." / `...` — char-class quote avoids backticks in the literal
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
      raw: sql, // full (normalised) SQL — used by --apply for column extraction
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
// --apply: column extraction + interface synthesis for a single route file
// ---------------------------------------------------------------------------

/** Split a SQL list on top-level commas (ignores parens and quoted strings). */
function splitTopLevel(list) {
  const out = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\') i++
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
    } else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i))
      start = i + 1
    }
  }
  out.push(list.slice(start))
  return out
}

/** Column name from one select-list item (`p.id` -> id, `x AS y` -> y, else null). */
function columnNameFromItem(item) {
  const t = item.trim()
  if (!t) return null
  const as = /\s+AS\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*$/i.exec(t)
  if (as) return as[1]
  let last = t.split('.').pop().trim()
  // Strip a `::type` cast suffix so `p.area_ha::float8` -> `area_ha`.
  last = last.split('::')[0].trim()
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(last)) return last
  return null
}

/**
 * Output column names for a query's SQL, or null when they can't be resolved
 * (SELECT * / t.*, dynamic SQL, INSERT without RETURNING). Also returns
 * `complete: false` when some items couldn't be named (e.g. `p.*`).
 */
function columnsFromSql(sql) {
  if (!sql) return null
  const s = sql.replace(/\s+/g, ' ').trim()
  let list = null
  const sel = /^SELECT\s+(.+)$/i.exec(s)
  if (sel) {
    const head = sel[1]
    list = selectListUntilClause(head)
    if (/^\s*(?:\*|[A-Za-z_][A-Za-z0-9_]*\.\*)\s*$/.test(list)) return null // SELECT * / t.*
  } else {
    const ret = /\bRETURNING\s+(.+)$/i.exec(s)
    if (!ret) return null
    list = ret[1]
    // `RETURNING *` on an INSERT: the output columns are exactly the INSERT
    // column list (`INSERT INTO t (c1, c2, ...) VALUES ...`), so we can
    // synthesise the row from those instead of giving up.
    if (/^\*\s*$/.test(list.trim())) {
      const ins = /\bINSERT\s+INTO\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)/i.exec(s)
      if (ins) {
        const cols = ins[1].split(',').map((c) => c.trim()).filter(Boolean)
        if (cols.length) return { names: cols, complete: true }
      }
      return null
    }
  }
  const names = []
  let complete = true
  for (const item of splitTopLevel(list)) {
    const name = columnNameFromItem(item)
    if (name) names.push(name)
    else complete = false
  }
  if (!names.length) return null
  return { names, complete }
}

/**
 * The SELECT column list, cut at the first top-level clause keyword
 * (FROM/JOIN/WHERE/...), ignoring keywords nested inside subquery parens so
 * `(SELECT count(*) FROM pg_index i) AS index_count, name` keeps the whole
 * list. Returns the list slice; trailing columns after a parenthesised
 * subquery are preserved.
 */
function selectListUntilClause(head) {
  const re = /\s+(?:FROM|INTO|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|FOR\s+UPDATE|UNION(?:\s+ALL)?|RETURNING)\b/i
  let depth = 0
  let quote = null
  for (let i = 0; i < head.length; i++) {
    const c = head[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\') i++
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
    } else if (depth === 0) {
      re.lastIndex = i
      const mm = re.exec(head.slice(i))
      if (mm && mm.index === 0) return head.slice(0, i)
    }
  }
  return head
}

/** Best-effort column type by name — REVIEW these after --apply. */
function guessColumnType(name) {
  const n = name.toLowerCase()
  if (n === 'id' || n.endsWith('_id')) return 'string'
  if (n.endsWith('_at') || n.endsWith('_on') || n.endsWith('_date') || n === 'date') return 'Date'
  if (n === 'count' || n.endsWith('_count') || n.endsWith('_num') || n.endsWith('_no') || n.endsWith('_qty')) return 'number'
  if (/easting|northing|latitude|longitude|elevation|altitude|bearing|angle|distance|perimeter|area|_deg|_min|_sec|_ms|ratio|percent|_ha|_m2|\brl\b/.test(n)) return 'number'
  if (/price|amount|cost|fee|total|size|bytes|weight|priority|retry|limit|offset/.test(n)) return 'number'
  if (n.startsWith('is_') || n.startsWith('has_') || n.endsWith('_flag') || n === 'active' || n === 'enabled') return 'boolean'
  if (['details', 'payload', 'result', 'snapshot', 'metadata', 'documents', 'template', 'data', 'config', 'settings', 'permissions', 'json'].includes(n) || n.endsWith('_json') || n.endsWith('_jsonb')) return 'unknown'
  return 'string'
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
// --check: base-ref resolution + changed route files (CI regression gate)
// ---------------------------------------------------------------------------

// Mirrors lint-gate.mjs resolveBaseRefFromEnv(): pull_request -> origin/<base>,
// push -> github.event.before (all-zero "first push" -> HEAD~1), else HEAD~1.
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

/** Changed route files vs base (ACMR filter — added/copied/modified/renamed). */
function changedRouteFiles(baseRef) {
  const diffRef = baseRef === 'HEAD' ? 'HEAD' : `${baseRef}...HEAD`
  const raw = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', diffRef, '--', 'src/**/route.ts'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && s.endsWith('/route.ts') && !s.includes('/__tests__/'))
    .sort()
}

/** The gate: any changed route file with an untyped db.query/client.query fails. */
function runCheck() {
  const baseRef = CHECK_BASE || resolveBaseRefFromEnv()
  if (!CHECK_BASE) console.log(`[api-row-sweep] no base ref given — resolved: ${baseRef}`)

  let changed
  try {
    changed = changedRouteFiles(baseRef)
  } catch (e) {
    console.error(`[api-row-sweep] git diff failed (${e.message.split('\n')[0]}) — cannot compute changed files.`)
    process.exitCode = 2
    return
  }

  if (!changed.length) {
    console.log(`[api-row-sweep] OK: no changed route files vs ${baseRef}...HEAD.`)
    process.exitCode = 0
    return
  }

  const offenders = []
  for (const rel of changed) {
    let source
    try {
      source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    } catch {
      // Deleted between diff and read (race) — nothing to scan.
      continue
    }
    const untyped = extractQueries(source).filter((q) => !q.typed)
    if (untyped.length) offenders.push({ rel, untyped })
  }

  if (offenders.length) {
    console.error(`[api-row-sweep] FAIL: ${offenders.length} changed route file(s) contain untyped db.query/client.query call(s):`)
    for (const { rel, untyped } of offenders) {
      console.error(`  ${rel}`)
      for (const q of untyped) {
        const sug = q.suggested ? ` → suggest ${q.suggested}` : ''
        console.error(`    L${q.line}  ${q.sql}${sug}`)
      }
    }
    console.error('[api-row-sweep] FAIL: every route file a PR touches must keep all its db.query calls typed (<RowType> generic).')
    process.exitCode = 1
    return
  }

  const typed = changed.map((rel) => {
    const source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    const qs = extractQueries(source)
    return `${rel} (${qs.filter((q) => q.typed).length}/${qs.length} queries typed)`
  })
  console.log(`[api-row-sweep] OK: ${changed.length} changed route file(s), all db.query/client.query calls typed:`)
  for (const t of typed) console.log(`  ${t}`)
  process.exitCode = 0
}

/**
 * --apply <route-file>: mechanically type one route file. For every untyped
 * db.query/client.query call whose output columns are resolvable from SQL:
 *   - wrap the call as db.query<SuggestedRow>(...),
 *   - insert a suggested interface (columns parsed from the SQL, best-effort
 *     types — the caller reviews them) once per row name, unless the file
 *     already declares it,
 * and print a review checklist of what was wrapped / added / reused / skipped.
 * Queries with unresolvable columns (SELECT *, dynamic SQL, INSERT without
 * RETURNING) stay untyped and are listed as manual. Edits in place, CRLF
 * preserved.
 */
function runApply(fileArg) {
  const rel = fileArg.split(/[\\/]/).join('/')
  if (!rel.startsWith('src/') || !rel.endsWith('/route.ts')) {
    console.error(`[api-row-sweep] --apply requires one route file under src/ ending in /route.ts (got "${fileArg}").`)
    process.exitCode = 2
    return false
  }
  const full = path.join(process.cwd(), rel)
  let source
  try {
    source = readFileSync(full, 'utf8')
  } catch (e) {
    console.error(`[api-row-sweep] cannot read ${rel}: ${e.message}`)
    process.exitCode = 2
    return false
  }
  const crlf = source.includes('\r\n')
  let text = source.replace(/\r\n/g, '\n')

  const queries = extractQueries(text)
  const declared = new Set(extractInterfaces(text).map((i) => i.name))
  const interfaces = new Map() // row name -> ordered column names
  const incomplete = new Set() // row names with unresolvable columns
  const edits = [] // { pos, text } — insert `<Name>` right before the `(`
  const wrapped = []
  const reused = []
  const skipped = []

  QUERY_RE.lastIndex = 0
  let qidx = 0
  let m
  while ((m = QUERY_RE.exec(text))) {
    const q = queries[qidx++]
    if (!q || q.typed) continue
    const name = q.suggested
    if (!name) {
      skipped.push(`L${q.line}: ${q.sql}`)
      continue
    }
    const cols = columnsFromSql(q.raw || q.sql)
    if (!cols) {
      skipped.push(`L${q.line}: ${q.sql} — no resolvable output columns (manual)`)
      continue
    }
    if (!interfaces.has(name)) {
      interfaces.set(name, [...cols.names])
    } else {
      for (const c of cols.names) {
        if (!interfaces.get(name).includes(c)) interfaces.get(name).push(c)
      }
    }
    if (!cols.complete) incomplete.add(name)
    if (declared.has(name)) reused.push(`L${q.line} <${name}> (reuses existing interface)`)
    else wrapped.push(`L${q.line} <${name}>`)
    edits.push({ pos: m.index + m[0].length - 1, text: `<${name}>` })
  }

  // Apply wraps (positions refer to the original text; descending keeps them valid).
  edits.sort((a, b) => b.pos - a.pos)
  for (const e of edits) text = text.slice(0, e.pos) + e.text + text.slice(e.pos)

  // Insert new interface blocks after the last import line.
  const newNames = [...interfaces.keys()].filter((n) => !declared.has(n))
  if (newNames.length) {
    const blocks = newNames.map((name) => {
      const lines = [
        '// AUTO-GENERATED by api-row-sweep --apply — REVIEW these column types.',
        '// pg returns bigint/numeric as string, timestamptz as Date; add `| null` where nullable.',
        `interface ${name} {`,
        ...interfaces.get(name).map((c) => `  ${c}: ${guessColumnType(c)}`),
        '}',
      ]
      return lines.join('\n')
    })
    const importRe = /^import\s[^\n]*\n/gm
    let lastImportEnd = 0
    let im
    while ((im = importRe.exec(text))) lastImportEnd = im.index + im[0].length
    const insertAt = lastImportEnd || (text.startsWith('\uFEFF') ? 1 : 0)
    text = text.slice(0, insertAt) + '\n' + blocks.join('\n\n') + '\n' + text.slice(insertAt)
  }

  const out = crlf ? text.replace(/\n/g, '\r\n') : text
  writeFileSync(full, out, 'utf8')

  // Report.
  console.log(`[api-row-sweep] --apply ${rel}`)
  if (wrapped.length) {
    console.log(`  wrapped ${wrapped.length} untyped call(s):`)
    for (const w of wrapped) console.log(`    ${w}`)
  }
  if (reused.length) {
    console.log(`  reused ${reused.length} existing interface(s):`)
    for (const r of reused) console.log(`    ${r}`)
  }
  if (newNames.length) {
    console.log(`  added ${newNames.length} interface(s) — REVIEW the column types:`)
    for (const n of newNames) {
      const cols = interfaces.get(n)
      console.log(`    ${n} { ${cols.join(', ')} }${incomplete.has(n) ? '  (some columns unresolvable — fill by hand)' : ''}`)
    }
  }
  if (skipped.length) {
    console.log(`  left ${skipped.length} untyped (manual):`)
    for (const s of skipped) console.log(`    ${s}`)
  }
  if (!wrapped.length && !newNames.length && !reused.length) {
    console.log('  nothing to apply — no untyped queries with resolvable columns.')
  }
  return true
}

// ---------------------------------------------------------------------------
// --verify: typecheck the applied file and attribute failures to the
// generated interfaces (closes the --apply review loop)
// ---------------------------------------------------------------------------

/**
 * Parse the generated `interface XxxRow { ... }` blocks that --apply inserted
 * (marked by the AUTO-GENERATED banner) into { name, line, columns } entries
 * so a tsc diagnostic can be attributed to a specific generated column.
 */
function generatedInterfaceSpans(source) {
  const spans = []
  // Banner is followed by the pg-types note line (and possibly more comment
  // lines), then the interface — skip any run of `//` comment lines.
  const bannerRe = /\/\/ AUTO-GENERATED by api-row-sweep --apply[^\n]*\n(?:\/\/[^\n]*\n)*interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{/g
  let m
  while ((m = bannerRe.exec(source))) {
    const name = m[1]
    const startLine = source.slice(0, m.index).split('\n').length
    // Consume the block body to its closing brace (top-level `}`).
    let depth = 0
    let i = m.index + m[0].length
    let close = -1
    for (; i < source.length; i++) {
      const c = source[i]
      if (c === '{') depth++
      else if (c === '}') {
        if (depth === 0) { close = i; break }
        depth--
      }
    }
    const body = source.slice(m.index + m[0].length, close)
    const columns = []
    let ci = 0
    for (const line of body.split('\n')) {
      ci++
      const cm = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([^\s]+)/.exec(line)
      if (cm) columns.push({ name: cm[1], type: cm[2], line: startLine + ci })
    }
    spans.push({ name, line: startLine, endLine: close >= 0 ? source.slice(0, close).split('\n').length : startLine, columns })
  }
  return spans
}

/**
 * Verify the applied file with the real TypeScript compiler (project tsconfig
 * options, `paths` aliases included) and attribute every diagnostic to a
 * generated interface column when possible. Exits 1 when the file has errors.
 */
async function verifyFile(rel) {
  const full = path.join(process.cwd(), rel)
  const cwd = process.cwd()
  console.log(`[api-row-sweep] --verify ${rel} …`)

  // Load project tsconfig options (honours `extends`, `paths`, `strict`, …).
  let ts
  try {
    ts = await import(pathToFileURL(path.resolve(cwd, 'node_modules/typescript/lib/typescript.js')).href)
  } catch (e) {
    console.error(`[api-row-sweep] --verify needs typescript in node_modules (${e.message.split('\n')[0]})`)
    process.exitCode = 2
    return
  }
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) {
    console.error('[api-row-sweep] --verify: tsconfig.json not found from ' + cwd)
    process.exitCode = 2
    return
  }
  const read = ts.readConfigFile(configPath, ts.sys.readFile)
  if (read.error) {
    console.error('[api-row-sweep] --verify: cannot read tsconfig:', ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
    process.exitCode = 2
    return
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath))
  // Single-file check: strip build-management options that are unused here
  // (incremental/composite would engage tsbuildinfo machinery; no emit
  // happens, but keeping the program construction plain avoids surprises).
  const opts = { ...parsed.options }
  delete opts.incremental
  delete opts.composite
  delete opts.tsBuildInfoFile

  // Program over the single file (its imports are pulled in automatically).
  const program = ts.createProgram([full], opts)
  const sourceFile = program.getSourceFile(full)
  if (!sourceFile) {
    console.error(`[api-row-sweep] --verify: cannot parse ${rel}`)
    process.exitCode = 2
    return
  }
  const all = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ]

  const source = readFileSync(full, 'utf8')
  const spans = generatedInterfaceSpans(source)
  const colByLine = new Map()
  for (const s of spans) for (const c of s.columns) colByLine.set(c.line, `${s.name}.${c.name}`)

  if (!all.length) {
    console.log('  OK — 0 diagnostics; generated interfaces typecheck.')
    process.exitCode = 0
    return
  }

  console.log(`  ${all.length} diagnostic(s) — check the review notes below:`)
  let fixable = 0
  for (const d of all) {
    const pos = d.start != null ? sourceFile.getLineAndCharacterOfPosition(d.start) : null
    const line = pos ? pos.line + 1 : null
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ')
    const code = d.code ? `TS${d.code}` : ''
    // Attribute: is the diagnostic ON a generated column line, or does the
    // message / the offending source line reference a generated column name?
    let attr = null
    if (line != null && colByLine.has(line)) {
      attr = `generated ${colByLine.get(line)} (declared type is wrong)`
      fixable++
    } else if (spans.length) {
      const lineText = line != null ? (source.split('\n')[line - 1] || '') : ''
      const mentioned = spans.find((s) =>
        msg.includes(s.name) ||
        s.columns.some(
          (c) => msg.includes(`${c.name}'`) || msg.includes(` '${c.name}`) || new RegExp(`\\b${c.name}\\b`).test(lineText)
        )
      )
      if (mentioned) {
        const col = mentioned.columns.find(
          (c) => msg.includes(c.name) || new RegExp(`\\b${c.name}\\b`).test(lineText)
        )
        attr = `likely wrong type on generated ${mentioned.name}${col ? '.' + col.name : ''} (or missing column) — see message`
        fixable++
      }
    }
    console.log(`    ${rel}:${line ?? '?'}  ${code}  ${msg}`)
    if (attr) console.log(`      → ${attr}`)
  }
  console.log(`  review: ${fixable}/${all.length} diagnostic(s) trace to generated interface columns.`)
  console.log('  Fix the column types above (pg: DOUBLE PRECISION/INTEGER → number, NUMERIC/BIGINT → string,')
  console.log('  TIMESTAMPTZ → Date; add `| null` for nullable; add missing RETURNING * columns), then re-run.')
  process.exitCode = 1
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function main() {
  // --check is a pure gate: no report, no member scan — fail fast and cheap.
  if (checkMode) {
    runCheck()
    return
  }

  // --apply is a single-file mechanical edit; report mode handles the rest.
  // --verify (with --apply) typechecks the edited file via the TS compiler
  // API and attributes failures to generated columns — closing the loop.
  // Verify only when apply actually succeeded (a failed apply must not be
  // masked by a clean verify that overwrites the exit code).
  if (APPLY_FILE) {
    const applied = runApply(APPLY_FILE)
    if (verifyApply && applied) await verifyFile(APPLY_FILE)
    return
  }

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

  // --batch N prints a precise per-line worklist for batch N, mirroring
  // member-scan.mjs: files are chunked into batches by cumulative untyped
  // query count (--batch-size, default 30) in the same order the ranking
  // below produces (files with untyped queries first, highest count first); a
  // file is never split. Chunking by untyped queries (not member-access
  // warnings) keeps the batches identical under --no-member-scan, so the fast
  // path prints the same deterministic worklist as a full scan. Each entry
  // lists the file's declared interfaces plus its query lines (line number,
  // typed/untyped, table, suggested interface) so a grind session starts from
  // an exact per-line list without a JSON scratch step.
  const batchFiles = files.filter((f) => f.queries.some((q) => !q.typed))
  const batches = []
  let curBatch = []
  let curUntyped = 0
  for (const f of batchFiles) {
    const unt = f.queries.filter((q) => !q.typed).length
    if (curUntyped > 0 && curUntyped + unt > BATCH_SIZE) {
      batches.push(curBatch)
      curBatch = []
      curUntyped = 0
    }
    curBatch.push(f)
    curUntyped += unt
  }
  if (curBatch.length) batches.push(curBatch)

  if (BATCH !== null) {
    if (!files.length) {
      console.error('[api-row-sweep] no route files found — route discovery failed (check src/ tree).')
      process.exit(2)
    }
    if (!batchFiles.length) {
      console.log('[api-row-sweep] every route file is fully typed — the row-typing grind is complete! 🎉')
      process.exit(0)
    }
    if (BATCH > batches.length) {
      console.error(`[api-row-sweep] batch ${BATCH} out of range — found ${batches.length} batch(es) of ~${BATCH_SIZE} untyped queries.`)
      process.exit(2)
    }
    const b = batches[BATCH - 1]
    const bUntyped = b.reduce((a, f) => a + f.queries.filter((q) => !q.typed).length, 0)
    const bWarn = b.reduce((a, f) => a + f.memberWarnings, 0)
    console.log(`\n=== API ROW-TYPING BATCH ${BATCH} WORKLIST (${bUntyped} untyped queries · ${b.length} files · ${bWarn} member-access warnings) ===`)
    console.log(`chunked by cumulative untyped-query count (--batch-size ${BATCH_SIZE}); order = most untyped queries first`)
    console.log(`batches are computed live from this scan — batch numbers may differ from the doc's historical numbers\n`)
    for (const f of b) {
      const unt = f.queries.filter((q) => !q.typed).length
      console.log(`${f.file}  (${f.memberWarnings} member-access · ${f.queries.length} queries, ${unt} untyped)`)
      console.log(`  declared row interfaces: ${f.interfaces.length ? f.interfaces.map((i) => `${i.name}@${i.line}`).join(', ') : '(none)'}`)
      for (const q of f.queries) {
        if (untypedOnly && q.typed) continue
        const status = q.typed ? `typed<${q.typeArg}>` : 'UN-TYPED'
        const sug = q.suggested ? ` → suggest ${q.suggested}` : ''
        console.log(`  L${String(q.line).padStart(4)} [${status.padEnd(16)}] ${q.table || '??'} ${sug}`)
        console.log(`         ${q.sql}`)
      }
    }
    process.exit(0)
  }

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
