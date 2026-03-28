-- Enterprise Tables

CREATE TABLE organizations (
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

CREATE TABLE white_label_configs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE TABLE organization_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  role            text NOT NULL DEFAULT 'MEMBER',
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Government Tables
CREATE TABLE government_licenses (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid REFERENCES organizations(id),
  ministry          text NOT NULL,
  department        text,
  county            text,
  license_number    text UNIQUE NOT NULL,
  seat_count        integer NOT NULL,
  features          text[] DEFAULT '{}',
  audit_required    boolean DEFAULT true,
  data_residency    text DEFAULT 'KENYA',
  procurement_ref   text,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  contact_person    text,
  contact_email     text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE audit_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  user_id         uuid REFERENCES auth.users(id),
  action          text NOT NULL,
  resource_type   text NOT NULL,
  resource_id     uuid,
  metadata        jsonb DEFAULT '{}',
  ip_address      text,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage" ON organizations
  FOR ALL USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "members read org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "wl config access" ON white_label_configs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "members manage" ON organization_members
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "gov license access" ON government_licenses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org admins read audit" ON audit_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
