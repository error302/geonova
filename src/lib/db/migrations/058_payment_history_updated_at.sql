-- 058: payment_history.updated_at
--
-- The Till claims pipeline (verify-till 2A instant activation, sms-webhook
-- auto-match) has been setting updated_at on payment_history rows since it
-- shipped — but no migration ever created that column, so every such UPDATE
-- raises 42703 at runtime. Found by the 2026-08-30 payments contract-test
-- pass. IF NOT EXISTS keeps this safe if prod already has the column via
-- manual drift.

ALTER TABLE payment_history
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- DOWN: ALTER TABLE payment_history DROP COLUMN IF EXISTS updated_at;
