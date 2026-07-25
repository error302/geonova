-- Migration 025: Add is_control flag to survey_points
-- Date: 2026-07-02
-- Audit finding: C8 — /api/project/[id]/points queries is_control column
-- that doesn't exist in the table, causing a runtime SQL error.
--
-- The is_control flag is needed to distinguish control points (traverse
-- stations, benchmarks) from detail points in:
--   - Control survey workflows (LSA uses only control points)
--   - Deed plan generation (boundary beacons vs reference marks)
--   - Map rendering (control points shown with distinct symbol)
--   - Traverse closure checks
--
-- This migration adds the column with a safe default of FALSE and an
-- index for fast filtering (most queries ask for "WHERE is_control").

ALTER TABLE survey_points
  ADD COLUMN IF NOT EXISTS is_control BOOLEAN DEFAULT FALSE;

-- Backfill: any point whose code matches control-related feature codes
-- (from src/lib/topo/featureCodes.ts) is treated as a control point.
UPDATE survey_points
SET is_control = TRUE
WHERE code IN ('TRV', 'TRV_STN', 'CTRL', 'CONTROL', 'BM', 'TBM', 'CP',
               'TS', 'TS_STN', 'PSC', 'SSC', 'TSC', 'BEACON', 'TRIG');

CREATE INDEX IF NOT EXISTS idx_survey_points_is_control
  ON survey_points(project_id, is_control)
  WHERE is_control = TRUE;
