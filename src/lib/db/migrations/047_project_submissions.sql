-- ────────────────────────────────────────────────────────────────────────────
-- 047_project_submissions.sql
--
-- P2-1 Phase 13 Milestone A (2026-07-24): Canonical submission domain model.
-- One project → one submission record → one complete package.
--
-- References:
--   - docs/PHASE13_SUBMISSION_PACKAGE_HANDOFF.md Workstream 1
--   - SRVY2025-1 submission number format: [RegNo]_[YYYY]_[###]_[R##]
--   - Survey Act Cap. 299, Survey Regulations 1994
--
-- Adapted from the handoff doc's Supabase syntax to raw PostgreSQL
-- (METARDU uses pg Pool, not Supabase client). RLS uses request.user_id
-- via the AsyncLocalStorage pattern in src/lib/db.ts.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── 1. project_submissions table ─────────────────────────────────────────
-- Maps one project to one persistent submission record. The submission
-- tracks the 8 benchmark sections, generated artifacts, supporting
-- attachments, and validation results.

CREATE TABLE IF NOT EXISTS project_submissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    surveyor_profile_id UUID REFERENCES surveyor_profiles(id),
    submission_number   TEXT NOT NULL,           -- e.g. "RS149_2025_002_R00"
    revision_code       TEXT NOT NULL DEFAULT 'R00',
    submission_year     INTEGER NOT NULL,
    package_status      TEXT NOT NULL DEFAULT 'draft'
                        CHECK (package_status IN ('draft', 'incomplete', 'ready', 'submitted')),
    required_sections   JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
    supporting_attachments JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_results  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One submission per project (enforced by unique constraint)
    UNIQUE (project_id)
);

-- Index for lookup by surveyor
CREATE INDEX IF NOT EXISTS idx_project_submissions_surveyor
    ON project_submissions(surveyor_profile_id, submission_year);

-- Index for lookup by submission number
CREATE INDEX IF NOT EXISTS idx_project_submissions_number
    ON project_submissions(submission_number);

-- ─── 2. RLS for project_submissions ────────────────────────────────────────
-- Access via the project's user_id, matching the existing RLS pattern.

ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_submissions_owner_access ON project_submissions
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = current_setting('request.user_id', true)::uuid
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE user_id = current_setting('request.user_id', true)::uuid
        )
    );

-- ─── 3. submission_sequence table ─────────────────────────────────────────
-- Per-surveyor, per-year atomic sequence for submission numbering.
-- The PL/pgSQL function below atomically increments and returns the
-- next sequence number, preventing race conditions when multiple
-- submissions are created concurrently.

CREATE TABLE IF NOT EXISTS submission_sequence (
    surveyor_profile_id UUID NOT NULL REFERENCES surveyor_profiles(id) ON DELETE CASCADE,
    year                INTEGER NOT NULL,
    last_sequence       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (surveyor_profile_id, year)
);

ALTER TABLE submission_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY submission_sequence_owner_access ON submission_sequence
    FOR ALL
    USING (
        surveyor_profile_id IN (
            SELECT id FROM surveyor_profiles WHERE user_id = current_setting('request.user_id', true)::uuid
        )
    )
    WITH CHECK (
        surveyor_profile_id IN (
            SELECT id FROM surveyor_profiles WHERE user_id = current_setting('request.user_id', true)::uuid
        )
    );

-- ─── 4. Atomic sequence increment function ────────────────────────────────
-- Called by src/lib/submission/numbering.ts to atomically get the next
-- sequence number for a surveyor in a given year. Uses INSERT ... ON
-- CONFLICT for upsert + RETURNING to guarantee atomicity.

CREATE OR REPLACE FUNCTION increment_submission_sequence(
    p_surveyor_profile_id UUID,
    p_year INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    INSERT INTO submission_sequence (surveyor_profile_id, year, last_sequence)
    VALUES (p_surveyor_profile_id, p_year, 1)
    ON CONFLICT (surveyor_profile_id, year)
    DO UPDATE SET last_sequence = submission_sequence.last_sequence + 1
    RETURNING last_sequence INTO v_next_seq;

    RETURN v_next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. updated_at trigger ─────────────────────────────────────────────────
-- Auto-update updated_at on every row change.

CREATE TRIGGER trg_project_submissions_updated_at
    BEFORE UPDATE ON project_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. Audit chain support ───────────────────────────────────────────────
-- project_submissions is a statutory entity — all mutations should be
-- logged to the tamper-evident audit_chain via the apiHandler auditChain
-- option.

COMMENT ON TABLE project_submissions IS 'P2-1 Phase 13: Canonical submission record. One project → one submission → one package. Tracks 8 benchmark sections per SRVY2025-1.';
COMMENT ON TABLE submission_sequence IS 'P2-1 Phase 13: Per-surveyor per-year atomic sequence for submission numbering. Format: [RegNo]_[YYYY]_[###]_[R##].';
