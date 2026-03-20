#!/usr/bin/env npx ts-node
/**
 * Creates two test users for RLS isolation testing.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx ts-node scripts/seed-test-users.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function seedUser(email: string, password: string) {
  // Check if already exists
  const { data: list } = await admin.auth.admin.listUsers()
  const existing = list?.users?.find(u => u.email === email)
  if (existing) {
    console.log(`  ✓ ${email} already exists`)
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.error(`  ✗ Failed to create ${email}: ${error.message}`)
    return
  }
  console.log(`  ✓ Created ${email} (${data.user.id.slice(0, 8)}...)`)
}

async function run() {
  console.log('\n🌱 Seeding RLS test users\n')
  await seedUser('user_a_rls_test@geonova.test', 'RlsTest123!')
  await seedUser('user_b_rls_test@geonova.test', 'RlsTest123!')
  console.log('\nDone. Now run: npm run test:rls\n')
}

run().catch(console.error)
