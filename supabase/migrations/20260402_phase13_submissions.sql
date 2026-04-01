-- Phase 13: Submission Package Handoff
-- Canonical submission domain model

-- Submission sequence counter (per surveyor per year)
CREATE TABLE IF NOT EXISTS submission_sequence (
  surveyor_profile_id UUID NOT NULL REFERENCES surveyor_profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (surveyor_profile_id, year)
);

ALTER TABLE submission_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can access own submission sequence" ON submission_sequence
  FOR ALL USING (
    surveyor_profile_id IN (
      SELECT id FROM surveyor_profiles WHERE user_id = auth.uid()
    )
  );

-- Main submissions table
CREATE TABLE IF NOT EXISTS project_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  surveyor_profile_id UUID REFERENCES surveyor_profiles(id),
  submission_number TEXT NOT NULL,
  revision_code TEXT NOT NULL DEFAULT 'R00',
  submission_year INTEGER NOT NULL,
  package_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (package_status IN ('draft', 'incomplete', 'ready', 'submitted')),
  required_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  supporting_attachments JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can access own project submissions" ON project_submissions
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Atomic sequence increment function
CREATE OR REPLACE FUNCTION increment_submission_sequence(
  p_surveyor_profile_id UUID,
  p_year INTEGER
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO submission_sequence (surveyor_profile_id, year, last_sequence)
  VALUES (p_surveyor_profile_id, p_year, 1)
  ON CONFLICT (surveyor_profile_id, year)
  DO UPDATE SET last_sequence = submission_sequence.last_sequence + 1
  RETURNING last_sequence INTO v_seq;
  RETURN v_seq;
END;
$$;

-- New project fields for Form No. 4 / submission metadata
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lr_number TEXT,
  ADD COLUMN IF NOT EXISTS folio_number TEXT,
  ADD COLUMN IF NOT EXISTS register_number TEXT,
  ADD COLUMN IF NOT EXISTS fir_number TEXT,
  ADD COLUMN IF NOT EXISTS registration_block TEXT,
  ADD COLUMN IF NOT EXISTS registration_district TEXT,
  ADD COLUMN IF NOT EXISTS locality TEXT,
  ADD COLUMN IF NOT EXISTS computations_no TEXT,
  ADD COLUMN IF NOT EXISTS field_book_no TEXT,
  ADD COLUMN IF NOT EXISTS file_reference TEXT;

COMMENT ON COLUMN projects.lr_number IS 'Land Reference Number (e.g. LR No. 7185/59)';
COMMENT ON COLUMN projects.folio_number IS 'Land Registry Folio (e.g. 583)';
COMMENT ON COLUMN projects.register_number IS 'Land Registry Register (e.g. 58)';

