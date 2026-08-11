-- ────────────────────────────────────────────────────────────────────────────
-- 048_trial_reminder.sql
--
-- Idempotency guard for the trial-ending reminder email (sent 3 days before
-- a Pro trial expires by the daily cron at /api/cron/trial-reminders).
-- Each trial user is reminded at most once, tracked on the subscription row.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;

-- Partial index exactly matching the scheduler's scan predicate:
--   status = 'trial' AND trial_ends_at IS NOT NULL
--   AND trial_reminder_sent_at IS NULL AND trial_ends_at > NOW()
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_reminder
    ON user_subscriptions (trial_ends_at)
    WHERE status = 'trial' AND trial_reminder_sent_at IS NULL;

COMMENT ON COLUMN user_subscriptions.trial_reminder_sent_at IS
    'Timestamp when the trial-ending reminder email was sent (idempotency guard for the daily cron).';
