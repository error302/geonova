-- supabase/migrations/025_cadastra_validations.sql

CREATE TABLE cadastra_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  boundary_data JSONB NOT NULL,
  satellite_overlay JSONB,
  historical_cadastre JSONB,
  
  score INTEGER,
  overlaps JSONB DEFAULT '[]',
  gaps JSONB DEFAULT '[]',
  report_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cadastra_validations_project ON cadastra_validations(project_id);
CREATE INDEX idx_cadastra_validations_created ON cadastra_validations(created_at DESC);

ALTER TABLE cadastra_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own validations" ON cadastra_validations
  FOR ALL USING (auth.uid() = user_id);