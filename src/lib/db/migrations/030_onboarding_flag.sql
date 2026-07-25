-- Migration 030: Add server-side onboarding completion flag
-- Date: 2026-07-02
-- Audit finding: M18 — onboarding state was localStorage-only. Clearing
-- browser storage reset the tour, and there was no server-side record of
-- whether a user completed onboarding. Cross-device users saw the tour
-- again. This migration adds a column to track it server-side.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ;

COMMENT ON COLUMN users.onboarding_completed_at IS 'Timestamp when the user completed the onboarding tour. NULL = not completed.';
COMMENT ON COLUMN users.onboarding_skipped_at IS 'Timestamp when the user skipped the onboarding tour. NULL = not skipped.';

-- Index for fast "show tour to new users" query
CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON users(id)
  WHERE onboarding_completed_at IS NULL AND onboarding_skipped_at IS NULL;
