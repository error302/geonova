#!/usr/bin/env node
/**
 * ensure-supabase-roles.mjs — create the Supabase-style roles the migration
 * chain assumes.
 *
 * The RLS migrations grant `TO authenticated` (15 grants across 044-046 etc.),
 * but a plain Postgres (or the CI postgis service container) has no such role,
 * so 044_boundary_monuments.sql fails with `role "authenticated" does not
 * exist`. This creates the roles the chain references. Idempotent — safe to
 * run on any Postgres, including production (roles already exist → no-op).
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/ensure-supabase-roles.mjs
 */
import { Pool } from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const ROLES = ['authenticated', 'anon', 'service_role']

const pool = new Pool({ connectionString: url })
try {
  for (const role of ROLES) {
    await pool.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
           CREATE ROLE ${role} NOLOGIN;
         END IF;
       END $$`
    )
    console.log(`role ${role}: ensured`)
  }
} finally {
  await pool.end()
}
