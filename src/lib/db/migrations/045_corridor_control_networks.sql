-- ────────────────────────────────────────────────────────────────────────────
-- 045_corridor_control_networks.sql
--
-- Corridor Control Networks — shared, versioned control for KeNHA corridors
--
-- On a KeNHA road project, multiple contractors submit survey data against
-- the same corridor control network. This table stores versioned control
-- networks with full audit trails. Each contractor's submission is checked
-- against the same tolerance rules automatically.
--
-- T1.5f (2026-07-10): Phase 4 — corridor/chainage mode
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS corridor_control_networks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    corridor_name   VARCHAR(200),           -- e.g., 'A8 Nairobi-Nakuru Highway'
    start_chainage  DOUBLE PRECISION,       -- meters
    end_chainage    DOUBLE PRECISION,       -- meters

    -- Versioning
    version         INTEGER NOT NULL DEFAULT 1,
    parent_version_id UUID REFERENCES corridor_control_networks(id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Control
    utm_zone        INTEGER NOT NULL DEFAULT 37,
    hemisphere      VARCHAR(1) NOT NULL DEFAULT 'S',
    datum           VARCHAR(50) NOT NULL DEFAULT 'Arc 1960',
    epsg_code       VARCHAR(20) NOT NULL DEFAULT 'EPSG:21037',

    -- Metadata
    established_by  VARCHAR(200),
    approved_by     VARCHAR(200),
    approved_date   DATE,
    status          VARCHAR(50) DEFAULT 'draft',  -- draft | submitted | approved | superseded

    -- Audit
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_corridor_networks_name
    ON corridor_control_networks(corridor_name);
CREATE INDEX IF NOT EXISTS idx_corridor_networks_active
    ON corridor_control_networks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_corridor_networks_version
    ON corridor_control_networks(name, version);

-- ─── Control Points within a Corridor Network ───────────────────────────────

CREATE TABLE IF NOT EXISTS corridor_control_points (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id      UUID NOT NULL REFERENCES corridor_control_networks(id) ON DELETE CASCADE,
    point_name      VARCHAR(100) NOT NULL,
    point_type      VARCHAR(50) NOT NULL DEFAULT 'traverse',
                    -- traverse | bm | gps | pillar | peg
    easting         DOUBLE PRECISION NOT NULL,
    northing        DOUBLE PRECISION NOT NULL,
    elevation       DOUBLE PRECISION,
    chainage        DOUBLE PRECISION,       -- position along corridor
    "offset"        DOUBLE PRECISION DEFAULT 0, -- offset from centerline

    -- Accuracy
    sigma_e         DOUBLE PRECISION,
    sigma_n         DOUBLE PRECISION,
    sigma_h         DOUBLE PRECISION,
    "order"         VARCHAR(50),            -- First Order, Second Order, etc.

    -- Epoch
    epoch_year      INTEGER,
    observation_date DATE,

    -- Physical
    description     TEXT,
    condition       VARCHAR(50) DEFAULT 'good',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(network_id, point_name)
);

CREATE INDEX IF NOT EXISTS idx_corridor_points_network
    ON corridor_control_points(network_id);
CREATE INDEX IF NOT EXISTS idx_corridor_points_chainage
    ON corridor_control_points(chainage);

-- ─── Contractor Submissions against a Corridor Network ──────────────────────

CREATE TABLE IF NOT EXISTS corridor_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id      UUID NOT NULL REFERENCES corridor_control_networks(id) ON DELETE CASCADE,
    contractor_name VARCHAR(200) NOT NULL,
    contractor_user_id UUID REFERENCES users(id),
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chainage_start  DOUBLE PRECISION,
    chainage_end    DOUBLE PRECISION,
    survey_type     VARCHAR(50),            -- setting_out | as_built | monitoring | cross_section
    status          VARCHAR(50) DEFAULT 'pending',  -- pending | checked | approved | rejected
    tolerance_h     DOUBLE PRECISION DEFAULT 0.025, -- ±25mm
    tolerance_v     DOUBLE PRECISION DEFAULT 0.015, -- ±15mm
    passed          BOOLEAN,
    report          JSONB,                  -- full comparison report
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corridor_submissions_network
    ON corridor_submissions(network_id);
CREATE INDEX IF NOT EXISTS idx_corridor_submissions_status
    ON corridor_submissions(status);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE corridor_control_networks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "corridor_networks_read_all" ON corridor_control_networks;
CREATE POLICY "corridor_networks_read_all" ON corridor_control_networks
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "corridor_networks_insert_own" ON corridor_control_networks;
CREATE POLICY "corridor_networks_insert_own" ON corridor_control_networks
    FOR INSERT TO authenticated WITH CHECK (created_by = current_user_id());
DROP POLICY IF EXISTS "corridor_networks_update_own" ON corridor_control_networks;
CREATE POLICY "corridor_networks_update_own" ON corridor_control_networks
    FOR UPDATE TO authenticated USING (created_by = current_user_id());

ALTER TABLE corridor_control_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "corridor_points_read_all" ON corridor_control_points;
CREATE POLICY "corridor_points_read_all" ON corridor_control_points
    FOR SELECT TO authenticated USING (true);

ALTER TABLE corridor_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "corridor_submissions_read_all" ON corridor_submissions;
CREATE POLICY "corridor_submissions_read_all" ON corridor_submissions
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "corridor_submissions_insert_own" ON corridor_submissions;
CREATE POLICY "corridor_submissions_insert_own" ON corridor_submissions
    FOR INSERT TO authenticated WITH CHECK (contractor_user_id = current_user_id());

COMMENT ON TABLE corridor_control_networks IS 'Versioned corridor control networks for KeNHA-scale road projects. Multiple contractors submit survey data against the same versioned control network.';
COMMENT ON COLUMN corridor_control_networks.version IS 'Version number. When a network is updated, a new version is created and the old one is marked is_active=FALSE. This ensures all submissions can be traced back to the exact control network version they were checked against.';
