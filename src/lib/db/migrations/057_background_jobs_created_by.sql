-- Migration 057: background_jobs ownership
--
-- SECURITY (audit H-05, 2026-08-30): /api/workers/[jobId] returned any job's
-- payload and result to any authenticated caller by bare UUID. Jobs are now
-- attributed to their creator so the route can scope reads. Legacy rows have
-- NULL created_by and remain readable only by admins.

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_background_jobs_created_by
    ON background_jobs (created_by);
