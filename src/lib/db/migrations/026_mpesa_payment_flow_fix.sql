-- Migration 026: Fix M-Pesa payment flow (audit C4)
-- Date: 2026-07-02
--
-- CONTEXT
--   The M-Pesa payment flow had multiple bugs (audit finding C4):
--   1. initiate/route.ts inserted into payment_intents with columns
--      (amount_kes, purpose, reference_id) that don't exist
--   2. callback/route.ts read from payment_history (different table)
--   3. callback/route.ts tried to UPDATE transaction_id column that
--      doesn't exist in payment_history
--   4. Neither table had plan_id, but callback validated planId param
--   5. Callback URL didn't include paymentId/planId query params
--   6. Amount verification compared expected vs expected (not vs actual)
--
-- This migration:
--   - Adds plan_id to payment_intents (the canonical payment table)
--   - Adds transaction_id to payment_history (for the receipt number)
--   - Adds provider_ref index for fast callback lookup by CheckoutRequestID
--
-- The route fixes (initiate + callback) ship in the same commit.

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS plan_id VARCHAR(30) DEFAULT 'free';

ALTER TABLE payment_history
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payment_intents_checkout_request_id
  ON payment_intents(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_plan
  ON payment_intents(user_id, plan_id, status)
  WHERE status IN ('pending', 'processing');
