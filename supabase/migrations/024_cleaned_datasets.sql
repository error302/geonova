-- supabase/migrations/024_cleaned_datasets.sql

CREATE TABLE cleaned_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  raw_data JSONB NOT NULL,
  cleaned_data JSONB NOT NULL,
  anomalies JSONB NOT NULL DEFAULT '[]',
  confidence_scores JSONB DEFAULT '{}',
  
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('gnss', 'totalstation', 'lidar')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cleaned_datasets_project ON cleaned_datasets(project_id);
CREATE INDEX idx_cleaned_datasets_created ON cleaned_datasets(created_at DESC);

ALTER TABLE cleaned_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own cleaned datasets" ON cleaned_datasets
  FOR ALL USING (auth.uid() = user_id);
