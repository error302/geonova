-- Survey Epochs for Subsidence Monitoring
-- Required for Mining Survey subsidence tracking feature

-- Create survey_epochs table
CREATE TABLE IF NOT EXISTS survey_epochs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  epoch_name TEXT NOT NULL,
  survey_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create epoch_points table
CREATE TABLE IF NOT EXISTS epoch_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id UUID REFERENCES survey_epochs(id) ON DELETE CASCADE,
  point_name TEXT NOT NULL,
  easting NUMERIC(14, 4),
  northing NUMERIC(14, 4),
  elevation NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE survey_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE epoch_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for survey_epochs
CREATE POLICY "Users can view epochs in their projects"
  ON survey_epochs FOR SELECT
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert epochs in their projects"
  ON survey_epochs FOR INSERT
  WITH CHECK (project_id IN (
    SELECT p.id FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update epochs in their projects"
  ON survey_epochs FOR UPDATE
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete epochs in their projects"
  ON survey_epochs FOR DELETE
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
  ));

-- RLS Policies for epoch_points
CREATE POLICY "Users can view epoch points"
  ON epoch_points FOR SELECT
  USING (epoch_id IN (
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert epoch points"
  ON epoch_points FOR INSERT
  WITH CHECK (epoch_id IN (
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update epoch points"
  ON epoch_points FOR UPDATE
  USING (epoch_id IN (
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete epoch points"
  ON epoch_points FOR DELETE
  USING (epoch_id IN (
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    UNION
    SELECT e.id FROM survey_epochs e
    JOIN projects p ON e.project_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_survey_epochs_project ON survey_epochs(project_id);
CREATE INDEX IF NOT EXISTS idx_epoch_points_epoch ON epoch_points(epoch_id);
CREATE INDEX IF NOT EXISTS idx_epoch_points_name ON epoch_points(point_name);

-- Add survey_type column if it doesn't exist (for project survey type)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'survey_type'
  ) THEN
    ALTER TABLE projects ADD COLUMN survey_type TEXT DEFAULT 'topographic';
  END IF;
END $$;
