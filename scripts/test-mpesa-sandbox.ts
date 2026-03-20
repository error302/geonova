/**
 * M-Pesa Sandbox End-to-End Test
 * 
 * Tests the full payment flow:
 * 1. Initiate STK Push to sandbox phone number
 * 2. Wait for callback from Safaricom simulator
 * 3. Verify subscription was activated in database
 * 
 * Prerequisites:
 *   - Safaricom Developer Portal account (developer.safaricom.co.ke)
 *   - Sandbox credentials set in .env.local
 *   - App running locally on port 3000 (for callback)
 *   OR ngrok tunnel: ngrok http 3000
 * 
 * Env vars required:
 *   MPESA_CONSUMER_KEY        (from Daraja portal)
 *   MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE           (sandbox: 174379)
 *   MPESA_PASSKEY             (from Daraja portal)
 *   MPESA_CALLBACK_URL        (your ngrok URL + /api/payments/mpesa/callback)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (to check subscription after payment)
 * 
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-mpesa-sandbox.ts
 */

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke'
const TEST_PHONE = '254708374149' // Safaricom sandbox test number
const TEST_AMOUNT = 1 // Minimum amount for sandbox test

async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!
  const secret = process.env.MPESA_CONSUMER_SECRET!
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64')
  
  const res = await fetch(`${SANDBOX_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  })
  const data = await res.json() as any
  if (!data.access_token) throw new Error(`Token fetch failed: ${JSON.stringify(data)}`)
  console.log('✅ Access token obtained')
  return data.access_token
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
}

function getPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}

async function initiateStkPush(token: string, userId: string): Promise<string> {
  const shortcode = process.env.MPESA_SHORTCODE || '174379'
  const passkey = process.env.MPESA_PASSKEY!
  const callbackUrl = process.env.MPESA_CALLBACK_URL!
  const timestamp = getTimestamp()
  const password = getPassword(shortcode, passkey, timestamp)

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: TEST_AMOUNT,
    PartyA: TEST_PHONE,
    PartyB: shortcode,
    PhoneNumber: TEST_PHONE,
    CallBackURL: callbackUrl,
    AccountReference: `GEONOVA-${userId.slice(0, 8)}`,
    TransactionDesc: 'GeoNova Pro Monthly',
  }

  const res = await fetch(`${SANDBOX_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json() as any
  
  if (data.ResponseCode !== '0') {
    throw new Error(`STK Push failed: ${JSON.stringify(data)}`)
  }
  
  console.log('✅ STK Push initiated')
  console.log(`   CheckoutRequestID: ${data.CheckoutRequestID}`)
  console.log(`   MerchantRequestID: ${data.MerchantRequestID}`)
  console.log('   📱 Sandbox will auto-process (no real phone needed)')
  return data.CheckoutRequestID
}

async function queryStkStatus(token: string, checkoutId: string): Promise<any> {
  const shortcode = process.env.MPESA_SHORTCODE || '174379'
  const passkey = process.env.MPESA_PASSKEY!
  const timestamp = getTimestamp()
  const password = getPassword(shortcode, passkey, timestamp)

  const res = await fetch(`${SANDBOX_BASE}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutId,
    }),
  })
  return res.json()
}

async function checkSubscription(userId: string): Promise<boolean> {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await admin
    .from('user_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()
  
  console.log(`   Subscription: ${JSON.stringify(data)}`)
  return data?.plan === 'pro' && data?.status === 'active'
}

async function run() {
  console.log('══════════════════════════════════════')
  console.log('M-PESA SANDBOX END-TO-END TEST')
  console.log('══════════════════════════════════════\n')

  const required = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL']
  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`❌ Missing env vars: ${missing.join(', ')}`)
    console.error('\nGet these from developer.safaricom.co.ke:')
    console.error('1. Create app → get Consumer Key + Secret')
    console.error('2. Go to APIs → Lipa Na M-Pesa → Simulate → get Passkey')
    console.error('3. Set MPESA_CALLBACK_URL to your ngrok URL + /api/payments/mpesa/callback')
    process.exit(1)
  }

  const testUserId = process.env.TEST_USER_A_ID || 'sandbox-test-user'
  
  try {
    // Step 1: Get OAuth token
    console.log('Step 1: Getting OAuth token...')
    const token = await getAccessToken()

    // Step 2: Initiate STK push
    console.log('\nStep 2: Initiating STK Push...')
    const checkoutId = await initiateStkPush(token, testUserId)

    // Step 3: Wait and query status
    console.log('\nStep 3: Querying payment status (sandbox auto-processes)...')
    await new Promise(r => setTimeout(r, 3000))
    const status = await queryStkStatus(token, checkoutId)
    console.log(`   Status response: ${JSON.stringify(status)}`)

    // Step 4: Check if callback was received by our server
    console.log('\nStep 4: Checking callback receipt...')
    console.log('   ⚠️  Callback verification requires your server to be running')
    console.log('   Check your server logs for: POST /api/payments/mpesa/callback')
    
    // Step 5: Check subscription in DB (if server processed it)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('\nStep 5: Checking subscription activation in DB...')
      const isActive = await checkSubscription(testUserId)
      if (isActive) console.log('✅ Subscription activated successfully')
      else console.log('⚠️  Subscription not yet activated — check callback URL and server logs')
    }

    console.log('\n══════════════════════════════════════')
    console.log('SANDBOX TEST COMPLETE')
    console.log('══════════════════════════════════════')
    console.log('Next steps:')
    console.log('1. Verify callback was received in server logs')
    console.log('2. Check Supabase → user_subscriptions table')
    console.log('3. If callback failed: confirm MPESA_CALLBACK_URL is reachable externally')
    console.log('4. Run with a real test account in production environment')

  } catch (err: any) {
    console.error(`\n❌ Test failed: ${err.message}`)
    process.exit(1)
  }
}

run()
