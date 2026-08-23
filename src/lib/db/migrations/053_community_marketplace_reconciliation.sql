-- 053_community_marketplace_reconciliation.sql
-- Closes remaining schema-drift baseline (scripts/schema-drift-baseline.json:12)
-- for community/marketplace code paths that selected columns/tables not in any migration.
-- All IF NOT EXISTS — safe re-run on live Oracle VM.

-- ── peer_reviews: 9 missing cols selected by src/lib/marketplace/peerReview.ts etc ─
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS attachment_note   text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS category          text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS comment           text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS posted_at         timestamptz NOT NULL DEFAULT now();
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS rating            integer;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS request_id        uuid;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS reviewer_name     text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS reviewer_title    text;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS submitter_contact text;

-- ── Wildcard selects: jobs.*, job_reviews.*, survey_jobs.* ───────────────
-- These tables are marketplace/community but may not exist on older prod DBs.
CREATE TABLE IF NOT EXISTS jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  description text,
  status     text,
  owner_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid REFERENCES jobs(id) ON DELETE CASCADE,
  rating     integer,
  comment    text,
  reviewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  description text,
  status     text NOT NULL DEFAULT 'OPEN',
  awarded_to uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
