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
 *   node scripts/api-row-sweep.mjs --batch-plan [file]  # write stable batch→file mapping JSON (see below)
 *   node scripts/api-row-sweep.mjs --traffic [file]     # weight batch order by route hits (see below)
 *   node scripts/api-row-sweep.mjs --capture-traffic <metrics-url>  # scrape route hits → traffic JSON, then weight with it
 *   node scripts/api-row-sweep.mjs --check [base-ref]   # CI regression gate (see below)
 *   node scripts/api-row-sweep.mjs --apply <route-file>             # auto-type one route (see below)
 *   node scripts/api-row-sweep.mjs --apply <file> --verify           # …then typecheck it & attribute failures
 *   node scripts/api-row-sweep.mjs --apply-all                       # sweep: --apply --verify every untyped route file
 *
 * --traffic [file]: overlays the batch worklists with real route-traffic
 * data — the batch chunking is re-ordered so HIGH-TRAFFIC routes are typed
 * first (hits desc, then untyped-query count desc as tiebreak). The file
 * maps an API path or route file to a hit count (default docs/route-traffic.json,
 * committed alongside the plan). NOTE: audit_logs only records row-level data
 * mutations — the hit counts come from metardu_route_hits_total, the
 * Prometheus counter wired into apiHandler, scraped via --capture-traffic
 * from /api/public/metrics (or exported/committed by hand).
 *
 * --batch N: prints a precise per-line worklist for batch N (files chunked
 * by cumulative untyped-query count, default 30 per batch — --batch-size
 * overrides). Mirrors member-scan.mjs --batch so a grind session starts from
 * an exact list of files + query lines instead of scanning the JSON report.
 * Chunking by untyped-query count keeps batches identical under
 * --no-member-scan (untyped counts don't depend on eslint), so the fast path
 * prints the same worklist as a full scan. Cannot be combined with --json.
 *
 * --batch-plan [file]: writes the batch → file mapping (every batch, its
 * untyped-query total, and the exact file list per batch) to a JSON file so
 * the doc's batch numbers stay STABLE instead of shifting every scan. The
 * default path is docs/route-row-typing-plan.json (committed with
 * docs/ROUTE_ROW_TYPING_PLAN.md); a positional path overrides it. When a
 * committed plan exists, `--batch N` uses the plan's FILE MEMBERSHIP for
 * batch N (numbers never shift as files get typed) while still reading each
 * file's query lines live — re-run `--batch-plan` after adding new routes to
 * re-chunk. Without a plan file, `--batch N` falls back to live chunking.
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
 * --check also runs the shared-schema drift gate (whole repo, cheap static
 * scan): for every module under src/lib/validation that exports a zod schema
 * (e.g. mapExtent.ts, viewportQuery.ts), any route importing a client shape
 * type from that module (MapExtent, ViewportFeature, …) must ALSO import at
 * least one schema value from the same module and validate through it. A
 * route that imports the type but no schema lets the client shape and the
 * server response drift — the gate fails (exit 1) naming the route + type.
 * Scope: only DIRECT imports from @/lib/validation/* are tracked — a type
 * re-exported through a shim module (e.g. MapExtent via @/app/map/MapReact
 * Context) is not traced; import types from the schema module directly.
 *
 * --apply <route-file>: mechanical one-file typing. For each untyped
 * db.query/client.query with resolvable output columns (a SELECT column list,
 * or INSERT/UPDATE/DELETE ... RETURNING), it wraps the call as
 * db.query<Row>(...), synthesises a suggested row interface (column names
 * parsed from the SQL; types now come from the real column definitions in
 * src/lib/db/migrations/*.sql when the table is known — DOUBLE
 * PRECISION/INTEGER → number, NUMERIC/BIGINT → string (pg returns numeric
 * as string), TIMESTAMPTZ → Date, nullable → `| null` — falling back to
 * name heuristics otherwise), and reuses an already-declared interface when
 * one exists. SELECT * / t.* and RETURNING * against a schema-known table
 * resolve to the table's full column list, so those queries get typed too.
 * Queries whose columns can't be resolved (SELECT * against a table missing
 * from the migrations, dynamic SQL, INSERT without RETURNING) are left
 * untyped and listed as manual. After applying,
 * the review step is: verify/adjust column types (esp. `| null`, pg string
 * bigint/numeric), complete missing columns for `RETURNING *` (only the
 * INSERT column list is synthesised — id/created_at etc. need adding), and
 * remove now-redundant `rows[0] as Record<string, unknown>` casts (they
 * conflict with a concrete row interface). Edits in place (CRLF preserved);
 * exactly one route file per invocation. Pass --verify to typecheck the
 * edited file and get the wrong guesses attributed automatically.
 *
 * --apply-all: loops --apply --verify over EVERY route file with ≥1 untyped
 * query (findRoutes order, same schema-aware typing as single-file --apply).
 * All flagged columns — the verify diagnostics attributed to generated
 * interface columns — are collected into one review report printed at the
 * end, and the sweep STOPS the first time a file's verify fails (exit 1),
 * so a whole pass is one command: run it, fix what the report lists, re-run
 * until it prints the 🎉 all-clean line. Files applied before the stop keep
 * their edits (the report tells you exactly what to fix). Combine with
 * --routes 're' to sweep only matching paths. Exits 1 if stopped, 2 on
 * usage error.
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
const PFC = args.includes('--paths-from-changed')
const effectiveCheckMode = checkMode || PFC

const DEFAULT_BATCH_PLAN = 'docs/route-row-typing-plan.json'
const planIdx = args.indexOf('--batch-plan')
const BATCH_PLAN_FILE = planIdx >= 0 && args[planIdx + 1] && !args[planIdx + 1].startsWith('--')
  ? args[planIdx + 1]
  : (planIdx >= 0 ? DEFAULT_BATCH_PLAN : null)

// Traffic overlay (2026-08-08): --traffic [file] weights the batch chunking
// by how often each route is hit (high-traffic routes typed first). The file
// maps a route path (or route file) to a hit count:
//   { "/api/projects": 420, "src/app/api/rim/route.ts": 137, ... }
// Default docs/route-traffic.json (committed with the batch plan); a
// positional path overrides it. --capture-traffic <metrics-url> scrapes the
// Prometheus route-hits counter from /api/public/metrics and writes the file
// (metardu_route_hits_total, wired into apiHandler), then the same run is
// weighted with it. Hit counts come from the real traffic source — the
// audit_logs table only records row-level data mutations, not HTTP hits.
const DEFAULT_TRAFFIC = 'docs/route-traffic.json'
const captureIdx = args.indexOf('--capture-traffic')
const CAPTURE_TRAFFIC_URL = captureIdx >= 0 && args[captureIdx + 1] && !args[captureIdx + 1].startsWith('--')
  ? args[captureIdx + 1]
  : null
if (captureIdx >= 0 && !CAPTURE_TRAFFIC_URL) {
  console.error('[api-row-sweep] --capture-traffic requires a metrics endpoint URL (e.g. https://app.example.com/api/public/metrics).')
  process.exit(2)
}
const trafficIdx = args.indexOf('--traffic')
const TRAFFIC_FILE = trafficIdx >= 0 && args[trafficIdx + 1] && !args[trafficIdx + 1].startsWith('--')
  ? args[trafficIdx + 1]
  : (trafficIdx >= 0 || captureIdx >= 0 ? DEFAULT_TRAFFIC : null)
const TRAFFIC_USED = !!(TRAFFIC_FILE || CAPTURE_TRAFFIC_URL)

// In --check / --paths-from-changed mode, the token immediately after --check / --paths-from-changed (if not a flag) is the
// base ref; otherwise it is resolved from the CI event env, mirroring
// lint-gate.mjs. Lookup is gated to that slot so value-taking flags like
// `--top 40` can't be misread as a base ref.
const checkIdx = args.indexOf('--check')
const pfcIdx = args.indexOf('--paths-from-changed')
const flagIdx = checkIdx >= 0 ? checkIdx : pfcIdx
const CHECK_BASE = flagIdx >= 0 && args[flagIdx + 1] && !args[flagIdx + 1].startsWith('--')
  ? args[flagIdx + 1]
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
const applyAllMode = args.includes('--apply-all')
if (applyAllMode && (APPLY_FILE || effectiveCheckMode || asJson || BATCH !== null)) {
  console.error('[api-row-sweep] cannot combine --apply-all with --apply/--check/--paths-from-changed/--json/--batch (it sweeps every untyped route file).')
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

/**
 * Best-guess table name from SQL (FROM/JOIN/UPDATE/INSERT ... RETURNING).
 * Scans with paren-depth tracking so a FROM inside a subquery is never
 * mistaken for the statement's real table (`SELECT .. (SELECT COUNT(*)
 * FROM survey_points ..) FROM projects` → projects, not survey_points).
 */
function tableFromSql(sql) {
  const s = sql.replace(/\s+/g, ' ').trim()
  // INSERT ... ON CONFLICT DO UPDATE SET ... — the INTO table is the real one.
  const insert = /\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)/i.exec(s)
  if (insert) return insert[1]
  let depth = 0
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '(') { depth++; continue }
    if (c === ')') { depth--; continue }
    if (depth !== 0) continue
    // Top-level FROM/JOIN/UPDATE — but skip `UPDATE SET` in ON CONFLICT clauses
    // (their INSERT INTO was already handled above).
    if (/\b(?:FROM|JOIN|UPDATE)\s+([a-z_][a-z0-9_]*)\b/i.test(s.slice(i))) {
      const mm = /\b(?:FROM|JOIN|UPDATE)\s+([a-z_][a-z0-9_]*)\b/i.exec(s.slice(i))
      if (mm[1].toLowerCase() === 'set') { i += mm.index + mm[0].length - 1; continue }
      return mm[1]
    }
  }
  return null
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
 * (SELECT * against a table missing from the schema, dynamic SQL, INSERT
 * without RETURNING). SELECT * / t.* and RETURNING * resolve to the table's
 * full column list when the migration schema knows the table. Also returns
 * `complete: false` when some items couldn't be named (e.g. `p.*`).
 */
function columnsFromSql(sql, table = null, schema = null) {
  if (!sql) return null
  const s = sql.replace(/\s+/g, ' ').trim()
  let list = null
  const sel = /^SELECT\s+(.+)$/i.exec(s)
  if (sel) {
    const head = sel[1]
    list = selectListUntilClause(head)
    const star = /^\s*(?:\*|([A-Za-z_][A-Za-z0-9_]*\.\*))\s*$/.exec(list)
    if (star) {
      // SELECT * / t.* — full column list from the migration schema.
      const t = star[1] ? resolveAliasedTable(s, star[1].slice(0, -2)) : (table || tableFromSql(s))
      const cols = schema ? schema.get(t) : null
      if (cols) return { names: [...cols.keys()], complete: true }
      return null // table unknown to the schema — leave manual
    }
  } else {
    const ret = /\bRETURNING\s+(.+)$/i.exec(s)
    if (!ret) return null
    list = ret[1]
    // `RETURNING *` — the full row: prefer the schema (all table columns,
    // including ids/defaults), falling back to synthesising from the INSERT
    // column list when the table isn't in the schema.
    if (/^\*\s*$/.test(list.trim())) {
      const t = table || tableFromSql(s)
      const cols = schema ? schema.get(t) : null
      if (cols) return { names: [...cols.keys()], complete: true }
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

/**
 * Best-effort column type by name — schema-aware: when the query's table is
 * known in the migration schema, the real SQL type (+ nullability) wins;
 * otherwise fall back to name heuristics. REVIEW after --apply regardless.
 */
function guessColumnType(name, table = null, schema = null) {
  if (schema && table) {
    const col = schema.get(table)?.get(name.toLowerCase())
    if (col) return col.nullable ? `${col.ts} | null` : col.ts
  }
  const n = name.toLowerCase()
  if (n === 'id' || n.endsWith('_id')) return 'string'
  if (n.endsWith('_at') || n.endsWith('_on') || n.endsWith('_date') || n === 'date') return 'Date'
  // COUNT(*) / COUNT(x) AS count / AS *_count → BIGINT → pg returns string;
  // only INT columns (schema-known *_num/_no/_qty) are number.
  if (n === 'count' || n.endsWith('_count')) return 'string'
  if (n.endsWith('_num') || n.endsWith('_no') || n.endsWith('_qty')) return 'number'
  if (/easting|northing|latitude|longitude|elevation|altitude|bearing|angle|distance|perimeter|area|_deg|_min|_sec|_ms|ratio|percent|_ha|_m2|\brl\b/.test(n)) return 'number'
  if (/price|amount|cost|fee|total|size|bytes|weight|priority|retry|limit|offset/.test(n)) return 'number'
  if (n.startsWith('is_') || n.startsWith('has_') || n.endsWith('_flag') || n === 'active' || n === 'enabled') return 'boolean'
  if (['details', 'payload', 'result', 'snapshot', 'metadata', 'documents', 'template', 'data', 'config', 'settings', 'permissions', 'json'].includes(n) || n.endsWith('_json') || n.endsWith('_jsonb')) return 'unknown'
  return 'string'
}

// ---------------------------------------------------------------------------
// Migration schema — real column types from src/lib/db/migrations/*.sql
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/lib/db/migrations')

/** Word tokens that end a column's type list (constraints / defaults follow). */
const SQL_STOP_RE = /^(?:NOT|NULL|DEFAULT|UNIQUE|PRIMARY|REFERENCES|CHECK|CONSTRAINT|GENERATED|COLLATE|DEFERRABLE|INITIALLY|VALIDATE|ON|CASCADE|RESTRICT|SET|NO|ACTION|USING|WITH|STORED|INLINE|ENABLE|DISABLE|COMPRESSION)$/i

/**
 * Extract just the SQL type from a column declaration
 * (`DOUBLE PRECISION NOT NULL DEFAULT 0` → `DOUBLE PRECISION`,
 *  `TIMESTAMP(3) WITH TIME ZONE` → `TIMESTAMP WITH TIME ZONE`,
 *  `VARCHAR(255)[]` → `VARCHAR(255)[]`).
 */
function extractSqlType(decl) {
  let rest = decl.trim()
  const parts = []
  while (rest) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(\([^)]*\))?/.exec(rest)
    if (!m || SQL_STOP_RE.test(m[1])) break
    parts.push(m[1] + (m[2] || ''))
    rest = rest.slice(m[0].length).trim()
  }
  if (!parts.length) return null
  if (rest.startsWith('[]')) parts[parts.length - 1] += '[]'
  return parts.join(' ')
}

/** Normalise a raw SQL type fragment to a TS type. */
function tsFromSqlType(frag) {
  let t = frag.trim().replace(/\s+/g, ' ').toUpperCase()
  const isArray = t.endsWith('[]')
  if (isArray) t = t.slice(0, -2).trim()
  t = t.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  let base
  switch (t) {
    case 'DOUBLE PRECISION':
    case 'REAL':
    case 'INTEGER':
    case 'INT':
    case 'SMALLINT':
    case 'BIGINT':
    case 'SERIAL':
    case 'BIGSERIAL':
    case 'SMALLSERIAL':
    case 'OID':
      base = 'number'
      break
    case 'NUMERIC':
    case 'DECIMAL':
    case 'MONEY':
      base = 'string' // pg returns arbitrary-precision numerics as string
      break
    case 'TIMESTAMP':
    case 'TIMESTAMP WITH TIME ZONE':
    case 'TIMESTAMPTZ':
    case 'DATE':
    case 'TIME':
      base = 'Date'
      break
    case 'BOOLEAN':
    case 'BOOL':
      base = 'boolean'
      break
    case 'JSON':
    case 'JSONB':
      base = 'unknown'
      break
    default:
      base = 'string' // UUID/TEXT/VARCHAR/CHAR/CITEXT/GEOMETRY/… (hex WKB via pg)
  }
  return isArray ? `${base}[]` : base
}

/** Parse the body of a CREATE TABLE into Map<column, {ts, nullable}>. */
function parseCreateTableBody(body) {
  const cols = new Map()
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // Table-level constraints start with a keyword, not a column name.
    if (/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK|EXCLUDE|INDEX|KEY|REFERENCES|ALTER)\b/i.test(line)) continue
    const cm = /^([a-z_][a-z0-9_]*)\s+/.exec(line)
    if (!cm) continue
    const name = cm[1].toLowerCase()
    const type = extractSqlType(line.slice(cm[0].length))
    if (!type) continue
    const notNull = /\bNOT\s+NULL\b/i.test(line) || /\bPRIMARY\s+KEY\b/i.test(line)
    cols.set(name, { ts: tsFromSqlType(type), nullable: !notNull })
  }
  return cols
}

/** Alias → real table for the SQL (`SELECT p.* FROM projects p` → p→projects). */
function resolveAliasedTable(sql, alias) {
  const re = /\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)\b/gi
  let m
  while ((m = re.exec(sql))) {
    if (m[2] === alias) return m[1]
  }
  return null
}

let _schema = null

/**
 * Merge one parsed CREATE TABLE column map into the schema. Tables that exist
 * in several migrations (`CREATE TABLE IF NOT EXISTS` — the first definition
 * wins at runtime) contribute a UNION of columns; a later definition overrides
 * the type/nullability of a column it re-declares, but never drops columns
 * only declared earlier (that would lose e.g. interval_days when a follow-up
 * migration re-creates the same table with a narrower column set).
 */
function mergeTableColumns(table, cols) {
  const existing = _schema.get(table)
  if (!existing) {
    _schema.set(table, cols)
    return
  }
  for (const [name, col] of cols) existing.set(name, col)
}

/**
 * Parse every CREATE TABLE / ALTER TABLE ADD COLUMN across
 * src/lib/db/migrations/*.sql into Map<table, Map<column, {ts, nullable}>>.
 * Duplicate CREATE TABLEs (IF NOT EXISTS) merge column sets; ALTER-added
 * columns merge in. Cached per process.
 */
function getMigrationSchema() {
  if (_schema) return _schema
  _schema = new Map()
  let files = []
  try {
    files = nodeFs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  } catch {
    return _schema
  }
  for (const f of files) {
    let src
    try {
      src = readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    } catch {
      continue
    }
    src = src.replace(/--[^\n]*/g, ' ')
    // CREATE TABLE [IF NOT EXISTS] name ( … );
    const ctRe = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(/gi
    let m
    while ((m = ctRe.exec(src))) {
      const table = m[1].toLowerCase()
      let depth = 0
      // Scan from the opening paren; depth reaches 0 again exactly at the
      // table's own closing paren (nested parens e.g. uuid_generate_v4(),
      // GEOMETRY(POINT, 4326), CHECK(...) balance inside it).
      for (let i = m.index + m[0].length - 1; i < src.length; i++) {
        const c = src[i]
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) {
            const cols = parseCreateTableBody(src.slice(m.index + m[0].length, i))
            if (cols.size) mergeTableColumns(table, cols)
            break
          }
        }
      }
    }
    // ALTER TABLE name …; — multi-line statements add several columns at once:
    //   ALTER TABLE survey_points
    //     ADD COLUMN IF NOT EXISTS datum  VARCHAR(50),
    //     ADD COLUMN IF NOT EXISTS utm_zone INTEGER;
    // Capture the whole statement body (up to its `;`, paren-aware for CHECK
    // constraints) and match EVERY `ADD [COLUMN] [IF NOT EXISTS] col TYPE`.
    const altHeadRe = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*/gi
    let h
    while ((h = altHeadRe.exec(src))) {
      const table = h[1].toLowerCase()
      let depth = 0
      let end = -1
      for (let i = altHeadRe.lastIndex; i < src.length; i++) {
        const c = src[i]
        if (c === '(') depth++
        else if (c === ')') depth--
        else if (c === ';' && depth <= 0) { end = i; break }
      }
      if (end < 0) continue
      const body = src.slice(altHeadRe.lastIndex, end)
      const addRe = /\bADD(?:\s+COLUMN)?(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+([^,;]+)/gi
      let am
      while ((am = addRe.exec(body))) {
        const name = am[1].toLowerCase()
        const type = extractSqlType(am[2])
        if (!type) continue
        let cols = _schema.get(table)
        if (!cols) { cols = new Map(); _schema.set(table, cols) }
        const notNull = /\bNOT\s+NULL\b/i.test(am[2]) || /\bPRIMARY\s+KEY\b/i.test(am[2])
        cols.set(name, { ts: tsFromSqlType(type), nullable: !notNull })
      }
    }
  }
  return _schema
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
function changedRouteFiles(baseRef, usePfc = false) {
  const diffRef = baseRef === 'HEAD' ? 'HEAD' : `${baseRef}...HEAD`
  const pattern = usePfc ? ['src/**/*.ts', 'src/**/*.tsx'] : ['src/**/route.ts']
  const raw = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', diffRef, '--', ...pattern],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const files = raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.includes('/__tests__/'))

  const routes = new Set()
  for (const f of files) {
    if (f.endsWith('/route.ts')) {
      routes.add(f)
    } else if (usePfc && f.startsWith('src/app/')) {
      let dir = path.dirname(f)
      while (dir && dir.startsWith('src/app')) {
        const candidate = path.join(dir, 'route.ts').split(/[\\/]/).join('/')
        if (nodeFs.existsSync(candidate)) {
          routes.add(candidate)
          break
        }
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    }
  }
  return [...routes].sort()
}

/**
 * Print a whole-repo per-file typed/total summary. Used by --check when it
 * passes with NO changed route files (the common push/PR case), so the CI
 * gate always shows the live typing state instead of a bare "OK" line.
 * Files with zero queries are skipped (0/0 is noise); the aggregate line
 * carries the route count.
 */
function printWholeRepoTypedSummary() {
  const rels = findRoutes()
  const lines = []
  let total = 0
  let typed = 0
  for (const rel of rels) {
    let source
    try {
      source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    } catch {
      continue
    }
    const qs = extractQueries(source)
    total += qs.length
    typed += qs.filter((q) => q.typed).length
    if (qs.length) lines.push(`${rel} (${qs.filter((q) => q.typed).length}/${qs.length} queries typed)`)
  }
  console.log(`[api-row-sweep] whole-repo row typing: ${typed}/${total} queries typed across ${rels.length} route files:`)
  for (const l of lines) console.log(`  ${l}`)
}

/** The untyped-query gate: any changed route file with an untyped db.query/client.query fails.
 * @returns 0 = pass, 1 = fail, 2 = git error. */
function runCheck() {
  const baseRef = CHECK_BASE || resolveBaseRefFromEnv()
  if (!CHECK_BASE) console.log(`[api-row-sweep] no base ref given — resolved: ${baseRef}`)

  let changed
  try {
    changed = changedRouteFiles(baseRef, PFC)
  } catch (e) {
    console.error(`[api-row-sweep] git diff failed (${e.message.split('\n')[0]}) — cannot compute changed files.`)
    return 2
  }

  if (!changed.length) {
    console.log(`[api-row-sweep] OK: no changed route files vs ${baseRef}...HEAD.`)
    printWholeRepoTypedSummary()
    return 0
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
    return 1
  }

  const typed = changed.map((rel) => {
    const source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    const qs = extractQueries(source)
    return `${rel} (${qs.filter((q) => q.typed).length}/${qs.length} queries typed)`
  })
  console.log(`[api-row-sweep] OK: ${changed.length} changed route file(s), all db.query/client.query calls typed:`)
  for (const t of typed) console.log(`  ${t}`)
  return 0
}

// ---------------------------------------------------------------------------
// Shared-schema drift gate — part of --check (whole repo, cheap static scan)
// ---------------------------------------------------------------------------

/**
 * Discover every zod schema module under src/lib/validation — a module that
 * exports at least one `*Schema` const. For each, collect the schema value
 * names and the client shape type names derived from them (convention:
 * `mapExtentSchema` -> `MapExtent`; also explicit `z.infer<typeof XSchema>`
 * type declarations, in case a name doesn't follow the convention).
 */
function discoverSharedSchemas() {
  const dir = path.join(process.cwd(), 'src/lib/validation')
  let files = []
  try {
    files = nodeFs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('__tests__') && !f.endsWith('.d.ts'))
  } catch {
    return []
  }
  const mods = []
  for (const f of files.sort()) {
    let source
    try {
      source = readFileSync(path.join(dir, f), 'utf8')
    } catch {
      continue
    }
    const schemas = new Set()
    let m
    const schemaRe = /export\s+const\s+(\w+Schema)\s*=/g
    while ((m = schemaRe.exec(source))) schemas.add(m[1])
    if (!schemas.size) continue
    const types = new Set()
    for (const s of schemas) types.add(s.slice(0, -'Schema'.length))
    const inferRe = /export\s+type\s+(\w+)\s*=\s*z\.infer\s*<\s*typeof\s+(\w+Schema)\s*>/g
    while ((m = inferRe.exec(source))) types.add(m[1])
    mods.push({
      rel: `src/lib/validation/${f}`,
      importPath: `@/lib/validation/${f.replace(/\.ts$/, '')}`,
      schemas: [...schemas],
      types: [...types],
    })
  }
  return mods
}

/**
 * Return drift violations for one route file, or null if clean.
 *
 * A violation = the file imports a client shape type from a schema module but
 * does NOT import ANY schema value from that same module — so it cannot be
 * validating the payload through the shared schema. Importing any schema from
 * the module counts (its schemas compose, e.g. viewportQueryResponseSchema
 * embeds viewportFeatureSchema), so only the true drift — type-only imports —
 * fails.
 */
function sharedSchemaDrift(rel, source, mods) {
  const modByPath = new Map(mods.map((m) => [m.importPath, m]))
  const importRe = /import\s+(?:type\s*)?\{([^}]*)\}\s+from\s+['"](@\/lib\/validation\/[^'"]+)['"]/g
  const found = new Map()
  let m
  while ((m = importRe.exec(source))) {
    const mod = modByPath.get(m[2])
    if (!mod) continue
    let entry = found.get(m[2])
    if (!entry) {
      entry = { mod, importedTypes: new Set(), importedSchemas: new Set() }
      found.set(m[2], entry)
    }
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+\s*$/, '').trim()
      if (!name) continue
      if (mod.schemas.includes(name)) entry.importedSchemas.add(name)
      if (mod.types.includes(name)) entry.importedTypes.add(name)
    }
  }
  if (!found.size) return null
  const violations = []
  for (const { mod, importedTypes, importedSchemas } of found.values()) {
    if (importedTypes.size && !importedSchemas.size) {
      const types = [...importedTypes].join(', ')
      const suggested = [...importedTypes]
        .map((t) => t + 'Schema')
        .filter((s) => mod.schemas.includes(s))
        .join(', ')
      violations.push(
        `  ${rel} imports client shape type(s) ${types} from ${mod.importPath} but no schema value from that module` +
          (suggested ? ` — add ${suggested}` : '')
      )
    }
  }
  return violations.length ? violations : null
}

/** Gate: fails if ANY route imports a client shape type without its schema. @returns true if the gate failed. */
function runSharedSchemaGate() {
  const mods = discoverSharedSchemas()
  if (!mods.length) {
    console.log('[api-row-sweep] schema gate: no shared zod schema modules found under src/lib/validation — nothing to check.')
    return false
  }
  const offenders = []
  for (const rel of findRoutes()) {
    let source
    try {
      source = readFileSync(path.join(process.cwd(), rel), 'utf8')
    } catch {
      continue
    }
    const drift = sharedSchemaDrift(rel, source, mods)
    if (drift) offenders.push(...drift)
  }
  if (offenders.length) {
    console.error('[api-row-sweep] FAIL: shared-schema drift — route(s) import client shape type(s) without the matching zod schema:')
    for (const o of offenders) console.error(o)
    console.error('[api-row-sweep] Fix: import the matching *Schema value from the same module and validate the payload with it (safeParse/parse), so the client type and the server response cannot drift.')
    return true
  }
  console.log(`[api-row-sweep] OK: shared-schema gate — ${mods.length} schema module(s), no route imports a client shape type without its schema.`)
  return false
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
  const schema = getMigrationSchema() // real column types from migrations/*.sql
  const interfaces = new Map() // row name -> { table, columns: string[] }
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
    const cols = columnsFromSql(q.raw || q.sql, q.table, schema)
    if (!cols) {
      skipped.push(`L${q.line}: ${q.sql} — no resolvable output columns (manual)`)
      continue
    }
    if (!interfaces.has(name)) {
      interfaces.set(name, { table: q.table, columns: [...cols.names] })
    } else {
      for (const c of cols.names) {
        if (!interfaces.get(name).columns.includes(c)) interfaces.get(name).columns.push(c)
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
      const entry = interfaces.get(name)
      const lines = [
        '// AUTO-GENERATED by api-row-sweep --apply — column types from migrations/*.sql + name heuristics.',
        '// pg returns bigint/numeric as string, timestamptz as Date; nullable columns carry `| null`; REVIEW.',
        `interface ${name} {`,
        ...entry.columns.map((c) => `  ${c}: ${guessColumnType(c, entry.table, schema)}`),
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
      const cols = interfaces.get(n).columns
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
 * generated interface column when possible. Returns `{ ok, diagnostics }`:
 * ok=false when the file has errors; diagnostics are `{ rel, line, code, msg,
 * attr }` entries (attr = the generated column a diagnostic traces to, when
 * it can be attributed). Callers own the exit code — the single-file
 * --apply --verify path sets exit 1 on !ok; --apply-all accumulates the
 * diagnostics into its review report and stops on the first !ok file.
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
    return { ok: false, diagnostics: [] }
  }
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) {
    console.error('[api-row-sweep] --verify: tsconfig.json not found from ' + cwd)
    return { ok: false, diagnostics: [] }
  }
  const read = ts.readConfigFile(configPath, ts.sys.readFile)
  if (read.error) {
    console.error('[api-row-sweep] --verify: cannot read tsconfig:', ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
    return { ok: false, diagnostics: [] }
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
  // Ambient declaration files are added explicitly — without them a global
  // module augmentation (e.g. src/types/next-auth.d.ts extending the session
  // user with `id`) is invisible to the single-file program, producing false
  // positives like `Property 'id' does not exist on session.user` that full
  // `tsc --noEmit` does not report.
  const programFiles = [full]
  for (const pattern of ['src/types/**/*.d.ts', 'types/**/*.d.ts', 'next-env.d.ts']) {
    try {
      const matches = nodeFs.globSync(pattern, { cwd: process.cwd() }) ?? []
      for (const m of matches) {
        const abs = path.resolve(process.cwd(), m)
        if (abs !== full && !programFiles.includes(abs)) programFiles.push(abs)
      }
    } catch { /* glob unavailable — ambient types just won't load */ }
  }
  const program = ts.createProgram(programFiles, opts)
  const sourceFile = program.getSourceFile(full)
  if (!sourceFile) {
    console.error(`[api-row-sweep] --verify: cannot parse ${rel}`)
    return { ok: false, diagnostics: [] }
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
    return { ok: true, diagnostics: [] }
  }

  console.log(`  ${all.length} diagnostic(s) — check the review notes below:`)
  const diagnostics = []
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
    diagnostics.push({ rel, line, code, msg, attr })
    console.log(`    ${rel}:${line ?? '?'}  ${code}  ${msg}`)
    if (attr) console.log(`      → ${attr}`)
  }
  console.log(`  review: ${fixable}/${all.length} diagnostic(s) trace to generated interface columns.`)
  console.log('  Fix the column types above (pg: DOUBLE PRECISION/INTEGER → number, NUMERIC/BIGINT → string,')
  console.log('  TIMESTAMPTZ → Date; add `| null` for nullable; add missing RETURNING * columns), then re-run.')
  return { ok: false, diagnostics }
}

// ---------------------------------------------------------------------------
// --apply-all: sweep --apply --verify over every untyped route file, collect
// all flagged columns into one review report, stop at the first verify fail.
// ---------------------------------------------------------------------------

async function runApplyAll() {
  const routes = findRoutes()
  const files = routes
    .map((rel) => {
      let source = ''
      try {
        source = readFileSync(path.join(process.cwd(), rel), 'utf8')
      } catch {
        return null
      }
      return { file: rel, queries: extractQueries(source) }
    })
    .filter((f) => f && f.queries.some((q) => !q.typed))

  if (!files.length) {
    console.log('[api-row-sweep] --apply-all: every route file is fully typed — nothing to apply. 🎉')
    return
  }

  console.log(`[api-row-sweep] --apply-all: ${files.length} route file(s) with ≥1 untyped query — applying + verifying in order.`)
  const review = [] // { file, diagnostics } — flagged columns for the report
  let stoppedAt = null
  for (const { file, queries } of files) {
    const unt = queries.filter((q) => !q.typed).length
    console.log(`\n${'─'.repeat(70)}\n[api-row-sweep] → ${file} (${unt} untyped)`)
    const applied = runApply(file)
    if (!applied) {
      console.error(`[api-row-sweep] --apply-all: --apply failed on ${file} — aborting.`)
      process.exitCode = 2
      return
    }
    const res = await verifyFile(file)
    if (!res.ok) {
      stoppedAt = file
      if (res.diagnostics.length) review.push({ file, diagnostics: res.diagnostics })
      break
    }
  }

  // Consolidated review report — every flagged column across the sweep.
  console.log(`\n${'═'.repeat(70)}`)
  if (stoppedAt) {
    console.log(`[api-row-sweep] --apply-all STOPPED at ${stoppedAt} — its verify failed.`)
    console.log('Fix the flagged columns below (or complete manual queries), then re-run --apply-all.')
    process.exitCode = 1
  } else {
    console.log('[api-row-sweep] --apply-all: all route files applied + verified clean. 🎉')
  }
  if (review.length) {
    console.log('\n=== REVIEW REPORT — flagged columns ===')
    for (const { file, diagnostics } of review) {
      console.log(`\n${file}`)
      for (const d of diagnostics) {
        console.log(`  L${d.line ?? '?'}  ${d.code}  ${d.msg}`)
        if (d.attr) console.log(`    → ${d.attr}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Traffic overlay — weight batch chunking by real route hits
// ---------------------------------------------------------------------------

/** Route file -> API path (`src/app/api/foo/bar/route.ts` -> `/api/foo/bar`). */
function routeFileToPath(rel) {
  const m = /^src\/app\/api\/(.+)\/route\.ts$/.exec(rel)
  return m ? '/api/' + m[1] : null
}

/**
 * Map a metric path (e.g. `/api/projects/[id]`) to the route file it serves.
 * Exact path match first; then `[id]` wildcards to any `[xyz]` folder
 * (`/api/admin/users/[id]` → src/app/api/admin/users/[userId]/route.ts).
 * Returns null when no route matches.
 */
function pathToRouteFile(apiPath, files) {
  const segs = apiPath.replace(/^\/api\//, '').split('/').filter(Boolean)
  const rels = files.map((f) => f.file)
  for (const rel of rels) {
    if (routeFileToPath(rel) === apiPath) return rel
  }
  for (const rel of rels) {
    const p = routeFileToPath(rel)
    if (!p) continue
    const rsegs = p.replace(/^\/api\//, '').split('/').filter(Boolean)
    if (rsegs.length !== segs.length) continue
    let ok = true
    for (let i = 0; i < segs.length; i++) {
      const a = segs[i]
      const b = rsegs[i]
      if (a === b) continue
      if (a === '[id]' && /^\[.*\]$/.test(b)) continue
      ok = false
      break
    }
    if (ok) return rel
  }
  return null
}

/**
 * Load the traffic map from a JSON file. Keys may be API paths
 * (`/api/projects`) or route file paths (`src/app/api/projects/route.ts`);
 * both are normalised to route file paths. Returns Map<rel, hits> or null.
 */
function loadTrafficMap(file, files) {
  let data
  try {
    data = JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf8'))
  } catch (e) {
    console.warn(`[api-row-sweep] --traffic: cannot read ${file} (${e.message.split('\n')[0]}) — proceeding unweighted.`)
    return null
  }
  const map = new Map()
  for (const [key, hits] of Object.entries(data)) {
    if (typeof hits !== 'number' || !Number.isFinite(hits) || hits <= 0) continue
    let rel
    if (key.startsWith('/api/')) {
      rel = pathToRouteFile(key, files)
    } else if (files.some((f) => f.file === key)) {
      rel = key
    } else {
      const apiPath = '/api/' + key.replace(/^src\/app\/api\//, '').replace(/\/route\.ts$/, '')
      rel = pathToRouteFile(apiPath, files)
    }
    if (rel) map.set(rel, (map.get(rel) || 0) + hits)
  }
  return map
}

/**
 * --capture-traffic <url>: fetch the Prometheus route-hits counter from
 * /api/public/metrics (metardu_route_hits_total, wired into apiHandler),
 * aggregate hits per normalized path, map paths to route files, and write the
 * traffic JSON (TRAFFIC_FILE). Returns 0 on success, 1 on fetch/parse error.
 */
async function captureTraffic(url, files) {
  const endpoint = url.replace(/\/$/, '')
  let text
  try {
    const res = await fetch(endpoint, { headers: { accept: 'text/plain' } })
    if (!res.ok) {
      console.error(`[api-row-sweep] --capture-traffic: HTTP ${res.status} from ${endpoint}`)
      return 1
    }
    text = await res.text()
  } catch (e) {
    console.error(`[api-row-sweep] --capture-traffic: fetch failed (${e.message.split('\n')[0]})`)
    return 1
  }
  const perPath = new Map()
  const lineRe = /^metardu_route_hits_total\{([^}]*)\}\s+([0-9]+)/gm
  let m
  while ((m = lineRe.exec(text))) {
    const labels = m[1]
    const pathMatch = /path="([^"]*)"/.exec(labels)
    if (!pathMatch) continue
    perPath.set(pathMatch[1], (perPath.get(pathMatch[1]) || 0) + parseInt(m[2], 10))
  }
  if (!perPath.size) {
    console.warn(`[api-row-sweep] --capture-traffic: no metardu_route_hits_total lines found — is the apiHandler wiring deployed?`)
  }
  const out = {}
  let matched = 0
  let totalHits = 0
  for (const [apiPath, hits] of perPath) {
    const rel = pathToRouteFile(apiPath, files)
    if (!rel) continue
    out[rel] = hits
    matched++
    totalHits += hits
  }
  writeFileSync(path.resolve(process.cwd(), TRAFFIC_FILE), JSON.stringify(out, null, 2), 'utf8')
  console.log(`[api-row-sweep] --capture-traffic: wrote ${matched} route(s) / ${totalHits} hits to ${TRAFFIC_FILE}`)
  return 0
}

async function main() {
  // --check is a pure gate: no report, no member scan — fail fast and cheap.
  if (checkMode) {
    // Two gates: (1) the shared-schema drift gate (whole repo, static scan),
    // then (2) the untyped-query gate on changed route files. runCheck
    // returns 0 = pass, 1 = fail, 2 = git error; Math.max preserves the
    // most severe status (a git failure must stay exit 2, not collapse to 1).
    const schemaFailed = runSharedSchemaGate() ? 1 : 0
    process.exitCode = Math.max(schemaFailed, runCheck())
    return
  }

  // --apply is a single-file mechanical edit; report mode handles the rest.
  // --verify (with --apply) typechecks the edited file via the TS compiler
  // API and attributes failures to generated columns — closing the loop.
  // Verify only when apply actually succeeded (a failed apply must not be
  // masked by a clean verify that overwrites the exit code).
  if (APPLY_FILE) {
    const applied = runApply(APPLY_FILE)
    if (verifyApply && applied) {
      const res = await verifyFile(APPLY_FILE)
      process.exitCode = res.ok ? 0 : 1
    }
    return
  }

  // --apply-all sweeps every untyped route file: apply + verify each, collect
  // all flagged columns into one review report, stop at the first verify fail.
  if (applyAllMode) {
    await runApplyAll()
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

  // Traffic overlay: --capture-traffic fetches the live counter first so the
  // same run is weighted; --traffic [file] loads a committed/exported map.
  // Hits are attached per file (0 when unknown) and drive the batch order.
  let traffic = null
  if (CAPTURE_TRAFFIC_URL) {
    process.exitCode = await captureTraffic(CAPTURE_TRAFFIC_URL, files)
  }
  if (TRAFFIC_FILE) {
    traffic = loadTrafficMap(TRAFFIC_FILE, files)
    if (traffic) {
      for (const f of files) f.hits = traffic.get(f.file) || 0
      console.log(`[api-row-sweep] traffic weighting active (${TRAFFIC_FILE}) — ${traffic.size} route(s) with hits.`)
    }
  }

  // Sort by member-access warnings desc, then query count desc; when traffic
  // is present, high-traffic routes rank first (typed first), then untyped
  // query count desc as the tiebreak within equal-hit files.
  files.sort((a, b) =>
    (traffic ? (b.hits || 0) - (a.hits || 0) : (b.memberWarnings - a.memberWarnings)) ||
    (b.queries.filter((q) => !q.typed).length - a.queries.filter((q) => !q.typed).length) ||
    (b.queries.length - a.queries.length)
  )

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

  if (BATCH_PLAN_FILE) {
    const planData = {
      generatedAt: new Date().toISOString(),
      batchSize: BATCH_SIZE,
      trafficWeighted: !!traffic,
      totalUntyped: batchFiles.reduce((a, f) => a + f.queries.filter((q) => !q.typed).length, 0),
      batchCount: batches.length,
      batches: batches.map((b, idx) => ({
        batch: idx + 1,
        untypedQueries: b.reduce((a, f) => a + f.queries.filter((q) => !q.typed).length, 0),
        files: b.map((f) => ({
          file: f.file,
          untypedQueries: f.queries.filter((q) => !q.typed).length,
          memberWarnings: f.memberWarnings,
          hits: traffic ? (f.hits || 0) : undefined,
        })),
      })),
    }
    const planPath = path.resolve(process.cwd(), BATCH_PLAN_FILE)
    writeFileSync(planPath, JSON.stringify(planData, null, 2), 'utf8')
    console.log(`[api-row-sweep] wrote stable batch plan to ${BATCH_PLAN_FILE} (${batches.length} batches, ${planData.totalUntyped} untyped queries)`)
  }

  if (BATCH !== null) {
    if (!files.length) {
      console.error('[api-row-sweep] no route files found — route discovery failed (check src/ tree).')
      process.exit(2)
    }

    // Stable batch numbers: when a committed plan exists (the default
    // docs/route-row-typing-plan.json, or the --batch-plan path), batch N's
    // FILE MEMBERSHIP comes from the plan — numbers never shift as files get
    // typed, so the doc's batch references stay valid. Query lines are still
    // read live from the current source (typed status updates as the grind
    // proceeds); re-run --batch-plan after adding new routes to re-chunk.
    let b = null
    let planUsed = false
    const planPath = path.resolve(process.cwd(), BATCH_PLAN_FILE || DEFAULT_BATCH_PLAN)
    if (!BATCH_PLAN_FILE || nodeFs.existsSync(planPath)) {
      try {
        const plan = JSON.parse(readFileSync(planPath, 'utf8'))
        if (plan && Array.isArray(plan.batches) && plan.batches.length && BATCH <= plan.batches.length) {
          const planned = plan.batches[BATCH - 1]
          if (planned && Array.isArray(planned.files) && planned.files.length) {
            const byFile = new Map(files.map((f) => [f.file, f]))
            b = planned.files
              .map((pf) => byFile.get(pf.file))
              .filter((f) => f !== undefined) // plan may list files since deleted/renamed — drop silently
            planUsed = true
          }
        }
      } catch { /* plan missing/corrupt — fall back to live chunking */ }
    }
    if (!b) {
      if (!batchFiles.length) {
        console.log('[api-row-sweep] every route file is fully typed — the row-typing grind is complete! 🎉')
        process.exit(0)
      }
      if (BATCH > batches.length) {
        console.error(`[api-row-sweep] batch ${BATCH} out of range — found ${batches.length} batch(es) of ~${BATCH_SIZE} untyped queries (live chunking; no usable committed plan).`)
        process.exit(2)
      }
      b = batches[BATCH - 1]
    }
    const bUntyped = b.reduce((a, f) => a + f.queries.filter((q) => !q.typed).length, 0)
    const bWarn = b.reduce((a, f) => a + f.memberWarnings, 0)
    console.log(`\n=== API ROW-TYPING BATCH ${BATCH} WORKLIST (${bUntyped} untyped queries · ${b.length} files · ${bWarn} member-access warnings) ===`)
    if (planUsed) {
      console.log(`file membership from committed plan ${BATCH_PLAN_FILE || DEFAULT_BATCH_PLAN} — batch numbers are stable across scans`)
      console.log(`query lines are live; re-run --batch-plan after adding new routes to re-chunk\n`)
    } else {
      console.log(`chunked by cumulative untyped-query count (--batch-size ${BATCH_SIZE}); order = most untyped queries first`)
      console.log(`batches are computed live from this scan — batch numbers may differ from the doc's historical numbers`)
      console.log(`run --batch-plan to write a committed plan and freeze the numbering\n`)
    }
    for (const f of b) {
      const unt = f.queries.filter((q) => !q.typed).length
      const hits = traffic ? `${f.hits || 0} hits · ` : ''
      console.log(`${f.file}  (${hits}${f.memberWarnings} member-access · ${f.queries.length} queries, ${unt} untyped)`)
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
