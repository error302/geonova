-- Land Law Intelligence Tables

-- Boundary Law Knowledge Base
CREATE TABLE boundary_law_entries (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_type            text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  legal_framework       text[] DEFAULT '{}',
  relevant_acts         text[] DEFAULT '{}',
  case_law              text[] DEFAULT '{}',
  procedure             text,
  typical_evidence      text[] DEFAULT '{}',
  surveyor_role         text,
  browns_principle       text,
  common_pitfalls       text[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_boundary_law_issue_type ON boundary_law_entries(issue_type);

-- Dispute Procedures
CREATE TABLE dispute_procedures (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_type          text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  stages                text[] DEFAULT '{}',
  jurisdiction          text NOT NULL,
  timeframe             text,
  estimated_cost        text,
  required_documents    text[] DEFAULT '{}',
  mediation_steps       text[] DEFAULT '{}',
  court_procedure       text,
  precedent_cases       text[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_dispute_procedures_type ON dispute_procedures(dispute_type);

-- Adverse Possession Cases
CREATE TABLE adverse_possession_cases (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claimant_id           uuid REFERENCES auth.users(id),
  parcel_id             text NOT NULL,
  adverse_type          text NOT NULL,
  start_date            date NOT NULL,
  end_date              date,
  duration              integer NOT NULL,
  meets_all_requirements boolean DEFAULT false,
  status                text DEFAULT 'PENDING',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE adverse_possession_evidence (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id               uuid REFERENCES adverse_possession_cases(id) ON DELETE CASCADE,
  evidence_type         text NOT NULL,
  description           text NOT NULL,
  evidence_date         date NOT NULL,
  strength              text DEFAULT 'MODERATE',
  document_url          text,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_adverse_possession_claimant ON adverse_possession_cases(claimant_id);
CREATE INDEX idx_adverse_possession_parcel ON adverse_possession_cases(parcel_id);

-- Easement Guidance
CREATE TABLE easement_guidance (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  easement_type         text NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  creation_methods      text[] DEFAULT '{}',
  termination_methods   text[] DEFAULT '{}',
  typical_disputes      text[] DEFAULT '{}',
  surveyor_tasks        text[] DEFAULT '{}',
  legal_requirements    text[] DEFAULT '{}',
  kenya_specific        text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_easement_guidance_type ON easement_guidance(easement_type);

-- Plan Check Reports
CREATE TABLE plan_check_reports (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id               text NOT NULL,
  user_id               uuid REFERENCES auth.users(id),
  overall_pass          boolean DEFAULT false,
  score                 integer DEFAULT 0,
  warnings              integer DEFAULT 0,
  errors                integer DEFAULT 0,
  suggestions           text[] DEFAULT '{}',
  report_data           jsonb DEFAULT '{}',
  checked_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_plan_check_reports_plan ON plan_check_reports(plan_id);
CREATE INDEX idx_plan_check_reports_user ON plan_check_reports(user_id);

-- RLS
ALTER TABLE boundary_law_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE adverse_possession_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE adverse_possession_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE easement_guidance ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_check_reports ENABLE ROW LEVEL SECURITY;

-- Public read access for knowledge base tables
CREATE POLICY "public read boundary law" ON boundary_law_entries FOR SELECT USING (true);
CREATE POLICY "public read disputes" ON dispute_procedures FOR SELECT USING (true);
CREATE POLICY "public read easement" ON easement_guidance FOR SELECT USING (true);

-- Users can manage their own adverse possession cases
CREATE POLICY "users manage adverse possession" ON adverse_possession_cases
  FOR ALL USING (auth.uid() = claimant_id);

CREATE POLICY "users manage evidence" ON adverse_possession_evidence
  FOR ALL USING (
    case_id IN (
      SELECT id FROM adverse_possession_cases WHERE claimant_id = auth.uid()
    )
  );

-- Users can manage their own plan check reports
CREATE POLICY "users manage plan checks" ON plan_check_reports
  FOR ALL USING (auth.uid() = user_id);
