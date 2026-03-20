/**
 * GeoNova RLS Isolation Test
 * 
 * Verifies that Supabase Row Level Security policies correctly prevent
 * one user from reading, writing, or deleting another user's data.
 * 
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-rls-isolation.ts
 * 
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_USER_A_EMAIL + TEST_USER_A_PASSWORD (existing test accounts)
 *   TEST_USER_B_EMAIL + TEST_USER_B_PASSWORD
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type TestResult = { name: string; passed: boolean; detail: string }
const results: TestResult[] = []

function pass(name: string, detail = '') { results.push({ name, passed: true, detail }) }
function fail(name: string, detail = '') { results.push({ name, passed: false, detail }) }

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(`Sign-in failed for ${email}: ${error?.message}`)
  return client
}

async function runTests() {
  const emailA = process.env.TEST_USER_A_EMAIL!
  const passA = process.env.TEST_USER_A_PASSWORD!
  const emailB = process.env.TEST_USER_B_EMAIL!
  const passB = process.env.TEST_USER_B_PASSWORD!

  if (!emailA || !passA || !emailB || !passB) {
    console.error('❌ Missing TEST_USER_A/B env vars. Create two test Supabase accounts first.')
    process.exit(1)
  }

  console.log('Signing in as User A and User B...')
  const clientA = await signIn(emailA, passA)
  const clientB = await signIn(emailB, passB)
  const { data: { user: userA } } = await clientA.auth.getUser()
  const { data: { user: userB } } = await clientB.auth.getUser()
  console.log(`User A: ${userA?.id?.slice(0, 8)}...`)
  console.log(`User B: ${userB?.id?.slice(0, 8)}...`)

  // ── PROJECTS ────────────────────────────────────────────────────────────────
  console.log('\n── Projects ──')

  // User A creates a project
  const { data: projA, error: e1 } = await clientA.from('projects').insert({
    name: 'RLS Test Project A',
    location: 'Test',
    utm_zone: 37,
    hemisphere: 'S',
    user_id: userA!.id,
  }).select().single()
  if (!projA || e1) { fail('A creates project', e1?.message); }
  else pass('A creates project', projA.id)

  if (projA) {
    // User B tries to read User A's project by ID
    const { data: stolen } = await clientB.from('projects').select('*').eq('id', projA.id).single()
    if (stolen) fail('B cannot read A\'s project', `Got: ${JSON.stringify(stolen).slice(0, 80)}`)
    else pass('B cannot read A\'s project')

    // User B tries to list all projects (should only see their own)
    const { data: bProjects } = await clientB.from('projects').select('id')
    const leaks = (bProjects || []).filter((p: any) => p.id === projA.id)
    if (leaks.length > 0) fail('B\'s project list doesn\'t contain A\'s project', 'LEAKED')
    else pass('B\'s project list doesn\'t contain A\'s project')

    // User B tries to update User A's project
    const { error: updateErr } = await clientB.from('projects').update({ name: 'HACKED' }).eq('id', projA.id)
    if (!updateErr) {
      // Check if it actually changed
      const { data: check } = await clientA.from('projects').select('name').eq('id', projA.id).single()
      if (check?.name === 'HACKED') fail('B cannot update A\'s project', 'Name was changed!')
      else pass('B cannot update A\'s project', 'Update silently ignored by RLS')
    } else pass('B cannot update A\'s project', updateErr.message)

    // User B tries to delete User A's project
    const { error: deleteErr } = await clientB.from('projects').delete().eq('id', projA.id)
    const { data: stillExists } = await clientA.from('projects').select('id').eq('id', projA.id).single()
    if (stillExists) pass('B cannot delete A\'s project')
    else fail('B cannot delete A\'s project', 'Project was deleted!')

    // ── SURVEY POINTS ──────────────────────────────────────────────────────────
    console.log('\n── Survey points ──')
    const { data: pointA } = await clientA.from('survey_points').insert({
      project_id: projA.id,
      name: 'RLS_PT_1',
      easting: 500000,
      northing: 9800000,
      elevation: 1700,
    }).select().single()

    if (pointA) {
      const { data: stolenPt } = await clientB.from('survey_points').select('*').eq('id', pointA.id).single()
      if (stolenPt) fail('B cannot read A\'s survey points', 'Point leaked')
      else pass('B cannot read A\'s survey points')
    }

    // ── FIELDBOOKS ─────────────────────────────────────────────────────────────
    console.log('\n── Fieldbooks ──')
    const { data: fbA } = await clientA.from('fieldbooks').insert({
      user_id: userA!.id,
      project_id: projA.id,
      name: 'RLS Test Fieldbook',
      type: 'leveling',
      data: {},
    }).select().single()

    if (fbA) {
      const { data: stolenFb } = await clientB.from('fieldbooks').select('*').eq('id', fbA.id).single()
      if (stolenFb) fail('B cannot read A\'s fieldbook', 'Fieldbook leaked')
      else pass('B cannot read A\'s fieldbook')
    }

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
    console.log('\n── Subscriptions ──')
    const { data: subA } = await clientA.from('user_subscriptions').select('*').eq('user_id', userA!.id)
    const { data: subAviaBuQuery } = await clientB.from('user_subscriptions').select('*').eq('user_id', userA!.id)
    if (subAviaBuQuery && subAviaBuQuery.length > 0) fail('B cannot read A\'s subscription', 'Subscription leaked')
    else pass('B cannot read A\'s subscription')

    // Cleanup — User A deletes their own test data
    if (fbA) await clientA.from('fieldbooks').delete().eq('id', fbA.id)
    if (pointA) await clientA.from('survey_points').delete().eq('id', pointA.id)
    await clientA.from('projects').delete().eq('id', projA.id)
    console.log('\n✓ Test data cleaned up')
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════')
  console.log('RLS ISOLATION TEST RESULTS')
  console.log('══════════════════════════════')
  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  })
  console.log(`\n${passed.length}/${results.length} tests passed`)
  if (failed.length > 0) {
    console.error('\n⚠️  SECURITY ISSUES FOUND — fix RLS policies before launch')
    process.exit(1)
  } else {
    console.log('\n✅ All RLS isolation checks passed — data is properly isolated')
  }
}

runTests().catch(err => { console.error('Test runner error:', err); process.exit(1) })
