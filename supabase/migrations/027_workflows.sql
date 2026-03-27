-- supabase/migrations/027_workflows.sql

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  name VARCHAR(255) NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_project ON workflows(project_id);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own workflows" ON workflows
  FOR ALL USING (auth.uid() = user_id);
