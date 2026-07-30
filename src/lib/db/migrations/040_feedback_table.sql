-- ──────────────────────────────────────────────────────────────────────────
-- 040_feedback_table.sql
-- AUDIT FIX (2026-07-05): The FeedbackWidget was calling
-- dbClient.from('feedback').insert(...) but no feedback table existed.
-- Feedback was silently lost (fallback was console.warn in the browser).
-- This migration creates the table that /api/feedback will write to.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'general',
  message         TEXT NOT NULL,
  email           VARCHAR(255),
  page_url        TEXT,
  user_agent      TEXT,
  screen_width    INTEGER,
  screen_height   INTEGER,
  language        VARCHAR(20),
  connection_type VARCHAR(50),
  screenshot_path TEXT,
  error_logs      JSONB,
  status          VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT
);

-- Index for admin dashboard (list open feedback ordered by date)
CREATE INDEX IF NOT EXISTS idx_feedback_status_created
  ON feedback (status, created_at DESC);

-- Index for querying by user (show "your feedback history")
CREATE INDEX IF NOT EXISTS idx_feedback_user
  ON feedback (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for type-based filtering (bugs vs features vs general)
CREATE INDEX IF NOT EXISTS idx_feedback_type
  ON feedback (type, created_at DESC);
