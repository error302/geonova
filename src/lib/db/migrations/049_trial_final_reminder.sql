-- ────────────────────────────────────────────────────────────────────────────
-- 049_trial_final_reminder.sql
--
-- Idempotency guard for the 24-hour final trial reminder (sent by the daily
-- cron at /api/cron/trial-reminders when a Pro trial has under 24 hours left
-- and the user never upgraded). The 3-day reminder uses migration 048's
-- trial_reminder_sent_at; this is the second, final touch before expiry.
-- Each trial user is reminded at most once per touch, tracked on the
-- subscription row.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS trial_reminder_2_sent_at TIMESTAMPTZ;

-- Partial index exactly matching the scheduler's final scan predicate:
--   status = 'trial' AND trial_reminder_2_sent_at IS NULL
--   AND trial_ends_at > NOW() AND trial_ends_at <= NOW() + interval '24 hours'
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_final_reminder
    ON user_subscriptions (trial_ends_at)
    WHERE status = 'trial' AND trial_reminder_2_sent_at IS NULL;

COMMENT ON COLUMN user_subscriptions.trial_reminder_2_sent_at IS
    'Timestamp when the 24-hour final trial reminder email was sent (idempotency guard for the daily cron).';
