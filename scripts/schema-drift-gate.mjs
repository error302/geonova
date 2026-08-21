#!/usr/bin/env node
/**
 * schema-drift-gate.mjs — catches application code selecting DB columns
 * that no migration defines.
 *
 * Why: /project/[id] selected projects.workflow_step + workflow_max_unlocked,
 * but NO migration ever created those columns. PostgREST errored, the page
 * treated it as "not found" and silently redirected every surveyor back to
 * the dashboard — for weeks. Migrations are the schema's source of truth
 * (src/lib/db/migrations/, applied by migrate-unified.mjs at container start).
 *
 * Heuristic (pure node, no deps):
 *   1. Scan src/**\/*.ts(x) for supabase-style queries:
 *        .from('<table>') ... .select('<col, col, col>')
 *      (columns may span lines; aliases "col:alias" use the real name;
 *       jsonb arrow "col->key" uses col; '*' / count() skipped)
 *   2. Collect every column ever defined for each table across migrations
 *      (CREATE TABLE <tbl> (...), ALTER TABLE <tbl> ADD COLUMN col).
 *   3. Fail on any selected column with zero migration mentions for its
 *      table. Generic noise (created_at, id, …) is naturally covered.
 *
 * Exit code: 0 = clean, 1 = drift found. Wired into ci.yml.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = process.env.SCHEMA_DRIFT_SRC || join(process.cwd(), 'src')
const MIGRATIONS = process.env.SCHEMA_DRIFT_MIGRATIONS || join(process.cwd(), 'src', 'lib', 'db', 'migrations')

function walk(dir, exts, out = []) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p)
  }
  return out
}

/* ---------- 1. migrations: table -> Set(columns) ---------- */
function collectMigratedColumns() {
  const tables = new Map() // table -> Map(col -> firstFile)
  const addCol = (table, col, file) => {
    if (!table || !col) return
    if (!tables.has(table)) tables.set(table, new Map())
    const cols = tables.get(table)
    if (!cols.has(col)) cols.set(col, file)
  }
  for (const file of walk(MIGRATIONS, ['.sql'])) {
    const sql = readFileSync(file, 'utf8')
    // CREATE TABLE [IF NOT EXISTS] <name> ( ... )
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_.]*)["`]?\s*\(/gi
    let m
    while ((m = createRe.exec(sql)) !== null) {
      const table = m[1].split('.').pop()
      // take balanced-paren body
      let depth = 0, body = '', i = m.index + m[0].length - 1
      for (; i < sql.length; i++) {
        const ch = sql[i]
        if (ch === '(') depth++
        else if (ch === ')') { depth--; if (depth === 0) break }
        body += ch
      }
      for (const lineDef of body.split('\n')) {
        const cm = lineDef.match(/^\s*["`]?([a-z_][a-z0-9_]*)["`]?\s+[a-zA-Z]/)
        if (cm && !/^(constraint|primary|foreign|unique|check|exclude)$/i.test(cm[1])) {
          addCol(table, cm[1], file)
        }
      }
    }
    // ALTER TABLE <name> ADD COLUMN [IF NOT EXISTS] <col>[, ADD COLUMN …]
    // A single ALTER can add several comma-separated columns; capture them
    // all by splitting into statements first.
    const stmtRe = /alter\s+table\s+(?:if\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?[^;]*?(?=;|$)/gi
    while ((m = stmtRe.exec(sql)) !== null) {
      const table = m[1]
      const stmt = m[0]
      if (!/add\s+column/i.test(stmt)) continue
      const colRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/gi
      let cm
      while ((cm = colRe.exec(stmt)) !== null) addCol(table, cm[1], file)
    }
  }
  return tables
}

/* ---------- 2. app code: (table, col) selections ---------- */
function collectSelectedColumns() {
  const usages = [] // {file,line,table,col}
  const files = walk(SRC, ['.ts', '.tsx'])
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const fromRe = /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/g
    let fm
    while ((fm = fromRe.exec(src)) !== null) {
      const table = fm[1]
      // look ahead up to 400 chars for .select(
      const window = src.slice(fm.index, fm.index + 500)
      const sm = window.match(/\.select\(\s*["'`]([^"'`]+)["'`]/)
      if (!sm) continue
      const spec = sm[1]
      if (spec.trim() === '*') continue
      for (let part of spec.split(',')) {
        part = part.trim()
        if (!part || part === '*') continue
        part = part.split(':')[0].trim()          // alias
        part = part.split('->')[0].split('->>')[0].trim() // jsonb arrows
        part = part.replace(/^["']|["']$/g, '')
        if (!part || /\W/.test(part) || /^(count|sum|avg|min|max)\s*\(/i.test(part)) continue
        const line = src.slice(0, fm.index).split('\n').length
        usages.push({ file: relative(process.cwd(), file), line, table, col: part })
      }
    }
  }
  return usages
}

/* ---------- main ---------- */
function main() {
  const migrated = collectMigratedColumns()
  const usages = collectSelectedColumns()
  const drift = []
  const unknownTables = new Map()

  // Ratchet baseline: known pre-existing drift (2026-08-21 audit). Each entry
  // is "<table>.<col>"; entries must be REMOVED as they get real migrations.
  // New drift not in this list fails CI immediately.
  let baseline = new Set()
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'schema-drift-baseline.json'), 'utf8'))
    baseline = new Set(raw)
  } catch {
    // no baseline file — everything blocks
  }

  for (const u of usages) {
    const cols = migrated.get(u.table)
    if (!cols) {
      if (!unknownTables.has(u.table)) unknownTables.set(u.table, u)
      continue
    }
    if (!cols.has(u.col)) drift.push(u)
  }

  const newDrift = drift.filter((d) => !baseline.has(`${d.table}.${d.col}`))
  const newUnknown = [...unknownTables.values()].filter((u) => !baseline.has(`${u.table}.*`))

  if (newDrift.length === 0 && newUnknown.length === 0) {
    const known = drift.length + unknownTables.size
    console.log(`schema-drift-gate: OK — ${usages.length} selected columns; ${known} known drift entr(y|ies) baselined`)
    process.exit(0)
  }

  console.log(`schema-drift-gate: ${newDrift.length} NEW drifted selection(s), ${newUnknown.length} NEW unmigrated table(s)\n`)
  for (const d of newDrift) console.log(`  ${d.file}:${d.line}  ${d.table}.${d.col} — not defined in any migration`)
  for (const u of newUnknown) console.log(`  ${u.file}:${u.line}  table "${u.table}" has no CREATE TABLE in migrations/`)
  if (process.argv.includes('--update-baseline')) {
    const entries = [...new Set([...drift.map((d) => `${d.table}.${d.col}`), ...[...unknownTables.keys()].map((t) => `${t}.*`)])]
    const out = join(process.cwd(), 'scripts', 'schema-drift-baseline.json')
    writeFileSync(out, JSON.stringify(entries.sort(), null, 2) + '\n')
    console.log(`\nBaseline updated (${entries.length} entries) -> scripts/schema-drift-baseline.json`)
  } else {
    console.log('\nAdd an ALTER TABLE ... ADD COLUMN migration (or fix the column name).')
  }
  process.exit(1)
}

main()
