-- Expand survey_type constraint to include all types offered by the new project form.
-- Drop existing check constraints and replace with a broader one.

DO $$
BEGIN
  -- Drop old check constraints on projects.survey_type if they exist
  -- (they may have different names across environments)
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_survey_type_check;
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS survey_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add a broad check that covers all types shown in the form, plus NULL.
ALTER TABLE projects
  ADD CONSTRAINT projects_survey_type_check
  CHECK (survey_type IS NULL OR survey_type IN (
    'boundary',
    'topographic',
    'road',
    'construction',
    'control',
    'leveling',
    'hydrographic',
    'mining',
    'drone',
    'gnss',
    'other'
  ));

-- Add datum column if not already present (needed by New Project form)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS datum text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
