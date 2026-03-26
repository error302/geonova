-- supabase/migrations/026_mine_twins.sql

CREATE TABLE mine_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  mesh_data JSONB,
  volumes JSONB,
  convergence JSONB,
  daily_scans JSONB DEFAULT '[]',
  safety_reports JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mine_twins_project ON mine_twins(project_id);

ALTER TABLE mine_twins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own mine twins" ON mine_twins
  FOR ALL USING (auth.uid() = user_id);
