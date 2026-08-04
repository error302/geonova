/**
 * VULN-001 re-verification proof (post-fix)
 *
 * Re-runs the exact attack from the security review (2026-08-03):
 *   POST /api/db  { table:'benchmarks', operation:'select',
 *                   columns:'id" FROM users; DROP TABLE projects; --' }
 *
 * Before the fix this generated:
 *   SELECT "id" FROM users; DROP TABLE projects; --" FROM "public_beacons"
 *   (empty params → pg simple query protocol → multi-statement execution)
 *
 * After the fix, every select column must pass validateIdentifier() and
 * limit/offset must be non-negative integers. The proof asserts that
 * pool.query() is NEVER called for any attack payload.
 *
 * VULN-002 extension (upsert path hardening, 2026-08-03): executeUpsert()
 * now validates every payload column key through validateIdentifier() (it was
 * only validated in insert()/update() before), and the onConflict column is
 * validated synchronously at the upsert() setter. Two new attack payloads
 * prove both paths are blocked end-to-end:
 *   - column-key breakout:   { 'id" = "1" OR "owner_id': ... } → must throw
 *     inside executeUpsert and return { data:null, error } with ZERO SQL.
 *   - onConflict breakout:   upsert(..., { onConflict:'id; DROP TABLE ...' })
 *     → must throw synchronously at the setter, before any promise exists.
 */
import { QueryBuilder } from '../src/lib/db/queryBuilder'

let sqlCalls = 0
const sqlLog: string[] = []

const fakePool = {
  query: async (sql: string, _params: unknown[] = []) => {
    sqlCalls++
    sqlLog.push(sql)
    return { rows: [], rowCount: 0 }
  },
}

function tryAttack(name: string, build: () => Promise<unknown>) {
  const before = sqlCalls
  // limit()/range()/upsert(onConflict) validate synchronously at the setter,
  // so `build` itself can throw before any promise exists — catch that too.
  let promise: Promise<unknown>
  try {
    promise = Promise.resolve(build())
  } catch (err: unknown) {
    console.log(`\n[BLOCKED] ${name} (threw at setter)`)
    console.log(`  error: ${err instanceof Error ? err.message : String(err)}`)
    console.log('  SQL executed: none — injection blocked ✓')
    return Promise.resolve(true)
  }
  return promise.then(
    (result) => {
      const err = (result as { error?: { message?: string } | null })?.error
      const executed = sqlCalls - before
      console.log(`\n[${executed > 0 ? 'FAIL' : 'BLOCKED'}] ${name}`)
      if (err) console.log(`  error: ${err.message}`)
      if (executed === 0) console.log('  SQL executed: none — injection blocked ✓')
      else console.log(`  WARNING: ${executed} SQL statement(s) executed ✗`)
      return executed === 0
    },
    (err: unknown) => {
      const executed = sqlCalls - before
      console.log(`\n[${executed > 0 ? 'FAIL' : 'BLOCKED'}] ${name} (rejected)`)
      console.log(`  error: ${err instanceof Error ? err.message : String(err)}`)
      if (executed === 0) console.log('  SQL executed: none — injection blocked ✓')
      return executed === 0
    }
  )
}

async function main() {
  const results: boolean[] = []

  // 1. Original proof payload — column breakout (unauthenticated public table)
  results.push(await tryAttack(
    'Attack 1: columns="id" FROM users; DROP TABLE projects; --" (original VULN-001 payload)',
    () => new QueryBuilder(fakePool as never, 'benchmarks')
      .select('id" FROM users; DROP TABLE projects; --')
  ))

  // 2. Semicolon + comment breakout on first column
  results.push(await tryAttack(
    'Attack 2: columns="id; DROP TABLE users; --"',
    () => new QueryBuilder(fakePool as never, 'benchmarks').select('id; DROP TABLE users; --')
  ))

  // 3. Alias breakout
  results.push(await tryAttack(
    'Attack 3: columns="id, name AS \\"x; DROP TABLE projects; --\\""',
    () => new QueryBuilder(fakePool as never, 'benchmarks')
      .select('id, name AS "x; DROP TABLE projects; --"')
  ))

  // 4. Function-expression breakout
  results.push(await tryAttack(
    'Attack 4: columns="count(*) as c; DROP TABLE users; --"',
    () => new QueryBuilder(fakePool as never, 'benchmarks').select('count(*) as c; DROP TABLE users; --')
  ))

  // 5. LIMIT injection
  results.push(await tryAttack(
    'Attack 5: limit="1; DROP TABLE users"',
    () => new QueryBuilder(fakePool as never, 'benchmarks').select('id').limit('1; DROP TABLE users' as unknown as number)
  ))

  // 6. OFFSET injection
  results.push(await tryAttack(
    'Attack 6: range(from="0; DROP TABLE users", to=50)',
    () => new QueryBuilder(fakePool as never, 'benchmarks').select('id').range('0; DROP TABLE users' as unknown as number, 50)
  ))

  // ── VULN-002 extension: upsert path ──────────────────────────────────────

  // 7. Upsert column-key breakout. The key would previously break out of the
  // quoted identifier in BOTH the column list and the EXCLUDED.* update set:
  //   INSERT INTO "projects" ("id" = "1" OR "owner_id", ...) ... ON CONFLICT
  //   ("id") DO UPDATE SET "id" = "1" OR "owner_id" = EXCLUDED."id" ...
  results.push(await tryAttack(
    'Attack 7: upsert column key = \'id" = "1" OR "owner_id\' (VULN-002)',
    () => new QueryBuilder(fakePool as never, 'projects').upsert(
      { 'id" = "1" OR "owner_id': 1, name: 'x' } as Record<string, unknown>,
      { onConflict: 'id' }
    )
  ))

  // 8. Upsert onConflict breakout — validated synchronously at the setter,
  // so it must throw before any SQL can be built or executed.
  results.push(await tryAttack(
    'Attack 8: upsert onConflict = "id; DROP TABLE projects; --" (VULN-002)',
    () => new QueryBuilder(fakePool as never, 'projects').upsert(
      { id: 1, name: 'x' },
      { onConflict: 'id; DROP TABLE projects; --' }
    )
  ))

  // 9. Multi-row upsert where a LATER row smuggles a malicious key. Columns
  // are pinned + validated from the FIRST row only, so the injected key never
  // reaches SQL — it is silently dropped. Assert that: the upsert succeeds
  // (clean SQL, params-bound values) AND the malicious key text is absent
  // from the emitted SQL.
  {
    const before = sqlCalls
    const multiResult = await new QueryBuilder(fakePool as never, 'projects').upsert(
      [
        { id: 1, name: 'a' },
        { id: 2, name: 'b', 'id" = "1" OR "owner_id': 1 } as Record<string, unknown>,
      ],
      { onConflict: 'id' }
    )
    const executed = sqlCalls - before
    const injectedKey = 'id" = "1" OR "owner_id'
    const leaked = sqlLog.some((s) => s.includes(injectedKey))
    const wellFormed = multiResult.error === null && executed === 1 &&
      sqlLog[sqlLog.length - 1]?.includes('VALUES ($1, $2), ($3, $4)') &&
      sqlLog[sqlLog.length - 1]?.includes('ON CONFLICT ("id")')
    console.log(`\n[${wellFormed && !leaked ? 'BLOCKED' : 'FAIL'}] Attack 9: multi-row upsert with injected key in second row (VULN-002)`)
    if (leaked) console.log('  FAIL: malicious key text found in emitted SQL ✗')
    else if (wellFormed) console.log('  SQL executed: 1 (clean, params-bound) — injected key dropped, never reaches SQL ✓')
    else console.log('  WARNING: unexpected result — see sqlLog above')
    if (!wellFormed) console.log('  last SQL:', sqlLog[sqlLog.length - 1])
    results.push(wellFormed && !leaked)
  }

  // 10. Sanity: a legitimate query still works
  const legit = await new QueryBuilder(fakePool as never, 'benchmarks')
    .select('id, name as label').limit(10).range(20, 29)
  const legitOk = sqlCalls > 0 && !legit.error
  console.log(`\n[${legitOk ? 'OK' : 'FAIL'}] Sanity: legit select("id, name as label").limit(10).range(20,29)`)
  console.log(`  SQL statements executed: ${sqlCalls}`)
  results.push(legitOk)

  // 11. Sanity: a legitimate upsert still emits the ON CONFLICT upsert SQL
  const legitUpsert = await new QueryBuilder(fakePool as never, 'projects').upsert(
    { id: 7, name: 'Test' },
    { onConflict: 'id' }
  )
  const legitUpsertOk = sqlCalls > 0 && !legitUpsert.error
  console.log(`\n[${legitUpsertOk ? 'OK' : 'FAIL'}] Sanity: legit upsert({id, name}, { onConflict: "id" })`)
  console.log(`  SQL statements executed: ${sqlCalls}`)
  results.push(legitUpsertOk)

  const attackResults = results.slice(0, -2) // everything except the two sanity checks
  const allBlocked = attackResults.every(Boolean) && legitOk && legitUpsertOk
  console.log(`\n========================================`)
  console.log(allBlocked ? 'RESULT: ALL 9 ATTACKS BLOCKED ✓ — VULN-001 + VULN-002 FIXED' : 'RESULT: FAILURE — some attack still reaches SQL')
  console.log('========================================')
  process.exit(allBlocked ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
