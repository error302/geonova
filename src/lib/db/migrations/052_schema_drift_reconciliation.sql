-- 052_schema_drift_reconciliation.sql
-- Reconciles application code with migrations: adds every table/column that
-- src selects but migrations never defined (found by scripts/schema-drift-gate.mjs,
-- 2026-08-21 audit). All statements are IF NOT EXISTS — safe re-runs and no-ops
-- where the live DB already has the object (e.g. created manually).
--
-- Types inferred from app usage; revisit if runtime inserts reveal mismatches.

-- ── projects (workflow cols already in 050) ────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS surveyor_license text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS county text;

-- ── survey_points / parcels ─────────────────────────────────────────────────
ALTER TABLE survey_points ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE parcels     ADD COLUMN IF NOT EXISTS boundary_geojson jsonb;

-- ── project_fieldbook_entries ───────────────────────────────────────────────
ALTER TABLE project_fieldbook_entries ADD COLUMN IF NOT EXISTS bs double precision;
ALTER TABLE project_fieldbook_entries ADD COLUMN IF NOT EXISTS remark text;

-- ── surveyor_profiles ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surveyor_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid,
  name            text,
  company         text,
  display_name    text,
  email           text,
  office_address  text,
  seal_image_path text,
  profile_public  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── survey_reports ──────────────────────────────────────────────────────────
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS report_number text;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS report_title  text;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS revision      text;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS completeness  integer NOT NULL DEFAULT 0;

-- ── peer_reviews ────────────────────────────────────────────────────────────
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS project_name   text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS survey_type    text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS description    text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS country        text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS submitter_name text;

-- ── marketplace/jobs side tables ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_recommendations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid,
  equipment  text,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_checklists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid,
  item       text,
  done       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcel_vault (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid,
  title      text,
  data       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcel_vault_shared (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id   uuid,
  shared_with uuid,
  permission text NOT NULL DEFAULT 'read',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_checklists ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '[]'::jsonb;
