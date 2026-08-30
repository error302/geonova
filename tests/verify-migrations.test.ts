/**
 * Unit tests for scripts/verify-migrations.mjs — the post-deploy schema
 * verification gate.
 *
 * The 054 lesson: a broken migration (referencing nonexistent columns) failed
 * silently at container start — the entrypoint only warns and continues — and
 * silently BLOCKED migrations 055-057 from ever applying. Nothing re-checked
 * the result. This gate exists so that never happens again; these tests pin
 * the drift-detection logic itself (the DB I/O shell is 10 lines of pg).
 *
 * The script is ESM (.mjs) with exported pure functions and a guarded main(),
 * so jest (CJS) cannot import it directly — same constraint as the axe
 * scanner. Tests therefore spawn a tiny node subprocess per behaviour
 * (computeDrift via a driver), keeping the real module as the code under test.
 */
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.join(__dirname, '..')

/** Run computeDrift inside a node subprocess against JSON inputs. */
function drift(files: Array<{ version: string; checksum: string }>, applied: Array<{ version: string; checksum: string | null }>) {
  const driver = `
    const m = await import(${JSON.stringify(path.join(ROOT, 'scripts', 'verify-migrations.mjs'))});
    const out = m.computeDrift(
      ${JSON.stringify(files)},
      ${JSON.stringify(applied)}
    );
    process.stdout.write(JSON.stringify(out));
  `
  const output = execFileSync(
    'node',
    ['--input-type=module', '-e', driver],
    { encoding: 'utf8', cwd: ROOT }
  )
  return JSON.parse(output.trim().split('\n').pop() as string)
}

describe('computeDrift: exact match', () => {
  test('all applied, checksums match, no ghosts → ok', () => {
    const files = [
      { version: '000_canonical_schema', checksum: 'a'.repeat(64) },
      { version: '001_rbac_fixed', checksum: 'b'.repeat(64) },
    ]
    const applied = [
      { version: '000_canonical_schema', checksum: 'a'.repeat(64) },
      { version: '001_rbac_fixed', checksum: 'b'.repeat(64) },
    ]
    const d = drift(files, applied)
    expect(d.ok).toBe(true)
    expect(d.missing).toEqual([])
    expect(d.mutated).toEqual([])
    expect(d.ghost).toEqual([])
  })

  test('legacy rows with NULL checksum are treated as unverifiable, not drift', () => {
    // migrate-unified auto-migrates legacy schema_migrations tables that lack
    // a checksum column; those rows cannot be verified and must not fail the
    // gate (migrate-unified re-writes checksums on --force re-apply).
    const files = [{ version: '000_canonical_schema', checksum: 'a'.repeat(64) }]
    const applied = [{ version: '000_canonical_schema', checksum: null }]
    const d = drift(files, applied)
    expect(d.ok).toBe(true)
  })
})

describe('computeDrift: the 054 failure class (missing)', () => {
  test('a migration file with no applied row is MISSING — the exact silent-054 signature', () => {
    const files = [
      { version: '054_ghost_row_purge', checksum: 'd'.repeat(64) },
      { version: '055_payment_history_provider_id_unique', checksum: 'e'.repeat(64) },
    ]
    const applied: Array<{ version: string; checksum: string }> = [] // nothing ever applied — e.g. entrypoint failed silently
    const d = drift(files, applied)
    expect(d.ok).toBe(false)
    expect(d.missing).toEqual(['054_ghost_row_purge', '055_payment_history_provider_id_unique'])
  })

  test('later migrations blocked by an earlier failure are all reported', () => {
    const files = ['053', '054', '055', '056', '057'].map((v) => ({
      version: `${v}_x`,
      checksum: 'f'.repeat(64),
    }))
    const applied = files.slice(0, 2) // 054 applied; 055-057 never ran
    const d = drift(files, applied)
    expect(d.missing).toEqual(['055_x', '056_x', '057_x'])
  })
})

describe('computeDrift: edited applied migration (mutated)', () => {
  test('checksum mismatch is reported with both hashes', () => {
    const files = [{ version: '010_dpa2019', checksum: '1'.repeat(64) }]
    const applied = [{ version: '010_dpa2019', checksum: '2'.repeat(64) }]
    const d = drift(files, applied)
    expect(d.ok).toBe(false)
    expect(d.mutated).toHaveLength(1)
    expect(d.mutated[0].version).toBe('010_dpa2019')
    expect(d.mutated[0].stored).toBe('2'.repeat(64))
    expect(d.mutated[0].actual).toBe('1'.repeat(64))
  })
})

describe('computeDrift: ghost rows', () => {
  test('applied row with no file on disk is a GHOST', () => {
    const files = [{ version: '001_a', checksum: 'a'.repeat(64) }]
    const applied = [
      { version: '001_a', checksum: 'a'.repeat(64) },
      { version: '999_deleted_migration', checksum: 'z'.repeat(64) },
    ]
    const d = drift(files, applied)
    expect(d.ok).toBe(false)
    expect(d.ghost).toEqual(['999_deleted_migration'])
  })
})

describe('collectFileMigrations: file discovery + checksums', () => {
  test('discovers .sql files sorted, versions = filename minus .sql, checksums are sha256 of content', async () => {
    const driver = `
      const m = await import(${JSON.stringify(path.join(ROOT, 'scripts', 'verify-migrations.mjs'))});
      const fs = await import('node:fs');
      const os = await import('node:os');
      const path = await import('node:path');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-mig-'));
      fs.writeFileSync(path.join(dir, '002_b.sql'), 'SELECT 2;');
      fs.writeFileSync(path.join(dir, '001_a.sql'), 'SELECT 1;');
      fs.writeFileSync(path.join(dir, 'ignored.txt'), 'not a migration');
      const out = m.collectFileMigrations(dir);
      fs.rmSync(dir, { recursive: true, force: true });
      process.stdout.write(JSON.stringify(out));
    `
    const output = execFileSync(
      'node',
      ['--input-type=module', '-e', driver],
      { encoding: 'utf8', cwd: ROOT }
    )
    const files = JSON.parse(output.trim().split('\n').pop() as string)
    expect(files.map((f: { version: string }) => f.version)).toEqual(['001_a', '002_b'])
    // sha256('SELECT 1;') — the known digest proves the checksum pipeline
    expect(files[0].checksum).toBe(
      '17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a'
    )
    expect(files[1].checksum).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verify-migrations CLI (subprocess, fail-closed wiring)', () => {
  test('exits 2 with usage error when DATABASE_URL is unset (never silently passes)', () => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    let code = 0
    let output = ''
    try {
      output = execFileSync('node', [path.join(ROOT, 'scripts', 'verify-migrations.mjs')], {
        encoding: 'utf8',
        env,
        cwd: ROOT,
      })
    } catch (err: any) {
      code = err.status ?? 1
      output = String(err.stdout ?? '') + String(err.stderr ?? '')
    }
    expect(code).not.toBe(0)
    expect(output).toContain('DATABASE_URL')
    expect(output).toContain('fail closed')
  })
})
