# GeoNova Testing Guide

## Unit Tests (Engine)

```bash
npm test                          # run all 214 tests
npm test -- --coverage            # with coverage report
npm test -- --watch               # watch mode during development
```

Coverage targets: statements 80%, functions 80%, lines 80%, branches 55%

---

## RLS Isolation Tests

Verifies that Supabase Row Level Security correctly prevents one user
from accessing another user's data.

### Setup
1. Create two test accounts in your Supabase project (or use existing ones)
2. Add to `.env.local`:
```
TEST_USER_A_EMAIL=testuser_a@example.com
TEST_USER_A_PASSWORD=TestPass123!
TEST_USER_B_EMAIL=testuser_b@example.com
TEST_USER_B_PASSWORD=TestPass123!
```

### Run
```bash
npx ts-node --project tsconfig.scripts.json scripts/test-rls-isolation.ts
```

### What it tests
- User B cannot read User A's projects
- User B cannot update User A's projects  
- User B cannot delete User A's projects
- User B cannot read User A's survey points
- User B cannot read User A's fieldbooks
- User B cannot read User A's subscription

Expected output: `8/8 tests passed — data is properly isolated`

---

## M-Pesa Sandbox Test

End-to-end test of the payment flow from STK Push to subscription activation.

### Prerequisites
1. Account at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an app → get Consumer Key + Consumer Secret
3. Go to APIs → Lipa Na M-Pesa Sandbox → get Passkey
4. Run ngrok to expose your local server: `ngrok http 3000`

### Setup
Add to `.env.local`:
```
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://YOUR_NGROK_URL/api/payments/mpesa/callback
```

### Run
```bash
# Terminal 1: Start the app
npm run dev

# Terminal 2: Start ngrok  
ngrok http 3000

# Terminal 3: Run the test (update MPESA_CALLBACK_URL with ngrok URL first)
npx ts-node --project tsconfig.scripts.json scripts/test-mpesa-sandbox.ts
```

### What it tests
1. OAuth token generation with Daraja API
2. STK Push initiation (CheckoutRequestID returned)
3. Payment status query
4. Callback receipt at `/api/payments/mpesa/callback`
5. Subscription activation in Supabase

### Expected outcome
- STK Push returns `ResponseCode: 0`
- Server logs show `POST /api/payments/mpesa/callback 200`
- `user_subscriptions` table shows `plan: pro, status: active`

---

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push:
- TypeScript type check
- Lint
- Unit tests (214 tests)
- Next.js build

To push the workflow file (requires `workflow` scope on GitHub token):
```bash
# Generate a new token at github.com/settings/tokens with repo + workflow scope
git push https://TOKEN@github.com/error302/geonova.git main
```
