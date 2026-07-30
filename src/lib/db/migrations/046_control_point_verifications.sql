-- ────────────────────────────────────────────────────────────────────────────
-- 046_control_point_verifications.sql
--
-- Control Point Verification Workflow — provenance, trust, and on-site verification
--
-- A surveyor pulling a "known" control point doesn't know if it's been verified
-- recently or if it's been disturbed. This table tracks every verification event
-- so a surveyor can see: "This beacon was last verified on 2024-03-15 by ISK/1234,
-- condition: good, displacement: 2mm north (within tolerance)."
--
-- T1.5h (2026-07-10): Control point provenance/trust library — fully built
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Verification Records ───────────────────────────────────────────────────
-- Each record is one verification event for one control point.
-- A control point can be a survey_point (is_control=true), a beacon_registry entry,
-- or a boundary_monument. We use a polymorphic reference.

CREATE TABLE IF NOT EXISTS control_point_verifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Polymorphic reference to the control point
    point_type      VARCHAR(20) NOT NULL,  -- 'survey_point' | 'beacon' | 'boundary_monument'
    point_id        UUID NOT NULL,          -- FK to the respective table (not enforced because polymorphic)
    point_name      VARCHAR(100),           -- Cached name for display

    -- Verification details
    verification_date DATE NOT NULL,
    verified_by     UUID REFERENCES users(id),
    verifier_name   VARCHAR(200),
    verifier_license VARCHAR(100),          -- ISK license number

    -- On-site measurements
    measured_easting  DOUBLE PRECISION,
    measured_northing DOUBLE PRECISION,
    measured_elevation DOUBLE PRECISION,

    -- Comparison to published coordinates
    published_easting  DOUBLE PRECISION,
    published_northing DOUBLE PRECISION,
    published_elevation DOUBLE PRECISION,
    delta_e          DOUBLE PRECISION,      -- measured - published (meters)
    delta_n          DOUBLE PRECISION,
    delta_h          DOUBLE PRECISION,
    horizontal_displacement DOUBLE PRECISION, -- sqrt(dE² + dN²)

    -- Assessment
    condition        VARCHAR(50) NOT NULL DEFAULT 'good',
                     -- good | fair | poor | disturbed | destroyed | missing
    condition_notes  TEXT,
    displacement_status VARCHAR(50) DEFAULT 'within_tolerance',
                     -- within_tolerance | exceeds_tolerance | not_measured

    -- Equipment used
    instrument_used VARCHAR(200),
    method          VARCHAR(50),            -- 'gnss_static' | 'gnss_rtk' | 'total_station' | 'level'

    -- Photo evidence
    photo_url       VARCHAR(500),

    -- Recommendation
    recommendation  TEXT,                   -- e.g., "Re-establish beacon — 15mm displacement exceeds 5mm tolerance"

    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_point
    ON control_point_verifications(point_type, point_id);
CREATE INDEX IF NOT EXISTS idx_verifications_date
    ON control_point_verifications(verification_date DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_verifier
    ON control_point_verifications(verified_by);
CREATE INDEX IF NOT EXISTS idx_verifications_condition
    ON control_point_verifications(condition)
    WHERE condition != 'good';

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE control_point_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verifications_read_all" ON control_point_verifications;
CREATE POLICY "verifications_read_all" ON control_point_verifications
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "verifications_insert_own" ON control_point_verifications;
CREATE POLICY "verifications_insert_own" ON control_point_verifications
    FOR INSERT TO authenticated
    WITH CHECK (verified_by = current_user_id());

DROP POLICY IF EXISTS "verifications_update_own" ON control_point_verifications;
CREATE POLICY "verifications_update_own" ON control_point_verifications
    FOR UPDATE TO authenticated
    USING (verified_by = current_user_id());

COMMENT ON TABLE control_point_verifications IS 'Tracks every on-site verification of a control point. A surveyor can see the full verification history — who verified, when, what condition, and whether the point has moved — before deciding whether to trust it.';
COMMENT ON COLUMN control_point_verifications.displacement_status IS 'within_tolerance = displacement is within the project tolerance (typically 5mm for control, 25mm for construction). exceeds_tolerance = the point has moved beyond acceptable limits — do not use without re-establishment. not_measured = visual inspection only, no coordinate check.';
