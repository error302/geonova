-- supabase/migrations/028_bathymetric_surveys.sql

CREATE TABLE bathymetric_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  survey_name VARCHAR(255),
  soundings JSONB NOT NULL,
  contours JSONB,
  deltas JSONB,
  hazards JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bathymetric_surveys_project ON bathymetric_surveys(project_id);

ALTER TABLE bathymetric_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own surveys" ON bathymetric_surveys
  FOR ALL USING (auth.uid() = user_id);
