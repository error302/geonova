CREATE TABLE safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  incident_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'low',
  location JSONB,
  description TEXT,
  evidence_images JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'reported',
  risk_score INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  report_type VARCHAR(50) NOT NULL,
  period_start DATE,
  period_end DATE,
  summary JSONB,
  recommendations JSONB DEFAULT '[]',
  risk_trends JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_safety_incidents_project ON safety_incidents(project_id);
CREATE INDEX idx_safety_reports_project ON safety_reports(project_id);

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own incidents" ON safety_incidents
  FOR ALL USING (auth.uid() = user_id);
