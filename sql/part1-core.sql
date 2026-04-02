-- PART 1: Core Tables - Run on your VM
-- psql -h 34.170.248.156 -U metardu -d metardu

-- DROP EXISTING TABLES FIRST (optional - removes duplicates)
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS survey_points CASCADE;
DROP TABLE IF EXISTS public_beacons CASCADE;
DROP TABLE IF EXISTS parcels CASCADE;
DROP TABLE IF EXISTS alignments CASCADE;
DROP TABLE IF EXISTS chainage_points CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- PROJECTS & POINTS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  utm_zone INTEGER CHECK (utm_zone BETWEEN 1 AND 60),
  hemisphere TEXT CHECK (hemisphere IN ('N','S')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE survey_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  easting DOUBLE PRECISION NOT NULL,
  northing DOUBLE PRECISION NOT NULL,
  elevation DOUBLE PRECISION,
  is_control BOOLEAN DEFAULT false,
  control_order TEXT CHECK (control_order IN ('primary','secondary','temporary')),
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE public_beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID,
  name TEXT NOT NULL,
  easting NUMERIC(14,4) NOT NULL,
  northing NUMERIC(14,4) NOT NULL,
  elevation NUMERIC(10,4),
  utm_zone INTEGER DEFAULT 37,
  hemisphere TEXT DEFAULT 'S',
  authority TEXT,
  beacon_type TEXT CHECK (beacon_type IN ('trig','control','boundary','benchmark','gnss','other')),
  description TEXT,
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  point_ids UUID[] DEFAULT '{}',
  boundary_points JSONB DEFAULT '[]',
  area_sqm NUMERIC(14,4),
  area_ha NUMERIC(14,6),
  area_acres NUMERIC(14,4),
  perimeter_m NUMERIC(14,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chainage_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_id UUID REFERENCES alignments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  point_name TEXT,
  chainage NUMERIC(12,3) NOT NULL,
  easting NUMERIC(14,4),
  northing NUMERIC(14,4),
  elevation NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  license_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert demo user
INSERT INTO profiles (id, email, full_name) VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'mohameddosho20@gmail.com', 'Mohamed Dosho')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT,
  client TEXT,
  survey_type TEXT,
  location JSONB,
  scheduled_date TIMESTAMPTZ,
  crew_size INTEGER,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_points_project_id ON survey_points(project_id);
CREATE INDEX IF NOT EXISTS idx_parcels_project_id ON parcels(project_id);
CREATE INDEX IF NOT EXISTS idx_alignments_project_id ON alignments(project_id);

\dt