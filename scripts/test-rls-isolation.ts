#!/usr/bin/env npx ts-node
/**
 * RLS Isolation Test
 * 
 * Verifies that user A cannot read user B's data.
 * Run after creating two test accounts in your Supabase project.
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   USER_A_EMAIL=a@test.com USER_A_PASS=pass123 \
 *   USER_B_EMAIL=b@test.com USER_B_PASS=pass123 \
 *   npx ts-node scripts/test-rls-isolation.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars')
  process.exit(1)
}

const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

type TestResult = { test: string; pass: boolean; detail?: string }
const results: TestResult[] = []

function pass(test: string, detail?: string) {
  results.push({ test, pass: true, detail })
  console.log(`  ✓ ${test}${detail ? ` — ${detail}` : ''}`)
}

function fail(test: string, detail?: string) {
  results.push({ test, pass: false, detail })
  console.error(`  ✗ FAIL: ${test}${detail ? ` — ${detail}` : ''}`)
}

async function signIn(client: ReturnType<typeof createClient>, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return data.user!
}

async function runTests() {
  const emailA = process.env.USER_A_EMAIL || 'user_a_rls_test@geonova.test'
  const passA  = process.env.USER_A_PASS  || 'RlsTest123!'
  const emailB = process.env.USER_B_EMAIL || 'user_b_rls_test@geonova.test'
  const passB  = process.env.USER_B_PASS  || 'RlsTest123!'

  console.log('\n🔒 GeoNova RLS Isolation Tests\n')

  // ── Auth ──────────────────────────────────────────────────────────────────
  console.log('── Authentication ──')
  let userA: any, userB: any
  try {
    userA = await signIn(clientA, emailA, passA)
    pass('User A signed in', userA.id.slice(0, 8) + '...')
  } catch (e: any) {
    fail('User A sign-in', e.message)
    console.error('\nCreate test accounts first with: npm run seed:test-users')
    process.exit(1)
  }

  try {
    userB = await signIn(clientB, emailB, passB)
    pass('User B signed in', userB.id.slice(0, 8) + '...')
  } catch (e: any) {
    fail('User B sign-in', e.message)
    process.exit(1)
  }

  // ── User A creates a project ───────────────────────────────────────────────
  console.log('\n── Project isolation ──')
  const { data: projectA, error: projErr } = await clientA
    .from('projects')
    .insert({ name: 'RLS Test Project A', user_id: userA.id, location: 'Test' })
    .select('id')
    .single()

  if (projErr || !projectA) {
    fail('User A can create project', projErr?.message)
    process.exit(1)
  }
  pass('User A created project', projectA.id.slice(0, 8) + '...')

  // ── User B cannot see User A's project ────────────────────────────────────
  const { data: bSeesA } = await clientB
    .from('projects')
    .select('id')
    .eq('id', projectA.id)
    .single()

  if (bSeesA) {
    fail('User B CANNOT read User A project', 'DATA LEAK — B read A\'s project ID')
  } else {
    pass('User B cannot read User A project')
  }

  // ── User B cannot insert into User A's project ────────────────────────────
  const { error: insertErr } = await clientB
    .from('survey_points')
    .insert({ project_id: projectA.id, name: 'INJECTED', easting: 0, northing: 0, elevation: 0 })

  if (!insertErr) {
    fail('User B CANNOT inject points into User A project', 'DATA INJECTION POSSIBLE')
  } else {
    pass('User B cannot inject survey points into User A project')
  }

  // ── User B cannot read User A's survey points ────────────────────────────
  const { data: bSeesPoints } = await clientB
    .from('survey_points')
    .select('id')
    .eq('project_id', projectA.id)

  if (bSeesPoints && bSeesPoints.length > 0) {
    fail('User B CANNOT read User A survey points', `Saw ${bSeesPoints.length} points`)
  } else {
    pass('User B cannot read User A survey points')
  }

  // ── Subscription isolation ────────────────────────────────────────────────
  console.log('\n── Subscription isolation ──')
  const { data: bSeesSubs } = await clientB
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userA.id)

  if (bSeesSubs && bSeesSubs.length > 0) {
    fail('User B CANNOT read User A subscription', 'BILLING DATA LEAK')
  } else {
    pass('User B cannot read User A subscription')
  }

  // ── Fieldbook isolation ───────────────────────────────────────────────────
  console.log('\n── Fieldbook isolation ──')
  const { data: fbA } = await clientA
    .from('fieldbooks')
    .select('id')
    .eq('user_id', userA.id)
    .limit(1)
    .maybeSingle()

  if (fbA) {
    const { data: bSeesFb } = await clientB
      .from('fieldbooks')
      .select('id')
      .eq('id', fbA.id)
      .maybeSingle()

    if (bSeesFb) {
      fail('User B CANNOT read User A fieldbook', 'FIELDBOOK DATA LEAK')
    } else {
      pass('User B cannot read User A fieldbook')
    }
  } else {
    pass('Fieldbook isolation (no fieldbooks to test — create one to verify)')
  }

  // ── User A can still read own data ───────────────────────────────────────
  console.log('\n── Self-access (must work) ──')
  const { data: aSeesOwn } = await clientA
    .from('projects')
    .select('id')
    .eq('id', projectA.id)
    .single()

  if (aSeesOwn) {
    pass('User A can read own project')
  } else {
    fail('User A CANNOT read own project', 'RLS too restrictive — broken!')
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await clientA.from('projects').delete().eq('id', projectA.id)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Summary ──')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n  ${passed} passed, ${failed} failed\n`)

  if (failed > 0) {
    console.error('❌ RLS FAILURES DETECTED — fix before going to production\n')
    process.exit(1)
  } else {
    console.log('✅ All RLS isolation tests passed\n')
    process.exit(0)
  }
}

runTests().catch(e => {
  console.error('Unexpected error:', e)
  process.exit(1)
})
