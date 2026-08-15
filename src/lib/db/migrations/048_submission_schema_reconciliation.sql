-- ────────────────────────────────────────────────────────────────────────────
-- 048_submission_schema_reconciliation.sql
--
-- P2-1 Phase 13 (2026-08-15): Reconcile two schema drifts that surfaced when
-- the Milestone B manifest was wired into assembleSubmission.
--
-- DRIFT 1 — surveyor_profiles missing statutory identity columns:
--   `src/lib/submission/surveyorProfile.ts` (getActiveSurveyorProfile /
--   getSurveyorProfileById) queries `registration_number`, `seal_url`, and
--   `signature_url`, but migration 000 only created `isk_number`. Every call to
--   getActiveSurveyorProfile therefore 500'd at runtime. This migration adds
--   the three missing columns and backfills `registration_number` from the
--   existing `isk_number` (they are the same statutory identifier).
--
-- DRIFT 2 — duplicate sequence tables:
--   migration 007 created `submission_sequences` (current_sequence) and the
--   live code (revisionNumber.ts, assembleSubmission.ts, api/submission/sequence)
--   writes to it. migration 047 created the canonical `submission_sequence`
--   (last_sequence) plus the atomic `increment_submission_sequence()` function
--   that `src/lib/submission/numbering.ts` reads. Two tables for the same job.
--   This migration folds the 007 data into the canonical 047 table (taking the
--   max so no numbering progress is lost) and drops the legacy plural table.
--
-- Idempotent: safe to re-run. The DROP is guarded by table existence, the
-- column adds by IF NOT EXISTS, and the backfill only fills NULL rows.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── 1. surveyor_profiles: statutory identity columns ───────────────────────
ALTER TABLE surveyor_profiles ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50);
ALTER TABLE surveyor_profiles ADD COLUMN IF NOT EXISTS seal_url TEXT;
ALTER TABLE surveyor_profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Backfill registration_number from the existing isk_number (same identifier).
UPDATE surveyor_profiles
   SET registration_number = isk_number
 WHERE registration_number IS NULL
   AND isk_number IS NOT NULL;

-- ─── 2. Fold submission_sequences → submission_sequence ─────────────────────
-- The canonical table may already exist (migration 047). Copy the legacy
-- per-surveyor/year sequence, taking the max so concurrent numbering progress
-- in the plural table is preserved.
INSERT INTO submission_sequence (surveyor_profile_id, year, last_sequence)
SELECT surveyor_profile_id, year, MAX(current_sequence)
  FROM submission_sequences
 GROUP BY surveyor_profile_id, year
ON CONFLICT (surveyor_profile_id, year)
DO UPDATE SET last_sequence = GREATEST(submission_sequence.last_sequence, EXCLUDED.last_sequence);

-- Drop the legacy plural table (its index idx_submission_sequences_surveyor_profile_id
-- from 043 is dropped with it automatically).
DROP TABLE IF EXISTS submission_sequences;

COMMENT ON COLUMN surveyor_profiles.registration_number IS 'ISK/EBK registration number (e.g. RS149). Backfilled from isk_number on reconciliation (048).';
COMMENT ON COLUMN surveyor_profiles.seal_url IS 'Storage path to the surveyor''s seal image (Phase 13 Workstream 5).';
COMMENT ON COLUMN surveyor_profiles.signature_url IS 'Storage path to the surveyor''s signature image.';
