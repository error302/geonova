-- File: supabase/migrations/20260402_survey_type_enum.sql
-- Gap 1C: Update survey_type to 8-type system
-- Gap 2: Create project_beacons table
-- Gap 3: Create project_fieldbook_entries table

-- Update survey_type check constraint to match new 8-type system
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_survey_type_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_survey_type_check
  CHECK (survey_type IN (
    'cadastral',
    'engineering',
    'topographic',
    'geodetic',
    'mining',
    'hydrographic',
    'drone',
    'deformation'
  ));

-- Update any existing rows that used old generic values
UPDATE projects SET survey_type = 'cadastral'
  WHERE survey_type NOT IN (
    'cadastral','engineering','topographic','geodetic',
    'mining','hydrographic','drone','deformation'
  );

-- Gap 2: Create project_beacons table
CREATE TABLE IF NOT EXISTS project_beacons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  beacon_no text NOT NULL,
  easting numeric NOT NULL,
  northing numeric NOT NULL,
  rl numeric,
  description text,
  monument_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, beacon_no)
);

ALTER TABLE project_beacons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own project beacons"
  ON project_beacons
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Gap 3: Create project_fieldbook_entries table
CREATE TABLE IF NOT EXISTS project_fieldbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  station text,
  bs numeric,
  is numeric,
  fs numeric,
  rl numeric,
  instrument_height numeric,
  remark text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, row_index)
);

ALTER TABLE project_fieldbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own fieldbook entries"
  ON project_fieldbook_entries
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
