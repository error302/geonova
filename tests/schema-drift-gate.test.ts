/**
 * Regression tests for scripts/schema-drift-gate.mjs — the CI gate that
 * catches application code selecting DB columns no migration defines.
 *
 * These tests exist because the gate itself shipped a bug (fixed in 876f7445):
 * its 500-char .select() lookahead crossed FUNCTION boundaries, so
 * deleteJob's `.from('jobs').delete()` swallowed getEquipmentByType's
 * `.select('equipment')` and mis-attributed `jobs.equipment` drift — a
 * phantom CI failure that masked the real signal. Gates need tests exactly
 * like product code does.
 *
 * Test seam: the gate exposes SCHEMA_DRIFT_SRC / SCHEMA_DRIFT_MIGRATIONS env
 * vars (same pattern as the aria-label-gate tests). The gate is a
 * self-executing CLI script, so we run it as a subprocess against temp-dir
 * fixtures, following tests/aria-label-gate.test.ts.
 */
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const GATE = path.join(__dirname, '..', 'scripts', 'schema-drift-gate.mjs')
const ROOT = path.join(__dirname, '..')

interface GateResult {
  code: number
  output: string
}

/**
 * Run the real gate CLI against fixture src/ + migrations/ trees.
 *
 * cwd is a TEMP dir (not the repo root) so the repo's own
 * scripts/schema-drift-baseline.json is NOT loaded — every finding blocks.
 * That keeps these tests independent of the repo's live drift state.
 * (Pass `useRepoCwd: true` for baseline-ratchet tests.)
 */
function runGateOn(
  srcFiles: Record<string, string>,
  migrationFiles: Record<string, string>,
  opts: { useRepoCwd?: boolean; extraArgs?: string[] } = {}
): GateResult {
  const dir = mkdtempSync(path.join(tmpdir(), 'schema-drift-'))
  const srcDir = path.join(dir, 'src')
  const migDir = path.join(dir, 'migrations')
  mkdirSync(srcDir, { recursive: true })
  mkdirSync(migDir, { recursive: true })
  for (const [name, content] of Object.entries(srcFiles)) {
    const p = path.join(srcDir, name)
    mkdirSync(path.dirname(p), { recursive: true })
    writeFileSync(p, content, 'utf8')
  }
  for (const [name, content] of Object.entries(migrationFiles)) {
    writeFileSync(path.join(migDir, name), content, 'utf8')
  }
  const cwd = opts.useRepoCwd ? ROOT : dir
  if (opts.useRepoCwd) {
    // --update-baseline would rewrite the REPO baseline — never allow that here.
    if (opts.extraArgs?.includes('--update-baseline')) {
      throw new Error('refusing --update-baseline against the repo baseline')
    }
  } else {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  }
  try {
    try {
      const output = execFileSync('node', [GATE, ...(opts.extraArgs ?? [])], {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          SCHEMA_DRIFT_SRC: srcDir,
          SCHEMA_DRIFT_MIGRATIONS: migDir,
        },
      })
      return { code: 0, output }
    } catch (err: any) {
      return { code: err.status ?? 1, output: String(err.stdout ?? '') }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The exact regression from 876f7445: a select-less query followed by
 *  another function's query within the 500-char lookahead window. */
const CROSS_FUNCTION_FIXTURE = `// src/lib/api-client/jobs.ts (regression fixture)
export async function deleteJob(id: string) {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

export async function getEquipmentByType(type: string) {
  const { data, error } = await supabase
    .from('equipment_recommendations')
    .select('equipment')
    .eq('type', type)
  if (error) throw error
  return data
}
`

const JOBS_MIGRATION = `-- 053: jobs + equipment recommendations
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  title TEXT,
  status VARCHAR(30)
);
CREATE TABLE equipment_recommendations (
  id UUID PRIMARY KEY,
  equipment TEXT,
  type VARCHAR(50)
);
`

describe('schema-drift-gate: cross-function .select() misattribution (876f7445 regression)', () => {
  test('a .from() with no .select must not swallow the NEXT function\'s .select', () => {
    // Pre-fix: deleteJob's .from('jobs') lookahead ran past getEquipmentByType's
    // .from() and matched its .select('equipment') → phantom 'jobs.equipment'
    // drift → false-red CI. The window must truncate at the next .from(.
    const { code, output } = runGateOn(
      { 'jobs.ts': CROSS_FUNCTION_FIXTURE },
      { '053_jobs.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(0)
    expect(output).toContain('schema-drift-gate: OK')
  })

  test('the misattribution returns the moment two queries share one table', () => {
    // Variant where the second query reuses the SAME table: even pre-fix the
    // columns would be attributed to the right table — this documents that
    // the fix did not over-truncate (a .select BEFORE the next .from still
    // belongs to the current query).
    const src = `export async function a() {
  return supabase.from('jobs').select('title, status')
}
`
    const { code, output } = runGateOn(
      { 'ok.ts': src },
      { '053_jobs.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(0)
    expect(output).toContain('2 selected columns')
  })
})

describe('schema-drift-gate: drift detection', () => {
  test('unknown column fails with file:line and table.col', () => {
    const src = `export async function getJobs() {
  return supabase.from('jobs').select('id, workflow_step')
}
`
    const { code, output } = runGateOn(
      { 'jobs.ts': src },
      { '053_jobs.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(1)
    expect(output).toContain('jobs.workflow_step — not defined in any migration')
    expect(output).toMatch(/jobs\.ts:\d+/)
    expect(output).toContain('Add an ALTER TABLE ... ADD COLUMN migration')
  })

  test('table with no CREATE TABLE is reported as unmigrated', () => {
    const src = `export async function x() {
  return supabase.from('phantom_table').select('id')
}
`
    const { code, output } = runGateOn(
      { 'x.ts': src },
      { '053_jobs.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(1)
    expect(output).toContain('table "phantom_table" has no CREATE TABLE in migrations/')
  })

  test('ALTER TABLE ADD COLUMN counts as a defined column (the 050 lesson)', () => {
    // projects.workflow_step was queried for weeks with no migration — the
    // bug class this gate exists for. The fix MUST arrive via ALTER TABLE,
    // and once it does, the gate must accept it.
    const src = `export async function getP() {
  return supabase.from('jobs').select('id, workflow_step')
}
`
    const mig = JOBS_MIGRATION + `
ALTER TABLE jobs ADD COLUMN workflow_step INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_max_unlocked INTEGER DEFAULT 0;
`
    const { code } = runGateOn({ 'jobs.ts': src }, { '058.sql': mig })
    expect(code).toBe(0)
  })

  test('aliases resolve to the REAL column name (gate bug found by this suite)', () => {
    // Supabase/PostgREST alias syntax is `alias:column`. The gate used to
    // validate the alias token (split(':')[0]) — wrong side of the colon.
    // `jobTitle: title` must validate `title`, NOT `jobTitle`.
    const src = `export async function q() {
  return supabase.from('jobs').select('jobTitle: title, meta->plan, info->>tier')
}
`
    const { code, output } = runGateOn(
      { 'q.ts': src },
      {
        'mig.sql': `CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  title TEXT,
  meta JSONB,
  info JSONB
);`,
      }
    )
    expect(code).toBe(0)
    expect(output).toContain('3 selected columns')
  })

  test('an aliased select of an UNMIGRATED column still blocks on the real column', () => {
    const src = `export async function q() {
  return supabase.from('jobs').select('niceName: workflow_step')
}
`
    const { code, output } = runGateOn(
      { 'q.ts': src },
      { 'mig.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(1)
    expect(output).toContain('jobs.workflow_step — not defined in any migration')
  })

  test('star selects and aggregates are skipped', () => {
    const src = `export async function q() {
  const a = await supabase.from('jobs').select('*')
  const b = await supabase.from('jobs').select('count(*)')
  return [a, b]
}
`
    const { code, output } = runGateOn(
      { 'q.ts': src },
      { 'mig.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(0)
    expect(output).toContain('0 selected columns')
  })
})

describe('schema-drift-gate: baseline ratchet', () => {
  test('with no baseline file, ALL drift blocks (temp cwd)', () => {
    const src = `export async function q() {
  return supabase.from('jobs').select('legacy_col')
}
`
    const { code } = runGateOn(
      { 'q.ts': src },
      { 'mig.sql': JOBS_MIGRATION }
    )
    expect(code).toBe(1)
  })

  test('repo baseline suppresses baselined COLUMN entries only (repo cwd)', () => {
    // peer_reviews.rating is a real baseline entry (stale drift ratchet):
    // selecting it against the repo's REAL migrations must pass with the
    // repo baseline loaded, while a non-baselined column on the same table
    // blocks. Pins the ratchet's actual semantics: `table.*` wildcards only
    // cover UNKNOWN tables; column entries cover known-table column drift.
    const select = (col: string) => `export async function q() {
  return supabase.from('peer_reviews').select('${col}')
}
`
    const repoMigrations = path.join(ROOT, 'src', 'lib', 'db', 'migrations')
    const mk = (col: string) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'schema-drift-'))
      mkdirSync(path.join(dir, 'src'), { recursive: true })
      writeFileSync(path.join(dir, 'src', 'q.ts'), select(col), 'utf8')
      return dir
    }
    const run = (col: string) => {
      const dir = mk(col)
      try {
        try {
          const output = execFileSync('node', [GATE], {
            cwd: ROOT,
            encoding: 'utf8',
            env: {
              ...process.env,
              SCHEMA_DRIFT_SRC: path.join(dir, 'src'),
              SCHEMA_DRIFT_MIGRATIONS: repoMigrations,
            },
          })
          return { code: 0, output }
        } catch (err: any) {
          return { code: err.status ?? 1, output: String(err.stdout ?? '') }
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
    // Baselined entry: suppressed → green
    const baselined = run('rating')
    expect(baselined.code).toBe(0)
    // Non-baselined entry on the same known table: blocks → red
    const fresh = run('totally_new_column')
    expect(fresh.code).toBe(1)
    expect(fresh.output).toContain('peer_reviews.totally_new_column')
  })
})
