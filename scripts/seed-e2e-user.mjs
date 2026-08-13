#!/usr/bin/env node
/**
 * Seed the fixed E2E test user that the minted-session specs (project-crud,
 * fieldbook) authenticate as.
 *
 * Those specs craft a NextAuth JWT cookie with a fixed `id`; the DB-backed
 * routes (e.g. GET /api/activity → `WHERE user_id = $1::uuid`) only work when
 * a real users row carries that UUID. Without it, the empty/absent user id
 * produced `invalid input syntax for type uuid: ""` and shard 2/4 hung until
 * the 30-minute job timeout.
 *
 * Idempotent — safe to run on every shard (each runner has its own Postgres
 * container) and against a re-used database.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/seed-e2e-user.mjs
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const E2E_USER_ID = '00000000-0000-0000-0000-000000000001'
const E2E_EMAIL = 'test@metardu.test'

// E2E_SEED_GUARD (2026-08-12): `--verify` checks the seeded row actually
// landed and exits non-zero otherwise — wired into CI as a fast-fail step
// before the E2E shards run (a silent seed regression re-introduces the
// shard-2/4 "invalid input syntax for type uuid: \"\"" hang that used to
// burn the full 30-min job timeout).
const VERIFY_ONLY = process.argv.includes('--verify')

const client = new Client({ connectionString: DATABASE_URL })
await client.connect()
try {
  if (VERIFY_ONLY) {
    const res = await client.query(
      'SELECT id, email FROM users WHERE id = $1 AND email = $2',
      [E2E_USER_ID, E2E_EMAIL],
    )
    if ((res.rowCount ?? 0) !== 1) {
      console.error(
        `[seed-e2e-user] VERIFY FAILED — E2E seed user row missing ` +
          `(users.id=${E2E_USER_ID}, email=${E2E_EMAIL}). Without it the ` +
          `minted-session specs (project-crud, fieldbook) hit the "invalid ` +
          `input syntax for type uuid" error and the shard hangs until the ` +
          `job timeout. Run without --verify to (re)seed, or fix ` +
          `scripts/seed-e2e-user.mjs.`,
      )
      process.exitCode = 1
    } else {
      console.log(
        `[seed-e2e-user] verified ${E2E_EMAIL} (${E2E_USER_ID}) — row present`,
      )
    }
    // E2E_SEED_ID_DRIFT (2026-08-13): also assert the minted-session specs
    // embed the SAME fixed id. The row-exists check above proves the users
    // row landed, but an id drift between the seed and the cookie specs
    // (specs minting a different UUID) would pass it yet still hang shard
    // 2/4 with "invalid input syntax for type uuid". Static check — no DB.
    for (const specFile of ['e2e/project-crud.spec.ts', 'e2e/fieldbook.spec.ts']) {
      const spec = readFileSync(specFile, 'utf8')
      if (!spec.includes(E2E_USER_ID)) {
        console.error(
          `[seed-e2e-user] VERIFY FAILED — ${specFile} does not embed the seeded id ${E2E_USER_ID}. Id drift between seed and minted-session specs would re-introduce the shard-2/4 hang. Align scripts/seed-e2e-user.mjs with the spec cookie ids.`,
        )
        process.exitCode = 1
      }
    }
  } else {
    const res = await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'Test Surveyor', 'surveyor', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email, updated_at = NOW()`,
      [E2E_USER_ID, E2E_EMAIL, 'e2e-dummy-password-hash-never-used-for-login'],
    )
    console.log(
      `[seed-e2e-user] ensured ${E2E_EMAIL} (${E2E_USER_ID}) — %s row(s)`,
      res.rowCount ?? 0,
    )
  }
} finally {
  await client.end()
}
