-- PART 2: Additional Tables - Run on your VM
-- psql -h 34.170.248.156 -U metardu -d metardu

-- FIELD BOOKS & SURVEY DATA
CREATE TABLE IF NOT EXISTS field_books (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  name TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_fieldbook_entries (
  id UUID PRIMARY KEY,
  project_id UUID,
  entry_type TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEMBERS & COLLABORATION
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'viewer',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  project_id UUID,
  user_id UUID,
  status JSONB,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- HISTORY & AUDIT
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBSCRIPTIONS & AUTH
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_info JSONB,
  ip_address TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FEEDBACK & NEWSLETTER
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANALYTICS
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTS & PHOTOS
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  type TEXT,
  path TEXT,
  size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  point_id UUID,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_epochs (
  id UUID PRIMARY KEY,
  project_id UUID,
  epoch_name TEXT NOT NULL,
  epoch_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEVELING & GNSS
CREATE TABLE IF NOT EXISTS leveling_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  run_name TEXT NOT NULL,
  date DATE,
  instrument TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gnss_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  session_name TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  base_station_coords JSONB,
  processing_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  name TEXT NOT NULL,
  easting NUMERIC(14,4),
  northing NUMERIC(14,4),
  elevation NUMERIC(10,4),
  elevation_datum TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBMISSIONS & DOCUMENTS
CREATE TABLE IF NOT EXISTS submission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  document_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- IMPORT SESSIONS
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

-- ONLINE SERVICE LOGS
CREATE TABLE IF NOT EXISTS online_service_logs (
  id UUID PRIMARY KEY,
  service_name TEXT,
  request_data JSONB,
  response_data JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MARKETPLACE JOBS
CREATE TABLE IF NOT EXISTS marketplace_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT,
  county TEXT,
  location_description TEXT,
  parcel_number TEXT,
  estimated_area NUMERIC(14,4),
  budget_amount NUMERIC(14,2),
  budget_type TEXT,
  deadline DATE,
  required_qualifications TEXT[],
  status TEXT DEFAULT 'OPEN',
  awarded_to UUID,
  completed_at TIMESTAMPTZ,
  commission_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  surveyor_id UUID NOT NULL,
  surveyor_name TEXT,
  isk_number TEXT,
  cover_letter TEXT,
  proposed_amount NUMERIC(14,2),
  proposed_currency TEXT DEFAULT 'KES',
  proposed_timeline INTEGER,
  portfolio_links TEXT[],
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'PENDING'
);

-- CPD & PEER REVIEW
CREATE TABLE IF NOT EXISTS cpd_records (
  id UUID PRIMARY KEY,
  user_id UUID,
  activity TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpd_certificates (
  id UUID PRIMARY KEY,
  user_id UUID,
  year INTEGER NOT NULL,
  total_points INTEGER,
  verification_code TEXT UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  reviewer_id UUID NOT NULL,
  surveyor_id UUID NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  quality_rating INTEGER,
  timeliness_rating INTEGER,
  communication_rating INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY,
  user_id UUID,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EQUIPMENT
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

CREATE TABLE IF NOT EXISTS equipment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT PRIMARY KEY,
  equipment TEXT[]
);

CREATE TABLE IF NOT EXISTS job_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT PRIMARY KEY,
  tasks TEXT[]
);

-- SIGNATURES
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY,
  user_id UUID,
  image_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NLIMS CACHE
CREATE TABLE IF NOT EXISTS nlims_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  results JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARCEL METADATA
CREATE TABLE IF NOT EXISTS parcel_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEED PLANS
CREATE TABLE IF NOT EXISTS deed_plans (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  survey_number TEXT,
  drawing_number TEXT,
  parcel_number TEXT,
  locality TEXT,
  area_sqm NUMERIC(12,2),
  scale TEXT,
  datum TEXT,
  input_data JSONB,
  svg_content TEXT,
  closure_check JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SURVEY REPORTS
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GEOFUSION
CREATE TABLE IF NOT EXISTS geofusion_projects (
  id UUID PRIMARY KEY,
  user_id UUID,
  project_name TEXT,
  coordinates JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAFETY
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USV
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

CREATE TABLE IF NOT EXISTS usv_telemetry (
  id UUID PRIMARY KEY,
  mission_id UUID,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  heading NUMERIC(5,2),
  speed NUMERIC(6,2),
  battery_level INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- BATHYMETRIC
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

-- MINE TWINS
CREATE TABLE IF NOT EXISTS mine_twins (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  mesh_data JSONB,
  volumes JSONB,
  convergence JSONB[],
  daily_scans JSONB[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WORKFLOWS & WEBHOOKS
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  steps JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY,
  user_id UUID,
  url TEXT NOT NULL,
  events TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID,
  event_type TEXT,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLEANED DATASETS
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

-- CADASTRAL VALIDATIONS
CREATE TABLE IF NOT EXISTS cadastra_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  validation_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARCEL VAULT
CREATE TABLE IF NOT EXISTS parcel_vault (
  id UUID PRIMARY KEY,
  user_id UUID,
  parcel_number TEXT,
  title_deed_number TEXT,
  owner_name TEXT,
  location JSONB,
  area NUMERIC(12,2),
  freshness TEXT DEFAULT 'FRESH',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_vault_shared (
  id UUID PRIMARY KEY,
  parcel_id UUID,
  shared_with UUID,
  permission TEXT DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LAND LAW
CREATE TABLE IF NOT EXISTS land_law_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  case_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROFESSIONAL BODIES
CREATE TABLE IF NOT EXISTS professional_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  body_name TEXT NOT NULL,
  membership_number TEXT,
  joined_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENTERPRISE / ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- SURVEYOR PROFILES
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
  average_rating NUMERIC(3,2),
  total_reviews INTEGER DEFAULT 0,
  verified_isk BOOLEAN DEFAULT false,
  profile_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMUNITY
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY,
  post_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROJECT BEACONS
CREATE TABLE IF NOT EXISTS project_beacons (
  id UUID PRIMARY KEY,
  project_id UUID,
  beacon_number TEXT,
  type TEXT,
  coordinates JSONB,
  elevation NUMERIC(10,3),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

\dt