-- Migration 055: payment_history provider_id unique index
--
-- SECURITY/FIX (audit H-01, 2026-08-30): the M-Pesa STK callback inserts into
-- payment_history with `ON CONFLICT (provider_id) DO NOTHING`, but no unique
-- constraint on provider_id existed in any prior migration. Postgres raised
-- error 42P10 ("there is no unique or exclusion constraint matching the ON
-- CONFLICT specification") at runtime, the route returned a 500 to Safaricom
-- mid-callback, and the subscription-activation step never executed — paying
-- customers never received their plan.
--
-- A partial unique index keeps NULL provider_ids (manual/legacy rows)
-- unconstrained while enforcing idempotency per provider transaction.
--
-- DEDUPE FIRST (2026-08-30): every legacy Till payment row was inserted with
-- the shared sentinel provider_id 'TILL_3370347', so a naive unique index
-- would fail on existing production data. Legacy duplicates (everything but
-- the newest row per provider_id) keep their audit trail but lose the
-- provider_id claim, since that value was a sentinel, not a real provider
-- transaction reference.
-- NOTE: a plain CREATE INDEX is used because the unified migration runner
-- wraps each file in a transaction (CONCURRENTLY is not allowed there);
-- payment_history is small, so the brief lock is acceptable.

UPDATE payment_history ph
   SET provider_id = NULL
  WHERE provider_id IS NOT NULL
    AND id NOT IN (
      SELECT DISTINCT ON (provider_id) id
        FROM payment_history
       WHERE provider_id IS NOT NULL
       ORDER BY provider_id, created_at DESC, id
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_history_provider_id
    ON payment_history (provider_id)
    WHERE provider_id IS NOT NULL;
