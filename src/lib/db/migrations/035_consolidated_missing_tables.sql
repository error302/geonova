-- Migration 035: Consolidated missing-tables migration
-- Date: 2026-07-03
--
-- This migration creates every table referenced by an API route but
-- not created by any earlier migration. The audit (AUDIT-UI-1 +
-- AUDIT-DEPS-2) found 20+ such tables. Rather than ship 20 small
-- migrations, this single migration creates them all in dependency
-- order so every API route can run without crashing on a missing
-- table.
--
-- Tables created (in order):
--   1. password_reset_tokens        (auth flow)
--   2. cpd_records                  (CPD tracking)
--   3. cpd_certificates             (CPD tracking)
--   4. cpd_activities               (audit log CPD branch)
--   5. cleaned_datasets             (AI data cleaning)
--   6. government_licenses          (admin licenses)
--   7. license_seats                (admin licenses)
--   8. white_label_configs          (white-label admin)
--   9. announcements                (admin announcements)
--  10. engineering_survey_data      (engineering project data)
--  11. cadastra_validations         (AI cadastra validate GET)
--  12. boundary_points              (sign-plan + DXF export)
--  13. adjacent_lots                (sign-plan + DXF export)
--  14. fence_offsets                (sign-plan + DXF export)
--  15. buildings                    (sign-plan + DXF export)
--  16. file_uploads                 (upload metadata)
--  17. error_logs                   (error telemetry)
--  18. nlims_cache                  (NLIMS submission cache)
--  19. quality_checks               (QA records)
--  20. webhooks                     (webhook config)
--  21. render_jobs                  (async render queue)
--  22. rim_parcels                  (RIM integration cache)
--  23. rim_beacons                  (RIM integration cache)
--
-- Plus ALTER TABLE projects to add columns the sign-plan route
-- expects (surveyor_licence, firm_*, drawing_no, etc.).
--
-- All tables use IF NOT EXISTS so this migration is safe to re-run.

-- ─── 1. password_reset_tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(128) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- ─── 2. cpd_records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpd_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity      VARCHAR(100) NOT NULL,
  points        NUMERIC(6,2) NOT NULL DEFAULT 0,
  description   TEXT,
  reference_id  VARCHAR(200),
  verifiable    BOOLEAN NOT NULL DEFAULT TRUE,
  earned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpd_records_user_year ON cpd_records(user_id, earned_at);

-- RLS for cpd_records (user-scoped)
ALTER TABLE cpd_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_cpd" ON cpd_records;
CREATE POLICY "self_cpd" ON cpd_records
  FOR ALL USING (user_id::text = current_setting('request.user_id', true))
  WITH CHECK (user_id::text = current_setting('request.user_id', true));

-- ─── 3. cpd_certificates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cpd_certificates (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year               INTEGER NOT NULL,
  total_points       NUMERIC(8,2) NOT NULL DEFAULT 0,
  verification_code  VARCHAR(32) NOT NULL UNIQUE,
  pdf_path           TEXT,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpd_certs_user_year ON cpd_certificates(user_id, year);
CREATE INDEX IF NOT EXISTS idx_cpd_certs_code ON cpd_certificates(verification_code);

-- ─── 4. cpd_activities (audit log branch) ───────────────────────────────────
-- Used by /api/audit-log to record CPD-related events separately
-- from cpd_records (which are the points themselves).
-- Column shape matches what /api/audit-log/route.ts inserts:
--   (user_id, title, provider, hours, category, source)
CREATE TABLE IF NOT EXISTS cpd_activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  provider    VARCHAR(255),
  hours       NUMERIC(5,2) DEFAULT 0,
  category    VARCHAR(100),
  source      VARCHAR(255),
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpd_activities_user ON cpd_activities(user_id, created_at DESC);

-- ─── 5. cleaned_datasets ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cleaned_datasets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_data           JSONB NOT NULL,
  cleaned_data       JSONB,
  anomalies          JSONB DEFAULT '[]',
  confidence_scores  JSONB DEFAULT '{}',
  data_type          VARCHAR(50),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cleaned_datasets_project ON cleaned_datasets(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleaned_datasets_user ON cleaned_datasets(user_id, created_at DESC);

-- ─── 6. government_licenses ─────────────────────────────────────────────────
-- Column shape matches /api/admin/licenses/[licenseId]/route.ts PUT body
-- (department_name, country, license_key, max_seats, used_seats, active,
--  issued_at, expires_at, features, contact_email, contact_name, tier).
CREATE TABLE IF NOT EXISTS government_licenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_name VARCHAR(255) NOT NULL,
  country         VARCHAR(100) NOT NULL,
  license_key     VARCHAR(255) NOT NULL,
  max_seats       INTEGER NOT NULL DEFAULT 10,
  used_seats      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  features        JSONB NOT NULL DEFAULT '[]',
  contact_email   VARCHAR(255),
  contact_name    VARCHAR(255),
  tier            VARCHAR(50) NOT NULL DEFAULT 'professional',  -- basic | professional | enterprise
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gov_licenses_active ON government_licenses(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_gov_licenses_country ON government_licenses(country, tier);

-- ─── 7. license_seats ───────────────────────────────────────────────────────
-- For floating / concurrent licenses (e.g., floating GIS seats).
CREATE TABLE IF NOT EXISTS license_seats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id      UUID NOT NULL REFERENCES government_licenses(id) ON DELETE CASCADE,
  seat_label      VARCHAR(100),
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_out_at  TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_license_seats_license ON license_seats(license_id);
CREATE INDEX IF NOT EXISTS idx_license_seats_user ON license_seats(assigned_to);

-- ─── 8. white_label_configs ─────────────────────────────────────────────────
-- Column shape matches what /api/white-label/route.ts inserts/selects.
-- (user_id is UNIQUE so the route's ON CONFLICT (user_id) DO UPDATE
-- works.)
CREATE TABLE IF NOT EXISTS white_label_configs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  organization_name   VARCHAR(120) NOT NULL DEFAULT 'METARDU',
  logo_url            TEXT,
  favicon_url         TEXT,
  primary_color       VARCHAR(7)  NOT NULL DEFAULT '#0EA5E9',
  custom_css          TEXT,
  custom_domain       VARCHAR(255),
  email_footer        TEXT,
  logo_file_key       VARCHAR(255),
  favicon_file_key    VARCHAR(255),
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_white_label_user ON white_label_configs(user_id);

-- ─── 9. announcements ───────────────────────────────────────────────────────
-- Column shape matches /api/admin/announcements/route.ts.
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL,
  target       VARCHAR(50) NOT NULL DEFAULT 'all',  -- all | pro | free | enterprise
  severity     VARCHAR(20) DEFAULT 'info',           -- info | warning | critical
  is_pinned    BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at DESC, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target, published_at DESC);

-- ─── 10. engineering_survey_data ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engineering_survey_data (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alignment_id    UUID,
  station_chainage  DOUBLE PRECISION,
  ground_level      DOUBLE PRECISION,
  design_level      DOUBLE PRECISION,
  cut_depth         DOUBLE PRECISION,
  fill_depth        DOUBLE PRECISION,
  cross_section     JSONB,
  metadata          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eng_data_project ON engineering_survey_data(project_id, alignment_id, station_chainage);

-- ─── 11. cadastra_validations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cadastra_validations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  parcel_number   VARCHAR(100),
  lr_number       VARCHAR(100),
  input_data      JSONB NOT NULL,
  result          JSONB,
  status          VARCHAR(50) DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cadastra_val_project ON cadastra_validations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadastra_val_user ON cadastra_validations(user_id, created_at DESC);

-- ─── 12. boundary_points ────────────────────────────────────────────────────
-- Used by sign-plan + DXF export. Each row is one vertex of a parcel
-- boundary, in sequence (for perimeter computation).
CREATE TABLE IF NOT EXISTS boundary_points (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence            INTEGER NOT NULL DEFAULT 0,
  name                VARCHAR(100) NOT NULL,
  easting             DOUBLE PRECISION NOT NULL,
  northing            DOUBLE PRECISION NOT NULL,
  elevation           DOUBLE PRECISION,
  monument_type       VARCHAR(50),     -- found | set | destroyed | not_found | referenced
  beacon_description  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_boundary_points_project ON boundary_points(project_id, sequence);

-- ─── 13. adjacent_lots ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adjacent_lots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boundary_points JSONB NOT NULL DEFAULT '[]',  -- [{name,easting,northing},...]
  plan_reference  VARCHAR(200),
  owner_name      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adjacent_lots_project ON adjacent_lots(project_id);

-- ─── 14. fence_offsets ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fence_offsets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_index   INTEGER NOT NULL DEFAULT 0,
  type            VARCHAR(50) DEFAULT 'fence_on_boundary',
  offset_metres   DOUBLE PRECISION NOT NULL DEFAULT 0,
  callout_text    VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fence_offsets_project ON fence_offsets(project_id, segment_index);

-- ─── 15. buildings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buildings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  easting         DOUBLE PRECISION NOT NULL,
  northing        DOUBLE PRECISION NOT NULL,
  width_m         DOUBLE PRECISION DEFAULT 10,
  height_m        DOUBLE PRECISION DEFAULT 8,
  rotation_deg    DOUBLE PRECISION DEFAULT 0,
  label           VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buildings_project ON buildings(project_id);

-- ─── 16. file_uploads ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  filename        VARCHAR(500) NOT NULL,
  storage_path    TEXT NOT NULL,
  mime_type       VARCHAR(200),
  size_bytes      BIGINT,
  sha256          VARCHAR(64),
  upload_purpose  VARCHAR(100),  -- mbtiles | parsers | deed | calibration | ...
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_project ON file_uploads(project_id, created_at DESC);

-- ─── 17. error_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  route           VARCHAR(500),
  method          VARCHAR(10),
  status_code     INTEGER,
  error_message   TEXT,
  stack_trace     TEXT,
  request_id      VARCHAR(100),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_route ON error_logs(route, created_at DESC);

-- ─── 18. nlims_cache ────────────────────────────────────────────────────────
-- Caches NLIMS submission responses so re-submits / retries are
-- idempotent and Survey-of-Kenya responses aren't re-fetched.
CREATE TABLE IF NOT EXISTS nlims_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  submission_id   VARCHAR(200),
  endpoint        VARCHAR(500),
  request_body    JSONB,
  response_body   JSONB,
  response_status INTEGER,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_nlims_cache_project ON nlims_cache(project_id, cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_nlims_cache_submission ON nlims_cache(submission_id);

-- ─── 19. quality_checks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  check_type      VARCHAR(100) NOT NULL,   -- closure | lsa | topology | rdm
  status          VARCHAR(50),             -- pass | fail | warn
  score           NUMERIC(6,3),
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_checks_project ON quality_checks(project_id, created_at DESC);

-- ─── 20. webhooks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID,
  url             TEXT NOT NULL,
  event_types     JSONB NOT NULL DEFAULT '[]',  -- ["parcel.updated", ...]
  secret          VARCHAR(255),
  is_active       BOOLEAN DEFAULT TRUE,
  last_triggered  TIMESTAMPTZ,
  last_status     INTEGER,
  failure_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active, event_types);

-- ─── 21. render_jobs ────────────────────────────────────────────────────────
-- Async rendering queue (large PDF / DXF / Shapefile exports).
CREATE TABLE IF NOT EXISTS render_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  job_type        VARCHAR(100) NOT NULL,  -- pdf | dxf | shp | ifc | ...
  status          VARCHAR(50) DEFAULT 'queued',  -- queued | running | complete | failed
  input_params    JSONB,
  output_path     TEXT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_render_jobs_user ON render_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status, created_at);

-- ─── 22. rim_parcels ────────────────────────────────────────────────────────
-- Cache of parcels fetched from the RIM (Registry Index Map) service.
CREATE TABLE IF NOT EXISTS rim_parcels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rim_id          VARCHAR(200) UNIQUE,
  parcel_number   VARCHAR(100),
  lr_number       VARCHAR(100),
  area_ha         NUMERIC(12,6),
  geom            GEOMETRY(POLYGON, 4326),
  metadata        JSONB DEFAULT '{}',
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rim_parcels_rim_id ON rim_parcels(rim_id);
CREATE INDEX IF NOT EXISTS idx_rim_parcels_parcel ON rim_parcels(parcel_number);

-- ─── 23. rim_beacons ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rim_beacons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rim_parcel_id   UUID REFERENCES rim_parcels(id) ON DELETE CASCADE,
  beacon_number   VARCHAR(100),
  beacon_type     VARCHAR(50),
  easting         DOUBLE PRECISION,
  northing        DOUBLE PRECISION,
  elevation       DOUBLE PRECISION,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rim_beacons_parcel ON rim_beacons(rim_parcel_id);

-- ─── ALTER projects to add columns the sign-plan route expects ──────────────
-- These columns let the sign-plan route read surveyor licence,
-- firm info, drawing number, etc. directly from the project row
-- without needing a separate query. All columns are nullable so
-- existing projects continue to work.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS surveyor_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS surveyor_licence   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS firm_name          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS firm_address       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS firm_phone         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS firm_email         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS drawing_no         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reference          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS plan_title         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS area_sqm           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS parcel_id          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS street             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS road_class         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS isk_reg_no         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS version            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sheet_no           INTEGER,
  ADD COLUMN IF NOT EXISTS total_sheets       INTEGER,
  ADD COLUMN IF NOT EXISTS north_rotation_deg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS plot_parcel_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS municipality       VARCHAR(255);

-- ─── Comments ───────────────────────────────────────────────────────────────
COMMENT ON TABLE password_reset_tokens     IS 'Time-limited tokens for the forgot-password flow';
COMMENT ON TABLE cpd_records               IS 'Continuing Professional Development points earned by a surveyor';
COMMENT ON TABLE cpd_certificates          IS 'Generated CPD certificates with verification codes';
COMMENT ON TABLE cpd_activities            IS 'Audit-log entries for CPD-related events';
COMMENT ON TABLE cleaned_datasets          IS 'AI-cleaned survey datasets with raw + cleaned + anomaly fields';
COMMENT ON TABLE government_licenses       IS 'Government-issued licenses (ISK, EBK, Survey of Kenya, etc.)';
COMMENT ON TABLE license_seats             IS 'Floating license seat assignments';
COMMENT ON TABLE white_label_configs       IS 'White-label branding overrides per user/organization';
COMMENT ON TABLE announcements             IS 'System-wide announcements shown to users';
COMMENT ON TABLE engineering_survey_data   IS 'Engineering survey cross-section / alignment data';
COMMENT ON TABLE cadastra_validations      IS 'AI-powered cadastral validation results';
COMMENT ON TABLE boundary_points           IS 'Parcel boundary vertices in sequence (for sign-plan + DXF)';
COMMENT ON TABLE adjacent_lots             IS 'Neighbouring parcels shown on a survey plan';
COMMENT ON TABLE fence_offsets             IS 'Fence offset callouts on a survey plan';
COMMENT ON TABLE buildings                 IS 'Building footprints rendered on a survey plan';
COMMENT ON TABLE file_uploads              IS 'Metadata for every uploaded file (mbtiles, parsers, etc.)';
COMMENT ON TABLE error_logs                IS 'Application error telemetry';
COMMENT ON TABLE nlims_cache               IS 'Cache of NLIMS submission responses for idempotency';
COMMENT ON TABLE quality_checks            IS 'QA check results (closure, LSA, topology, RDM)';
COMMENT ON TABLE webhooks                  IS 'Outbound webhook configurations';
COMMENT ON TABLE render_jobs               IS 'Async rendering queue for large exports';
COMMENT ON TABLE rim_parcels               IS 'Cached parcels fetched from the RIM service';
COMMENT ON TABLE rim_beacons               IS 'Cached beacons fetched from the RIM service';
