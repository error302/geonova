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
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const E2E_USER_ID = '00000000-0000-0000-0000-000000000001'
const E2E_EMAIL = 'test@metardu.test'

const client = new Client({ connectionString: DATABASE_URL })
await client.connect()
try {
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
} finally {
  await client.end()
}
