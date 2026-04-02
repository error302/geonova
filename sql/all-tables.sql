-- All tables for METARDU app
-- Run this on your VM in psql

-- Fix user ID with valid UUID
INSERT INTO profiles (id, email, full_name) VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'mohameddosho20@gmail.com', 'Mohamed Dosho')
ON CONFLICT (email) DO NOTHING;

-- Field book entries
CREATE TABLE IF NOT EXISTS project_fieldbook_entries (
  id UUID PRIMARY KEY,
  project_id UUID,
  entry_type TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveyor profiles
CREATE TABLE IF NOT EXISTS surveyor_profiles (
  id UUID PRIMARY KEY,
  user_id UUID,
  full_name TEXT,
  isk_number TEXT,
  firm_name TEXT,
  county TEXT,
  specializations TEXT[],
  years_experience INTEGER,
  bio TEXT,
  average_rating DECIMAL(3,2),
  total_reviews INTEGER DEFAULT 0,
  verified_isk BOOLEAN DEFAULT false,
  profile_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  type TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  status TEXT DEFAULT 'available',
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Field books
CREATE TABLE IF NOT EXISTS field_books (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project submissions
CREATE TABLE IF NOT EXISTS project_submissions (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  submission_type TEXT,
  status TEXT DEFAULT 'pending',
  documents JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPD records
CREATE TABLE IF NOT EXISTS cpd_records (
  id UUID PRIMARY KEY,
  user_id UUID,
  activity TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPD certificates
CREATE TABLE IF NOT EXISTS cpd_certificates (
  id UUID PRIMARY KEY,
  user_id UUID,
  year INTEGER NOT NULL,
  total_points INTEGER,
  verification_code TEXT UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community posts
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community comments
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY,
  post_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project beacons
CREATE TABLE IF NOT EXISTS project_beacons (
  id UUID PRIMARY KEY,
  project_id UUID,
  beacon_number TEXT,
  type TEXT,
  coordinates JSONB,
  elevation DECIMAL(10,3),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment intents
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY,
  user_id UUID,
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY,
  user_id UUID,
  url TEXT NOT NULL,
  events TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  steps JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USV missions
CREATE TABLE IF NOT EXISTS usv_missions (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  mission_name TEXT,
  usv_ids TEXT[],
  waypoints JSONB,
  pattern_type TEXT,
  status TEXT DEFAULT 'draft',
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USV telemetry
CREATE TABLE IF NOT EXISTS usv_telemetry (
  id UUID PRIMARY KEY,
  mission_id UUID,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  battery_level INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deed plans
CREATE TABLE IF NOT EXISTS deed_plans (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  survey_number TEXT,
  drawing_number TEXT,
  parcel_number TEXT,
  locality TEXT,
  area_sqm DECIMAL(12,2),
  scale TEXT,
  datum TEXT,
  input_data JSONB,
  svg_content TEXT,
  closure_check JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey reports
CREATE TABLE IF NOT EXISTS survey_reports (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  report_number TEXT,
  report_title TEXT,
  revision TEXT DEFAULT 'Rev 0',
  status TEXT DEFAULT 'draft',
  input_data JSONB,
  sections JSONB,
  completeness INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bathymetric surveys
CREATE TABLE IF NOT EXISTS bathymetric_surveys (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  survey_name TEXT,
  soundings JSONB,
  contours JSONB[],
  hazards JSONB[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety incidents
CREATE TABLE IF NOT EXISTS safety_incidents (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  incident_type TEXT,
  severity TEXT,
  location JSONB,
  description TEXT,
  evidence_images TEXT[],
  status TEXT DEFAULT 'reported',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mine twins
CREATE TABLE IF NOT EXISTS mine_twins (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  mesh_data JSONB,
  volumes JSONB,
  convergence JSONB[],
  daily_scans JSONB[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofusion projects
CREATE TABLE IF NOT EXISTS geofusion_projects (
  id UUID PRIMARY KEY,
  user_id UUID,
  project_name TEXT,
  coordinates JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleaned datasets
CREATE TABLE IF NOT EXISTS cleaned_datasets (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  raw_data JSONB[],
  cleaned_data JSONB[],
  anomalies JSONB[],
  confidence_scores JSONB,
  data_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signatures
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY,
  user_id UUID,
  image_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Online service logs
CREATE TABLE IF NOT EXISTS online_service_logs (
  id UUID PRIMARY KEY,
  service_name TEXT,
  request_data JSONB,
  response_data JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import sessions
CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  file_name TEXT,
  status TEXT DEFAULT 'pending',
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  errors JSONB[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parcel vault
CREATE TABLE IF NOT EXISTS parcel_vault (
  id UUID PRIMARY KEY,
  user_id UUID,
  parcel_number TEXT,
  title_deed_number TEXT,
  owner_name TEXT,
  location JSONB,
  area DECIMAL(12,2),
  freshness TEXT DEFAULT 'FRESH',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parcel vault shared
CREATE TABLE IF NOT EXISTS parcel_vault_shared (
  id UUID PRIMARY KEY,
  parcel_id UUID,
  shared_with UUID,
  permission TEXT DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verify all tables
\dt