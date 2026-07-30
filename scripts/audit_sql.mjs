#!/usr/bin/env node
// SQL audit: scan src/app/api/**/route.ts files for db.query() strings,
// extract referenced table names, check against migrations.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = '/home/z/my-project/repos/metardu';
const SRC = join(ROOT, 'src');

// 1. Get all table names + column additions from migrations
const migrationFiles = execSync(`find ${ROOT}/src/lib/db/migrations -name "*.sql"`, { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const tables = new Set();
const dropTables = new Set();
const tableColumns = new Map(); // table -> Set(column)

function extractTablesFromSql(sql, sourceLabel) {
  // CREATE TABLE [IF NOT EXISTS] table_name (
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi)) {
    tables.add(m[1]);
  }
  // DROP TABLE [IF EXISTS] table_name
  for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    dropTables.add(m[1]);
  }
  // ALTER TABLE table ADD COLUMN [IF NOT EXISTS] col_name
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
    if (!tableColumns.has(m[1])) tableColumns.set(m[1], new Set());
    tableColumns.get(m[1]).add(m[2]);
  }
  // Columns inside CREATE TABLE — for first-found table, capture column lines
  // (best-effort — skip for now, will check specific routes later)
}

for (const f of migrationFiles) {
  try {
    extractTablesFromSql(readFileSync(f, 'utf8'), f);
  } catch (e) {}
}

console.error(`Migrations define ${tables.size} tables, drop ${dropTables.size}, alter ${tableColumns.size}`);

// Compute live tables = tables - dropped tables
const liveTables = new Set();
for (const t of tables) {
  if (!dropTables.has(t)) liveTables.add(t);
}
console.error(`Live tables after drops: ${liveTables.size}`);
console.error(`Tables: ${[...liveTables].sort().join(', ')}\n`);

// 2. Scan all route.ts files for SQL queries
const routeFiles = execSync(`find ${SRC}/app/api -name "route.ts"`, { encoding: 'utf8' })
  .split('\n').filter(Boolean);

console.log(`Scanning ${routeFiles.length} route.ts files...\n`);

const suspiciousTables = new Map(); // tableName -> [{file, line, snippet}]

// Match FROM table_name, JOIN table_name, INTO table_name, UPDATE table_name, INSERT INTO table_name, DELETE FROM table_name
for (const file of routeFiles) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  const lines = src.split('\n');
  let inString = false;
  // Find all SQL-like strings inside backticks or quotes
  // Use a state machine to handle multi-line template literals
  let i = 0, line = 1;
  // Walk through text char by char
  let buf = '';
  let inTpl = false;
  let tplStartLine = 1;
  let charLine = 1;
  for (let idx = 0; idx < src.length; idx++) {
    const c = src[idx];
    const next = src[idx + 1];
    if (c === '\n') { charLine++; }
    if (!inTpl) {
      if (c === '`') {
        inTpl = true;
        tplStartLine = charLine;
        buf = '';
      }
    } else {
      if (c === '`') {
        // End of template — analyze buf
        analyzeSql(buf, file, tplStartLine);
        inTpl = false;
        buf = '';
      } else {
        buf += c;
      }
    }
  }
}

function analyzeSql(sql, file, startLine) {
  // Skip if no SQL keywords
  if (!/\b(SELECT|INSERT|UPDATE|DELETE|FROM|JOIN|INTO|TABLE)\b/i.test(sql)) return;
  // Extract referenced tables
  const refs = new Set();
  for (const m of sql.matchAll(/\bFROM\s+([a-z_][a-z0-9_]*)(?:\s+(?:AS\s+)?[a-z_][a-z0-9_]*)?/gi)) refs.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/\bJOIN\s+([a-z_][a-z0-9_]*)/gi)) refs.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/\bINTO\s+([a-z_][a-z0-9_]*)/gi)) refs.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/\bUPDATE\s+([a-z_][a-z0-9_]*)\s+/gi)) refs.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/\bTABLE\s+([a-z_][a-z0-9_]*)/gi)) refs.add(m[1].toLowerCase());
  // Filter out reserved words / common SQL fragments
  const reserved = new Set(['select', 'where', 'and', 'or', 'not', 'null', 'true', 'false', 'as', 'on', 'using', 'set', 'values', 'returning', 'group', 'order', 'limit', 'offset', 'with', 'inner', 'left', 'right', 'outer', 'cross', 'natural', 'lateral', 'distinct', 'all', 'union', 'intersect', 'except', 'case', 'when', 'then', 'else', 'end', 'cast', 'exists', 'in', 'between', 'like', 'ilike', 'is', 'asc', 'desc']);
  for (const r of refs) {
    if (reserved.has(r)) continue;
    if (r === 'dual' || r === 'pg_catalog' || r === 'information_schema' || r === 'generate_series' || r === 'unnest') continue;
    if (!liveTables.has(r) && !tables.has(r)) {
      // Could be a function call or alias; report only if it really looks like a table
      // Check if it appears as FROM/JOIN/INTO/UPDATE table (more strict)
      const isStrict =
        new RegExp(`\\bFROM\\s+${r}\\b`, 'i').test(sql) ||
        new RegExp(`\\bJOIN\\s+${r}\\b`, 'i').test(sql) ||
        new RegExp(`\\bINTO\\s+${r}\\b`, 'i').test(sql) ||
        new RegExp(`\\bUPDATE\\s+${r}\\b`, 'i').test(sql);
      if (isStrict) {
        if (!suspiciousTables.has(r)) suspiciousTables.set(r, []);
        // Get short snippet
        const snippet = sql.replace(/\s+/g, ' ').trim().slice(0, 200);
        suspiciousTables.get(r).push({ file: file.replace(ROOT + '/', ''), line: startLine, snippet });
      }
    }
  }
}

console.log('=== TABLES REFERENCED IN ROUTES BUT NOT DEFINED IN MIGRATIONS ===');
if (suspiciousTables.size === 0) {
  console.log('(none found)');
} else {
  for (const [t, hits] of [...suspiciousTables.entries()].sort()) {
    console.log(`\n--- Table '${t}' (${hits.length} refs) ---`);
    for (const h of hits.slice(0, 5)) {
      console.log(`  ${h.file}:${h.line}`);
      console.log(`    ${h.snippet}`);
    }
    if (hits.length > 5) console.log(`  ... and ${hits.length - 5} more`);
  }
}
