-- supabase/migrations/029_usv_missions.sql

CREATE TABLE usv_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  mission_name VARCHAR(255),
  usv_ids JSONB NOT NULL,
  waypoints JSONB NOT NULL,
  pattern_type VARCHAR(50) DEFAULT 'waypoint',
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usv_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES usv_missions(id) ON DELETE CASCADE,
  usv_id VARCHAR(100) NOT NULL,
  
  position JSONB NOT NULL,
  heading DECIMAL(5,2),
  speed DECIMAL(5,2),
  battery_percent DECIMAL(5,2),
  signal_strength DECIMAL(5,2),
  
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usv_missions_project ON usv_missions(project_id);
CREATE INDEX idx_usv_telemetry_mission ON usv_telemetry(mission_id);

ALTER TABLE usv_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usv_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own missions" ON usv_missions
  FOR ALL USING (auth.uid() = user_id);
