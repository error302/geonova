-- ────────────────────────────────────────────────────────────────────────────
-- 044_boundary_monuments.sql
--
-- Boundary Monument Management — international/bilateral boundary markers
--
-- This table is distinct from `beacon_registry` (cadastral beacons) and
-- `survey_points` (project survey points). Boundary monuments are physical
-- markers on international or sub-national boundaries, established under
-- treaty or commission authority. They carry:
--   - Treaty citation (the legal basis for the boundary)
--   - Coordinate with full epoch + covariance (time-dependent)
--   - Physical description + condition log
--   - Bilateral commission verification status
--
-- T1.5e (2026-07-10): Country-boundary-grade trust — a surveyor working on
-- a bilateral boundary needs to see which treaty established this monument,
-- when it was last verified, and what its coordinate epoch is.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boundary_monuments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ─── Identification ───
    monument_number     VARCHAR(100) NOT NULL,           -- e.g., 'KEN-TZ-042'
    monument_type       VARCHAR(50) NOT NULL DEFAULT 'pillar',
                        -- pillar | beacon | cairn | wall | river_mark | other
    boundary_name       VARCHAR(200) NOT NULL,           -- e.g., 'Kenya-Tanzania'
    treaty_reference    VARCHAR(500) NOT NULL,             -- e.g., 'Anglo-German Agreement 1886, Article III'
    treaty_date         DATE,                            -- when the treaty was signed

    -- ─── Coordinates (time-dependent) ───
    latitude            DOUBLE PRECISION,                -- WGS84 degrees
    longitude           DOUBLE PRECISION,                -- WGS84 degrees
    elevation           DOUBLE PRECISION,                -- meters
    easting             DOUBLE PRECISION,                -- UTM meters
    northing            DOUBLE PRECISION,                -- UTM meters
    utm_zone            INTEGER NOT NULL DEFAULT 37,
    hemisphere          VARCHAR(1) NOT NULL DEFAULT 'S',
    datum               VARCHAR(50) NOT NULL DEFAULT 'Arc 1960',
    epsg_code           VARCHAR(20) NOT NULL DEFAULT 'EPSG:21037',

    -- ─── Epoch + Reference Frame ───
    coordinate_epoch    DOUBLE PRECISION,                -- decimal year (e.g., 2025.5)
    reference_frame     VARCHAR(50) DEFAULT 'ITRF2014',  -- ITRF2014 | ITRF2008 | WGS84
    observation_date    DATE,                            -- when the coordinate was observed

    -- ─── Accuracy (full covariance) ───
    sigma_e             DOUBLE PRECISION,                -- standard deviation East (meters)
    sigma_n             DOUBLE PRECISION,                -- standard deviation North
    sigma_h             DOUBLE PRECISION,                -- standard deviation Height
    sigma_en            DOUBLE PRECISION DEFAULT 0,      -- covariance E-N
    confidence_level    DOUBLE PRECISION DEFAULT 0.95,   -- 95% confidence

    -- ─── Physical Description ───
    physical_description TEXT,                           -- e.g., 'Concrete pillar 15cm × 15cm × 60cm with brass plate'
    material            VARCHAR(50),                     -- concrete | metal | stone | other
    dimensions          VARCHAR(100),                    -- e.g., '15×15×60 cm'
    marker_text         TEXT,                            -- inscription on the monument
    photo_url           VARCHAR(500),                    -- path to photo in storage

    -- ─── Location ───
    county              VARCHAR(100),
    sub_county          VARCHAR(100),
    locality            TEXT,
    sheet_number        VARCHAR(50),                     -- map sheet reference

    -- ─── Condition Log ───
    condition           VARCHAR(50) DEFAULT 'good',
                        -- good | fair | poor | destroyed | missing | restored
    condition_notes     TEXT,
    last_inspected_date DATE,
    last_inspected_by   UUID REFERENCES users(id),

    -- ─── Bilateral Commission Verification ───
    verification_status VARCHAR(50) DEFAULT 'pending',
                        -- pending | verified | disputed | re_established
    verified_by         VARCHAR(200),                    -- commission name
    verified_date       DATE,
    verification_notes  TEXT,

    -- ─── Audit ───
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ─── Spatial ───
    geom                GEOMETRY(POINT, 4326),

    -- ─── Metadata ───
    metadata            JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boundary_monuments_boundary
    ON boundary_monuments(boundary_name);

CREATE INDEX IF NOT EXISTS idx_boundary_monuments_number
    ON boundary_monuments(monument_number);

CREATE INDEX IF NOT EXISTS idx_boundary_monuments_verification
    ON boundary_monuments(verification_status)
    WHERE verification_status != 'verified';

CREATE INDEX IF NOT EXISTS idx_boundary_monuments_geom
    ON boundary_monuments USING GIST (geom)
    WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boundary_monuments_created_by
    ON boundary_monuments(created_by);

-- ─── RLS Policies ───
ALTER TABLE boundary_monuments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read boundary monuments (they're public record)
DROP POLICY IF EXISTS "boundary_monuments_read_all" ON boundary_monuments;
CREATE POLICY "boundary_monuments_read_all" ON boundary_monuments
    FOR SELECT TO authenticated
    USING (true);

-- Only the creator or admins can create/update
DROP POLICY IF EXISTS "boundary_monuments_insert_own" ON boundary_monuments;
CREATE POLICY "boundary_monuments_insert_own" ON boundary_monuments
    FOR INSERT TO authenticated
    WITH CHECK (created_by = current_user_id());

DROP POLICY IF EXISTS "boundary_monuments_update_own" ON boundary_monuments;
CREATE POLICY "boundary_monuments_update_own" ON boundary_monuments
    FOR UPDATE TO authenticated
    USING (created_by = current_user_id())
    WITH CHECK (created_by = current_user_id());

DROP POLICY IF EXISTS "boundary_monuments_delete_own" ON boundary_monuments;
CREATE POLICY "boundary_monuments_delete_own" ON boundary_monuments
    FOR DELETE TO authenticated
    USING (created_by = current_user_id());

-- ─── Condition Log Table ───
CREATE TABLE IF NOT EXISTS boundary_monument_inspections (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monument_id         UUID NOT NULL REFERENCES boundary_monuments(id) ON DELETE CASCADE,
    inspection_date     DATE NOT NULL,
    inspector_id        UUID REFERENCES users(id),
    inspector_name      VARCHAR(200),
    condition           VARCHAR(50) NOT NULL,            -- good | fair | poor | destroyed | missing | restored
    condition_notes     TEXT,
    photo_url           VARCHAR(500),
    action_taken        TEXT,                            -- e.g., 'Re-painted marker', 'Re-established pillar 2m north'
    next_inspection_due DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monument_inspections_monument
    ON boundary_monument_inspections(monument_id);
CREATE INDEX IF NOT EXISTS idx_monument_inspections_date
    ON boundary_monument_inspections(inspection_date DESC);

ALTER TABLE boundary_monument_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monument_inspections_read_all" ON boundary_monument_inspections;
CREATE POLICY "monument_inspections_read_all" ON boundary_monument_inspections
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "monument_inspections_insert_own" ON boundary_monument_inspections;
CREATE POLICY "monument_inspections_insert_own" ON boundary_monument_inspections
    FOR INSERT TO authenticated
    WITH CHECK (inspector_id = current_user_id());

-- ─── Comments ───
COMMENT ON TABLE boundary_monuments IS 'International/bilateral boundary monuments — physical markers on treaty boundaries, distinct from cadastral beacons. Each monument has a treaty citation, coordinate with epoch + covariance, physical description, condition log, and bilateral commission verification status.';
COMMENT ON COLUMN boundary_monuments.coordinate_epoch IS 'Decimal year when the coordinate was observed (e.g., 2025.5 = July 2025). Used for plate velocity propagation via the Epoch Manager.';
COMMENT ON COLUMN boundary_monuments.reference_frame IS 'ITRF realization or WGS84 version. Coordinates from different frames/epochs are NOT directly comparable — propagate to a common epoch first.';
COMMENT ON COLUMN boundary_monuments.verification_status IS 'Bilateral commission verification: pending = not yet verified, verified = commission confirmed, disputed = commission flagged discrepancy, re_established = monument was destroyed and re-established';
