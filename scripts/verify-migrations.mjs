#!/usr/bin/env node
/**
 * verify-migrations.mjs — post-deploy schema verification gate.
 *
 * WHY: docker-entrypoint.sh runs migrate-unified.mjs at container start but
 * only WARNS on failure ("app will start anyway"), and until now nothing ever
 * re-checked the result — a silently failed migration (the 054 case: broken
 * SQL that blocked 055-057 from ever applying) left prod running with a
 * drifted schema and no signal. This script is the second lock on the door:
 * it compares the migrations directory (source of truth) against the
 * schema_migrations table (what the database actually has) and exits 1 on
 * any drift.
 *
 * Checks:
 *   1. MISSING  — migration file with no schema_migrations row (never
 *                 applied, or applied and the row was lost)
 *   2. MUTATED  — applied row whose stored SHA-256 checksum no longer
 *                 matches the file (an already-applied migration was edited)
 *   3. GHOST    — schema_migrations row with no file (deleted migration)
 *
 * Exit codes: 0 = verified, 1 = drift/connection failure (fail closed),
 * 2 = usage error.
 *
 * Usage:
 *   node scripts/verify-migrations.mjs            # uses DATABASE_URL
 *   MIGRATIONS_DIR=/tmp/mig node scripts/verify-migrations.mjs
 *
 * Pure logic is exported for tests (tests/verify-migrations.test.ts); the DB
 * I/O is a thin shell. Run inside the app container (has node + pg +
 * DATABASE_URL) — wired into .github/workflows/deploy.yml.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR || join(process.cwd(), 'src', 'lib', 'db', 'migrations')

/** Migration file → { version, checksum } the same way migrate-unified.mjs does. */
export function collectFileMigrations(dir = MIGRATIONS_DIR) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return [] // caller decides how to treat an unreadable dir
  }
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const filepath = join(dir, filename)
      const checksum = createHash('sha256').update(readFileSync(filepath)).digest('hex')
      return { version: filename.replace(/\.sql$/, ''), filename, checksum }
    })
}

/**
 * Pure drift computation — the part tests pin.
 *
 * @param {Array<{version: string, checksum: string}>} files  migrations on disk
 * @param {Array<{version: string, checksum: string | null}>} applied  schema_migrations rows
 * @returns {{missing: string[], mutated: Array<{version, stored, actual}>, ghost: string[], ok: boolean}}
 */
export function computeDrift(files, applied) {
  const appliedBy = new Map(applied.map((r) => [r.version, r]))
  const fileVersions = new Set(files.map((f) => f.version))

  const missing = files.filter((f) => !appliedBy.has(f.version)).map((f) => f.version)

  const mutated = []
  for (const f of files) {
    const row = appliedBy.get(f.version)
    // Rows without a stored checksum come from the legacy schema migration —
    // they cannot be verified, so treat them as verified-but-unverifiable
    // rather than drift (migrate-unified re-writes the checksum on --force).
    if (row && row.checksum && row.checksum !== f.checksum) {
      mutated.push({ version: f.version, stored: row.checksum, actual: f.checksum })
    }
  }

  const ghost = applied
    .map((r) => r.version)
    .filter((v) => !fileVersions.has(v))

  return { missing, mutated, ghost, ok: missing.length === 0 && mutated.length === 0 && ghost.length === 0 }
}

function fail(msg) {
  console.error(`verify-migrations: FAIL — ${msg}`)
  process.exit(1)
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    (() => {
      fail('DATABASE_URL is not set — cannot verify schema state (fail closed).')
    })()

  const files = collectFileMigrations(MIGRATIONS_DIR)
  if (files.length === 0) {
    fail(`no migration files found in ${MIGRATIONS_DIR} — refusing to "verify" against nothing.`)
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 })
  let applied
  try {
    const res = await pool.query(
      'SELECT version, checksum FROM schema_migrations ORDER BY version'
    )
    applied = res.rows
  } catch (err) {
    fail(`could not read schema_migrations (${err.message}). If the table does not exist, NO migration has ever been recorded for this database.`)
  } finally {
    await pool.end().catch(() => {})
  }

  const drift = computeDrift(files, applied)

  if (drift.ok) {
    console.log(
      `verify-migrations: OK — ${files.length} migration(s) applied, checksums match, no ghosts.`
    )
    return
  }

  for (const v of drift.missing) {
    console.error(`  MISSING  ${v}.sql — file exists but was never applied (or its row was lost)`)
  }
  for (const m of drift.mutated) {
    console.error(
      `  MUTATED  ${m.version}.sql — applied checksum ${m.stored.slice(0, 12)}… ≠ file checksum ${m.actual.slice(0, 12)}… (an applied migration was edited — deploy a NEW migration instead)`
    )
  }
  for (const v of drift.ghost) {
    console.error(`  GHOST    schema_migrations has "${v}" but no such file exists on disk`)
  }
  fail(
    `${drift.missing.length} missing, ${drift.mutated.length} mutated, ${drift.ghost.length} ghost migration(s). ` +
      'The running schema does NOT match the migrations directory. Check container startup logs for a failed migration (the entrypoint only warns and continues).'
  )
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`verify-migrations: FAIL — ${e.message}`)
    process.exit(1)
  })
}
