-- METARDU Phase 13: submission package foundation
-- Adds persistent document identity fields to surveyor_profiles
-- and creates project_submissions as the canonical submission context.

ALTER TABLE surveyor_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS office_address text,
  ADD COLUMN IF NOT EXISTS seal_image_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_surveyor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS surveyor_profiles_set_updated_at ON surveyor_profiles;

CREATE TRIGGER surveyor_profiles_set_updated_at
  BEFORE UPDATE ON surveyor_profiles
  FOR EACH ROW EXECUTE FUNCTION set_surveyor_profiles_updated_at();

CREATE TABLE IF NOT EXISTS project_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surveyor_profile_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submission_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  sequence_number integer,
  revision_number integer NOT NULL DEFAULT 0,
  submission_number text,
  package_status text NOT NULL DEFAULT 'draft'
    CONSTRAINT project_submissions_status_check
    CHECK (package_status IN ('draft', 'collecting_documents', 'ready_for_review', 'ready_for_export', 'exported')),
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  supporting_attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_project_submissions_project_user
  ON project_submissions(project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_submissions_status
  ON project_submissions(package_status);

ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own submissions" ON project_submissions;

CREATE POLICY "Users manage own submissions" ON project_submissions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_project_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_submissions_set_updated_at ON project_submissions;

CREATE TRIGGER project_submissions_set_updated_at
  BEFORE UPDATE ON project_submissions
  FOR EACH ROW EXECUTE FUNCTION set_project_submissions_updated_at();
