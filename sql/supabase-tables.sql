-- All tables from Supabase migrations
-- Auto-generated for VM migration

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid not null UUID,
  name text not null,
  location text,
  utm_zone integer not null check (utm_zone between 1 and 60),
  hemisphere text not null check (hemisphere in ('N',
  'S')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid not null UUID UUID REFERENCES projects(id),
  name text not null,
  easting double precision not null,
  northing double precision not null,
  elevation double precision,
  is_control BOOLEAN DEFAULT false,
  control_order text check (control_order in ('primary',
  'secondary',
  'temporary')),
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unique(project_id,
  name)
);

CREATE TABLE IF NOT EXISTS public_beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid UUID,
  name text not null,
  easting numeric(14,
  4) not null,
  northing numeric(14,
  4) not null,
  elevation numeric(10,
  4),
  utm_zone integer not null default 37,
  hemisphere text default 'S',
  authority text,
  beacon_type text check (beacon_type in (
    'trig',
  'control',
  'boundary',
  'benchmark',
  'gnss',
  'other'
  )),
  description text,
  verified BOOLEAN DEFAULT false,
  status text default 'pending' 
    check (status in ('pending',
  'verified',
  'rejected')),
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  point_ids UUID[] DEFAULT '{}',
  boundary_points JSONB DEFAULT '[]',
  area_sqm NUMERIC(14,
  4),
  area_ha NUMERIC(14,
  6),
  area_acres NUMERIC(14,
  4),
  perimeter_m NUMERIC(14,
  4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID UUID
);

CREATE TABLE IF NOT EXISTS alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid UUID UUID REFERENCES projects(id),
  name text not null,
  description text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS chainage_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_id uuid REFERENCES alignments(id),
  project_id uuid UUID UUID REFERENCES projects(id),
  point_name text,
  chainage numeric(12,
  3) not null,
  easting numeric(14,
  4),
  northing numeric(14,
  4),
  elevation numeric(10,
  4),
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS cross_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_id uuid REFERENCES alignments(id),
  chainage numeric(12,
  3) not null,
  offset_distance numeric(10,
  4) not null,
  offset_direction text check (offset_direction in ('left',
  'center',
  'right')),
  elevation numeric(10,
  4),
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id uuid REFERENCES survey_points(id),
  project_id uuid UUID UUID REFERENCES projects(id),
  changed_by uuid UUID,
  change_type text check (change_type in ('insert',
  'update',
  'delete')),
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid UUID UUID REFERENCES projects(id),
  user_id uuid UUID,
  user_email text,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid UUID UUID REFERENCES projects(id),
  user_id uuid UUID,
  role text check (role in ('owner',
  'supervisor',
  'surveyor',
  'viewer')) default 'viewer',
  invited_email text,
  status text default 'pending' check (status in ('pending',
  'accepted',
  'rejected')),
  created_at timestamptz default now(),
  unique(project_id,
  user_id),
  unique(project_id,
  invited_email)
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id text primary key,
  name text not null,
  price_kes numeric(10,
  2),
  price_ugx numeric(10,
  2),
  price_tzs numeric(10,
  2),
  price_ngn numeric(10,
  2),
  price_usd numeric(10,
  2),
  max_projects integer,
  max_points_per_project integer,
  features jsonb,
  is_active boolean default true
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  plan_id text REFERENCES subscription_plans(id),
  status text default 'active' 
    check (status in ('active',
  'cancelled',
  'expired',
  'trial')),
  trial_ends_at timestamptz default now() + interval '14 days',
  current_period_start timestamptz default now(),
  current_period_end timestamptz default now() + interval '30 days',
  payment_method text,
  currency text default 'KES',
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  amount numeric(10,
  2),
  currency text default 'KES',
  status text default 'pending'
    check (status in ('pending',
  'completed',
  'failed',
  'refunded')),
  payment_method text,
  transaction_id text,
  plan_id text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email text unique not null,
  source text default 'website',
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type text check (type in ('bug',
  'feature',
  'general')),
  message text not null,
  email text,
  page_url text,
  user_id uuid UUID,
  status text default 'open' check (status in ('open',
  'reviewed',
  'resolved')),
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  event text not null,
  properties jsonb,
  url text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS survey_epochs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  epoch_name TEXT NOT NULL,
  survey_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID UUID
);

CREATE TABLE IF NOT EXISTS epoch_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id UUID REFERENCES survey_epochs(id),
  point_name TEXT NOT NULL,
  easting NUMERIC(14,
  4),
  northing NUMERIC(14,
  4),
  elevation NUMERIC(10,
  4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leveling_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  start_point TEXT,
  end_point TEXT,
  start_rl DOUBLE PRECISION,
  end_rl DOUBLE PRECISION,
  method TEXT DEFAULT 'rise_fall',
  -- rise_fall | hoc
  error_closure DOUBLE PRECISION,
  tolerance DOUBLE PRECISION,
  adjusted BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leveling_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES leveling_runs(id),
  point_id TEXT NOT NULL,
  point_type TEXT NOT NULL,
  -- bs | fs | is
  distance DOUBLE PRECISION,
  rl DOUBLE PRECISION,
  elevation DOUBLE PRECISION,
  backsight_rl DOUBLE PRECISION,
  foresight_rl DOUBLE PRECISION,
  remarks TEXT,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presence_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID,
  cursor_x DOUBLE PRECISION,
  cursor_y DOUBLE PRECISION,
  active_tool TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid not null UUID,
  name text not null,
  client text,
  survey_type text not null check (survey_type in ('boundary',
  'topographic',
  'leveling',
  'road',
  'construction',
  'control',
  'mining',
  'hydrographic',
  'drone',
  'gnss',
  'other')),
  location geography(point,
  4326),
  scheduled_date timestamptz,
  crew_size integer check (crew_size > 0),
  status text default 'planned' check (status in ('planned',
  'active',
  'completed',
  'cancelled')),
  notes text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type text primary key,
  equipment jsonb not null,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type text primary key,
  tasks jsonb not null,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid primary key UUID,
  full_name text,
  country text,
  license_number text,
  firm_name text,
  specializations TEXT[] default '{}',
  default_utm_zone integer default 37,
  default_hemisphere text default 'S',
  preferred_language text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS plan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  feature text not null,
  usage_count INTEGER DEFAULT 0,
  usage_limit integer not null default -1,
  last_incremented_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id,
  feature)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  event_type text not null,
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS cpd_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid not null UUID,
  title text not null,
  provider text not null,
  date TIMESTAMPTZ DEFAULT NOW(),
  hours numeric(4,
  1) not null,
  category text not null,
  source text not null,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID on delete set null,
  project_name text not null,
  survey_type text not null,
  description text not null,
  country text not null,
  submitter_name text not null,
  submitter_contact text not null,
  attachment_note text,
  status text not null default 'open',
  payment_status text not null default 'pending' check (payment_status in ('pending',
  'paid',
  'refunded')),
  payment_amount_kes integer not null default 2500,
  stripe_payment_intent_id text,
  reviewer_payout_kes integer not null default 2000,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS peer_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES peer_reviews(id),
  reviewer_name text not null,
  reviewer_title text,
  comment text not null,
  category text not null,
  rating integer not null,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UUID,
  project_id uuid UUID UUID REFERENCES projects(id),
  document_hash text not null,
  signer_name text not null,
  isk_number text,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaned_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  raw_data JSONB NOT NULL,
  cleaned_data JSONB NOT NULL,
  anomalies JSONB NOT NULL DEFAULT '[]',
  confidence_scores JSONB DEFAULT '{}',
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('gnss',
  'totalstation',
  'lidar')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadastra_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  boundary_data JSONB NOT NULL,
  satellite_overlay JSONB,
  historical_cadastre JSONB,
  score INTEGER,
  overlaps JSONB DEFAULT '[]',
  gaps JSONB DEFAULT '[]',
  report_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mine_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  mesh_data JSONB,
  volumes JSONB,
  convergence JSONB,
  daily_scans JSONB DEFAULT '[]',
  safety_reports JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bathymetric_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  survey_name VARCHAR(255),
  soundings JSONB NOT NULL,
  contours JSONB,
  deltas JSONB,
  hazards JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usv_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS usv_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES usv_missions(id),
  usv_id VARCHAR(100) NOT NULL,
  position JSONB NOT NULL,
  heading DECIMAL(5,
  2),
  speed DECIMAL(5,
  2),
  battery_percent DECIMAL(5,
  2),
  signal_strength DECIMAL(5,
  2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  report_type VARCHAR(50) NOT NULL,
  period_start DATE,
  period_end DATE,
  summary JSONB,
  recommendations JSONB DEFAULT '[]',
  risk_trends JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geofusion_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_srid INTEGER DEFAULT 4326,
  target_srid INTEGER DEFAULT 4326,
  status VARCHAR(50) DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fusion_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofusion_project_id UUID REFERENCES geofusion_projects(id),
  layer_name VARCHAR(255) NOT NULL,
  layer_type VARCHAR(50) NOT NULL,
  source_data JSONB,
  geometry_type VARCHAR(50),
  properties JSONB DEFAULT '{}',
  style_config JSONB DEFAULT '{}',
  visibility BOOLEAN DEFAULT true,
  opacity FLOAT DEFAULT 1.0,
  z_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fusion_alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofusion_project_id UUID REFERENCES geofusion_projects(id),
  alignment_name VARCHAR(255) NOT NULL,
  source_layer_id UUID REFERENCES fusion_layers(id) NULL,
  target_layer_id UUID REFERENCES fusion_layers(id) NULL,
  transform_type VARCHAR(50) NOT NULL,
  transform_params JSONB,
  accuracy_score FLOAT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deed_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UUID UUID REFERENCES projects(id),
  user_id UUID UUID ON DELETE SET NULL,
  survey_number TEXT NOT NULL,
  drawing_number TEXT NOT NULL,
  parcel_number TEXT NOT NULL,
  locality TEXT,
  area_sqm FLOAT8,
  scale INTEGER,
  datum TEXT,
  input_data JSONB NOT NULL,
  svg_content TEXT,
  closure_check JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid UUID UUID REFERENCES projects(id),
  user_id uuid UUID,
  report_number text NOT NULL,
  report_title text NOT NULL,
  revision text NOT NULL DEFAULT 'Rev 0',
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT status_values CHECK (status IN ('draft',
  'review',
  'finalised')),
  input_data jsonb NOT NULL DEFAULT '{}',
  sections jsonb NOT NULL DEFAULT '[]',
  completeness integer NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gnss_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid UUID UUID REFERENCES projects(id),
  user_id uuid UUID,
  status text NOT NULL DEFAULT 'uploading',
  input_files jsonb NOT NULL DEFAULT '[]',
  results jsonb,
  error_msg text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bm_number text UNIQUE NOT NULL,
  name text,
  county text,
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  elevation float8 NOT NULL,
  datum text DEFAULT 'MSL_MOMBASA',
  mark_type text,
  description text,
  established date,
  last_verified date,
  status text DEFAULT 'ACTIVE',
  source text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nlims_cache (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parcel_number text NOT NULL,
  county        text NOT NULL,
  data          jsonb NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parcel_number,
  county)
);

CREATE TABLE IF NOT EXISTS parcel_vault (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                uuid UUID,
  parcel_number          text NOT NULL,
  county                 text NOT NULL,
  registration_section   text,
  area_sqm               float8,
  title_deed_number      text,
  owner_type             text,
  encumbrances           jsonb DEFAULT '[]',
  status                 text,
  certificate_date       date NOT NULL,
  expires_at             date GENERATED ALWAYS AS (certificate_date + INTERVAL '90 days') STORED,
  freshness              text GENERATED ALWAYS AS (
                            CASE
                              WHEN certificate_date > CURRENT_DATE - 30 THEN 'FRESH'
                              WHEN certificate_date > CURRENT_DATE - 90 THEN 'VERIFY'
                              ELSE 'STALE'
                            END
                          ) STORED,
  pdf_path              text,
  shared                BOOLEAN DEFAULT false,
  parsed_data           jsonb NOT NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(user_id,
  parcel_number)
);

CREATE TABLE IF NOT EXISTS parcel_vault_shared (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parcel_number          text NOT NULL UNIQUE,
  county                 text NOT NULL,
  registration_section   text,
  area_sqm               float8,
  title_deed_number      text,
  encumbrances_count     INTEGER DEFAULT 0,
  status                 text,
  certificate_date       date NOT NULL,
  freshness              text,
  contributor_count     integer DEFAULT 1,
  last_updated          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_signatures (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id         uuid NOT NULL,
  document_type       text NOT NULL,
  signed_by           uuid UUID,
  surveyor_name       text NOT NULL,
  isk_number          text NOT NULL,
  firm_name           text NOT NULL,
  signed_at           TIMESTAMPTZ DEFAULT NOW(),
  document_hash       text NOT NULL,
  signature_data      text,
  method              text NOT NULL,
  ip_address          text,
  valid               boolean NOT NULL DEFAULT true,
  revoked_at          timestamptz,
  revoked_reason      text,
  verification_token  text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid UUID,
  name                  text NOT NULL,
  type                  text NOT NULL,
  make                  text NOT NULL,
  model                 text NOT NULL,
  serial_number         text NOT NULL,
  purchase_date         date,
  last_calibration      date NOT NULL,
  next_calibration_due  date NOT NULL,
  calibration_interval  integer NOT NULL DEFAULT 12,
  cert_number           text,
  calibration_lab       text,
  status                text NOT NULL DEFAULT 'CURRENT',
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calibration_records (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id   uuid REFERENCES equipment(id),
  date           date NOT NULL,
  cert_number    text,
  lab            text,
  technician     text,
  result         text NOT NULL,
  findings       text,
  corrections    text,
  next_due_date  date NOT NULL,
  document_path  text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_jobs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  posted_by           uuid UUID,
  title               text NOT NULL,
  description         text NOT NULL,
  job_type            text NOT NULL,
  county              text NOT NULL,
  constituency        text,
  location_description text NOT NULL,
  parcel_number       text,
  estimated_area      float8,
  budget_amount       float8 NOT NULL,
  budget_currency     text NOT NULL DEFAULT 'KES',
  budget_type         text NOT NULL DEFAULT 'FIXED',
  commission_amount   float8 GENERATED ALWAYS AS (budget_amount * 0.05) STORED,
  deadline            date NOT NULL,
  required_quals      TEXT[] DEFAULT '{}',
  status              text NOT NULL DEFAULT 'OPEN',
  awarded_to          uuid UUID,
  completed_at        timestamptz,
  commission_paid     BOOLEAN DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id              uuid REFERENCES survey_jobs(id),
  surveyor_id         uuid UUID,
  cover_letter        text NOT NULL,
  proposed_amount     float8 NOT NULL,
  proposed_currency   text NOT NULL DEFAULT 'KES',
  proposed_timeline   integer NOT NULL,
  portfolio_links     TEXT[] DEFAULT '{}',
  status              text NOT NULL DEFAULT 'PENDING',
  applied_at          timestamptz DEFAULT now(),
  UNIQUE(job_id,
  surveyor_id)
);

CREATE TABLE IF NOT EXISTS job_reviews (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                uuid REFERENCES survey_jobs(id),
  reviewer_id           uuid UUID,
  surveyor_id           uuid UUID,
  rating                integer CHECK (rating BETWEEN 1 AND 5),
  comment               text,
  quality_rating        integer CHECK (quality_rating BETWEEN 1 AND 5),
  timeliness_rating     integer CHECK (timeliness_rating BETWEEN 1 AND 5),
  communication_rating  integer CHECK (communication_rating BETWEEN 1 AND 5),
  created_at            timestamptz DEFAULT now(),
  UNIQUE(job_id,
  reviewer_id)
);

CREATE TABLE IF NOT EXISTS surveyor_profiles (
  user_id             uuid PRIMARY KEY UUID,
  display_name        text NOT NULL,
  isk_number          text,
  firm_name           text,
  county              text,
  specializations     TEXT[] DEFAULT '{}',
  years_experience    integer,
  bio                 text,
  average_rating      float8 DEFAULT 0,
  total_reviews       INTEGER DEFAULT 0,
  jobs_completed      INTEGER DEFAULT 0,
  verified_isk        BOOLEAN DEFAULT false,
  profile_public      boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_review_requests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by    uuid UUID,
  document_type   text NOT NULL,
  document_id     uuid NOT NULL,
  title           text NOT NULL,
  description     text,
  urgency         text DEFAULT 'STANDARD',
  status          text DEFAULT 'OPEN',
  due_by          date,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_reviewers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id      uuid REFERENCES peer_review_requests(id),
  reviewer_id     uuid UUID,
  assigned_at     timestamptz DEFAULT now(),
  completed_at    timestamptz,
  verdict         text,
  cpd_points      INTEGER DEFAULT 0,
  UNIQUE(request_id,
  reviewer_id)
);

CREATE TABLE IF NOT EXISTS review_comments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id_fk  uuid REFERENCES peer_reviewers(id),
  section         text NOT NULL,
  severity        text NOT NULL DEFAULT 'INFO',
  comment         text NOT NULL,
  regulation_cite text,
  resolved        BOOLEAN DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cpd_records (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid UUID,
  activity      text NOT NULL,
  points        integer NOT NULL,
  earned_at     timestamptz DEFAULT now(),
  reference_id  uuid,
  description   text NOT NULL,
  verifiable    boolean DEFAULT true,
  supporting_doc text
);

CREATE TABLE IF NOT EXISTS cpd_certificates (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid UUID,
  year              integer NOT NULL,
  total_points      integer NOT NULL,
  generated_at      timestamptz DEFAULT now(),
  verification_code text UNIQUE NOT NULL,
  pdf_path          text,
  UNIQUE(user_id,
  year)
);

CREATE TABLE IF NOT EXISTS professional_memberships (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid UUID,
  body                text NOT NULL,
  membership_number   text NOT NULL,
  membership_grade    text,
  verification_status text DEFAULT 'PENDING',
  verified_at         timestamptz,
  expires_at          date,
  verification_method text DEFAULT 'MANUAL',
  supporting_doc      text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(user_id,
  body)
);

CREATE TABLE IF NOT EXISTS organizations (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                text NOT NULL,
  type                text NOT NULL,
  county              text,
  registration_number text,
  contact_email       text NOT NULL,
  contact_phone       text,
  plan                text NOT NULL DEFAULT 'ENTERPRISE',
  seat_count          integer NOT NULL DEFAULT 5,
  seats_used          integer NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  active              boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS white_label_configs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid REFERENCES organizations(id),
  brand_name          text NOT NULL,
  logo_url            text,
  favicon_url         text,
  primary_color       text NOT NULL DEFAULT '#1d4ed8',
  secondary_color     text NOT NULL DEFAULT '#1e40af',
  accent_color        text NOT NULL DEFAULT '#3b82f6',
  custom_domain       text UNIQUE,
  subdomain           text UNIQUE,
  footer_text         text DEFAULT 'Survey Platform',
  show_powered_by     boolean DEFAULT true,
  custom_css          text,
  email_from_name     text,
  report_header       text,
  report_footer       text,
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  user_id         uuid UUID,
  role            text NOT NULL DEFAULT 'MEMBER',
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(organization_id,
  user_id)
);

CREATE TABLE IF NOT EXISTS government_licenses (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid REFERENCES organizations(id),
  ministry          text NOT NULL,
  department        text,
  county            text,
  license_number    text UNIQUE NOT NULL,
  seat_count        integer NOT NULL,
  features          TEXT[] DEFAULT '{}',
  audit_required    boolean DEFAULT true,
  data_residency    text DEFAULT 'KENYA',
  procurement_ref   text,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  contact_person    text,
  contact_email     text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid UUID,
  organization_id uuid REFERENCES organizations(id),
  amount          float8 NOT NULL,
  currency        text NOT NULL DEFAULT 'KES',
  amount_kes      float8 NOT NULL,
  purpose         text NOT NULL,
  reference_id    uuid,
  method          text NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING',
  provider_ref    text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

CREATE TABLE IF NOT EXISTS university_licenses (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid REFERENCES organizations(id),
  university_name     text NOT NULL,
  department          text NOT NULL,
  country             text NOT NULL,
  student_seat_count  integer NOT NULL,
  lecturer_seat_count integer NOT NULL,
  api_key             text UNIQUE NOT NULL,
  allowed_endpoints   TEXT[] DEFAULT '{}',
  rate_limit_per_day  integer NOT NULL DEFAULT 1000,
  academic_year       text NOT NULL,
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id      uuid REFERENCES university_licenses(id),
  course_name     text NOT NULL,
  course_code     text NOT NULL,
  lecturer_id     uuid UUID,
  student_ids     uuid[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_templates (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id         uuid REFERENCES course_integrations(id),
  title             text NOT NULL,
  tool_type         text NOT NULL,
  input_data        jsonb NOT NULL,
  expected_outputs  jsonb,
  allowed_attempts  integer DEFAULT 3,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS render_jobs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid UUID,
  project_id      uuid UUID REFERENCES projects(id),
  type            text NOT NULL,
  status          text NOT NULL DEFAULT 'QUEUED',
  input_data      jsonb NOT NULL,
  output_url      text,
  output_format   text NOT NULL DEFAULT 'PDF',
  point_count     integer,
  estimated_secs  integer,
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boundary_law_entries (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_type            text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  legal_framework       TEXT[] DEFAULT '{}',
  relevant_acts         TEXT[] DEFAULT '{}',
  case_law              TEXT[] DEFAULT '{}',
  procedure             text,
  typical_evidence      TEXT[] DEFAULT '{}',
  surveyor_role         text,
  browns_principle       text,
  common_pitfalls       TEXT[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dispute_procedures (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_type          text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  stages                TEXT[] DEFAULT '{}',
  jurisdiction          text NOT NULL,
  timeframe             text,
  estimated_cost        text,
  required_documents    TEXT[] DEFAULT '{}',
  mediation_steps       TEXT[] DEFAULT '{}',
  court_procedure       text,
  precedent_cases       TEXT[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adverse_possession_cases (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claimant_id           uuid UUID,
  parcel_id             text NOT NULL,
  adverse_type          text NOT NULL,
  start_date            date NOT NULL,
  end_date              date,
  duration              integer NOT NULL,
  meets_all_requirements BOOLEAN DEFAULT false,
  status                text DEFAULT 'PENDING',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adverse_possession_evidence (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id               uuid REFERENCES adverse_possession_cases(id),
  evidence_type         text NOT NULL,
  description           text NOT NULL,
  evidence_date         date NOT NULL,
  strength              text DEFAULT 'MODERATE',
  document_url          text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS easement_guidance (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  easement_type         text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  creation_methods      TEXT[] DEFAULT '{}',
  termination_methods   TEXT[] DEFAULT '{}',
  typical_disputes      TEXT[] DEFAULT '{}',
  surveyor_tasks        TEXT[] DEFAULT '{}',
  legal_requirements    TEXT[] DEFAULT '{}',
  kenya_specific        text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_check_reports (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id               text NOT NULL,
  user_id               uuid UUID,
  overall_pass          BOOLEAN DEFAULT false,
  score                 INTEGER DEFAULT 0,
  warnings              INTEGER DEFAULT 0,
  errors                INTEGER DEFAULT 0,
  suggestions           TEXT[] DEFAULT '{}',
  report_data           jsonb DEFAULT '{}',
  checked_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL UUID UUID REFERENCES projects(id),
  user_id uuid NOT NULL UUID,
  surveyor_profile_user_id uuid UUID ON DELETE SET NULL,
  submission_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  sequence_number integer,
  revision_number integer NOT NULL DEFAULT 0,
  submission_number text,
  package_status text NOT NULL DEFAULT 'draft'
    CONSTRAINT project_submissions_status_check
    CHECK (package_status IN ('draft',
  'collecting_documents',
  'ready_for_review',
  'ready_for_export',
  'exported')),
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  supporting_attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id,
  user_id,
  revision_number)
);

CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UUID UUID REFERENCES projects(id),
  file_name text NOT NULL,
  format text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending',
  'mapped',
  'committed',
  'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS online_service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UUID,
  project_id uuid UUID REFERENCES projects(id) NULL,
  service text NOT NULL,
  input_summary text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_sequence (
  surveyor_profile_id UUID NOT NULL REFERENCES surveyor_profiles(id),
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (surveyor_profile_id,
  year)
);

CREATE TABLE IF NOT EXISTS submission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UUID UUID REFERENCES projects(id),
  document_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending',
  'generating',
  'ready',
  'error')),
  file_url text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id,
  document_id)
);

CREATE TABLE IF NOT EXISTS project_beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UUID UUID REFERENCES projects(id),
  beacon_no text NOT NULL,
  easting numeric NOT NULL,
  northing numeric NOT NULL,
  rl numeric,
  description text,
  monument_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id,
  beacon_no)
);

CREATE TABLE IF NOT EXISTS project_fieldbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UUID UUID REFERENCES projects(id),
  row_index integer NOT NULL,
  station text,
  bs numeric,
  is numeric,
  fs numeric,
  rl numeric,
  instrument_height numeric,
  remark text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id,
  row_index)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email text unique not null,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid not null UUID UUID REFERENCES projects(id),
  name text not null,
  beacon_type text,
  easting double precision,
  northing double precision,
  elevation double precision,
  description text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leveling_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES leveling_runs(id),
  station_id text not null,
  back_sight double precision,
  intermediate_sight double precision,
  fore_sight double precision,
  reduced_level double precision,
  distance double precision,
  remarks text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Additional tables

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  epoch_name TEXT NOT NULL,
  epoch_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  name TEXT NOT NULL,
  geometry JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
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
