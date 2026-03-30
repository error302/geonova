-- ============================================================
-- METARDU Phase 12: Project Workspace data columns
-- File: supabase/migrations/20260330_phase12_project_workspace.sql
-- Run via: supabase db push
-- ============================================================

-- Add workspace data columns to existing projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS boundary_data  JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS levelling_data JSONB DEFAULT '{}'::jsonb;

-- ── Default JSONB structures ─────────────────────────────────────────────────

-- boundary_data shape:
-- {
--   "beacons": [],            -- Beacon[]
--   "boundaries": [],         -- BoundaryLine[]
--   "lots": [],               -- Lot[]
--   "total_area": null,       -- number | null (m²)
--   "working_diagram_status": "pending",
--   "rdm_report_status": "pending"
-- }

-- levelling_data shape:
-- {
--   "level_line": {},         -- Partial<LevelLine>
--   "stations": [],           -- LevelStation[]
--   "computation_method": "hpc",
--   "misclosure_allowed": null,
--   "misclosure_actual": null,
--   "closure_passed": null,
--   "field_book_status": "pending",
--   "computation_status": "pending",
--   "level_report_status": "pending"
-- }

-- Initialise default JSONB for existing rows that have the new columns empty
UPDATE projects
SET boundary_data = jsonb_build_object(
  'beacons', '[]'::jsonb,
  'boundaries', '[]'::jsonb,
  'lots', '[]'::jsonb,
  'total_area', null,
  'working_diagram_status', 'pending',
  'rdm_report_status', 'pending'
)
WHERE boundary_data IS NULL
  AND survey_type IN ('subdivision','amalgamation','resurvey','mutation','gnss_control');

UPDATE projects
SET levelling_data = jsonb_build_object(
  'level_line', '{}'::jsonb,
  'stations', '[]'::jsonb,
  'computation_method', 'hpc',
  'misclosure_allowed', null,
  'misclosure_actual', null,
  'closure_passed', null,
  'field_book_status', 'pending',
  'computation_status', 'pending',
  'level_report_status', 'pending'
)
WHERE levelling_data IS NULL
  AND survey_type IN ('differential','profile','cross_section','benchmark_establishment','two_peg_test');

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────
-- The existing projects RLS policies cover boundary_data and levelling_data
-- automatically because they apply to the whole row. No extra policies needed.

-- ── GIN index for JSONB queries (optional, add if you query beacons by id) ──
CREATE INDEX IF NOT EXISTS idx_projects_boundary_data
  ON projects USING gin (boundary_data jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_projects_levelling_data
  ON projects USING gin (levelling_data jsonb_path_ops);

-- ── Helper view for project workspace summary ────────────────────────────────
CREATE OR REPLACE VIEW project_workspace_summary AS
SELECT
  id,
  name,
  survey_type,
  status,
  utm_zone,
  hemisphere,
  country,
  client_name,
  surveyor_name,
  created_at,
  updated_at,
  -- Boundary metrics
  jsonb_array_length(boundary_data->'beacons')        AS beacon_count,
  jsonb_array_length(boundary_data->'lots')           AS lot_count,
  (boundary_data->>'total_area')::numeric             AS total_area_m2,
  boundary_data->>'working_diagram_status'            AS working_diagram_status,
  boundary_data->>'rdm_report_status'                 AS rdm_report_status,
  -- Levelling metrics
  jsonb_array_length(levelling_data->'stations')      AS station_count,
  levelling_data->>'computation_method'               AS computation_method,
  (levelling_data->>'closure_passed')::boolean        AS closure_passed,
  (levelling_data->>'misclosure_actual')::numeric     AS misclosure_actual_mm,
  (levelling_data->>'misclosure_allowed')::numeric    AS misclosure_allowed_mm
FROM projects;
