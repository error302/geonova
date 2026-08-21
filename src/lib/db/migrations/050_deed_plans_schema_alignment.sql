-- ─────────────────────────────────────────────────────────────────────────────
-- 050_deed_plans_schema_alignment.sql
--
-- Aligns the deed_plans table with the columns the app actually reads/writes.
-- The app (src/lib/api-client/deedPlans.ts, src/app/api/project/[id]/deed-plans)
-- expects:
--   survey_number, drawing_number, parcel_number, locality, area_sqm, scale,
--   datum, input_data (jsonb), svg_content (text), closure_check (jsonb),
--   status, generated_at
-- but the canonical schema (000) only defined plan_number, plan_type, status,
-- generated_at, pdf_url, dxf_url.  Saving a deed plan failed with
-- `column "user_id" does not exist` and listing with a 500.
--
-- This migration adds the missing columns and back-fills plan_number from
-- survey_number/parcel_number for any legacy rows.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deed_plans
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_number    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS drawing_number   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parcel_number    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS locality         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS area_sqm         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS scale            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS datum            VARCHAR(50) DEFAULT 'ARC1960',
  ADD COLUMN IF NOT EXISTS input_data       JSONB,
  ADD COLUMN IF NOT EXISTS svg_content      TEXT,
  ADD COLUMN IF NOT EXISTS closure_check    JSONB;

-- Back-fill plan_number from the newer columns for legacy rows
UPDATE deed_plans
   SET plan_number = COALESCE(NULLIF(survey_number, ''), parcel_number)
 WHERE plan_number IS NULL AND COALESCE(survey_number, parcel_number) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deed_plans_user ON deed_plans(user_id);