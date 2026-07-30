-- Migration 031: Add cancelled_at + upgraded_at to user_subscriptions
-- Date: 2026-07-02
-- Audit finding: /api/subscription/route.ts references cancelled_at and
-- upgraded_at columns that don't exist in user_subscriptions. This migration
-- adds them so the cancel + upgrade actions work.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMPTZ;

COMMENT ON COLUMN user_subscriptions.cancelled_at IS 'When the subscription was cancelled (NULL = active or never cancelled).';
COMMENT ON COLUMN user_subscriptions.upgraded_at IS 'When the subscription plan was last upgraded.';
