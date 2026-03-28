-- Payment Tables

CREATE TABLE payment_intents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id),
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

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payments" ON payment_intents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "create payments" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_payments_user ON payment_intents(user_id);
CREATE INDEX idx_payments_status ON payment_intents(status);
CREATE INDEX idx_payments_purpose ON payment_intents(purpose);

-- University Tables
CREATE TABLE university_licenses (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid REFERENCES organizations(id),
  university_name     text NOT NULL,
  department          text NOT NULL,
  country             text NOT NULL,
  student_seat_count  integer NOT NULL,
  lecturer_seat_count integer NOT NULL,
  api_key             text UNIQUE NOT NULL,
  allowed_endpoints   text[] DEFAULT '{}',
  rate_limit_per_day  integer NOT NULL DEFAULT 1000,
  academic_year       text NOT NULL,
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE course_integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id      uuid REFERENCES university_licenses(id) ON DELETE CASCADE,
  course_name     text NOT NULL,
  course_code     text NOT NULL,
  lecturer_id     uuid REFERENCES auth.users(id),
  student_ids     uuid[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE assignment_templates (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id         uuid REFERENCES course_integrations(id) ON DELETE CASCADE,
  title             text NOT NULL,
  tool_type         text NOT NULL,
  input_data        jsonb NOT NULL,
  expected_outputs  jsonb,
  allowed_attempts  integer DEFAULT 3,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE university_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uni admin manage" ON university_licenses
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "uni courses manage" ON course_integrations
  FOR ALL USING (
    lecturer_id = auth.uid() OR
    license_id IN (
      SELECT id FROM university_licenses
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role = 'ADMIN'
      )
    )
  );
