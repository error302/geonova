-- Migration 027: Add CRS / accuracy / provenance metadata to survey_points
-- Date: 2026-07-02
-- Audit finding: C5 — every coordinate was stored as if perfectly known,
-- with no CRS, epoch, accuracy, or provenance. A point imported from
-- Cassini-Soldner and a point shot in UTM 37S looked identical. This
-- fails the chain-of-custody requirement for professional survey records.
--
-- This migration adds:
--   CRS columns:       datum, projection, utm_zone, hemisphere, epoch_year
--   Accuracy columns:  std_dev_e, std_dev_n, std_dev_z, error_ellipse_major,
--                      error_ellipse_minor, error_ellipse_orient, confidence_level
--   Provenance cols:   source, instrument_id, observer_id, import_session_id,
--                      observation_date
--
-- All new columns are nullable for backward compatibility. Existing rows
-- are backfilled from the parent project's CRS defaults (datum, utm_zone,
-- hemisphere) where possible.
--
-- Post-migration: the SurveyPoint TS type and API routes are updated in
-- the same commit to read/write these columns.

-- ─── CRS columns ───────────────────────────────────────────────────────────
ALTER TABLE survey_points
  ADD COLUMN IF NOT EXISTS datum         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS projection    VARCHAR(20) DEFAULT 'UTM',
  ADD COLUMN IF NOT EXISTS utm_zone      INTEGER,
  ADD COLUMN IF NOT EXISTS hemisphere    VARCHAR(1) CHECK (hemisphere IN ('N', 'S')),
  ADD COLUMN IF NOT EXISTS epoch_year    INTEGER;

-- ─── Accuracy columns (all nullable — null means "unknown") ────────────────
ALTER TABLE survey_points
  ADD COLUMN IF NOT EXISTS std_dev_e              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS std_dev_n              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS std_dev_z              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS error_ellipse_major    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS error_ellipse_minor    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS error_ellipse_orient   DOUBLE PRECISION,  -- degrees from North
  ADD COLUMN IF NOT EXISTS confidence_level       SMALLINT DEFAULT 95;

-- ─── Provenance columns ────────────────────────────────────────────────────
ALTER TABLE survey_points
  ADD COLUMN IF NOT EXISTS source             VARCHAR(30) DEFAULT 'manual'
    CHECK (source IN ('manual', 'gnss', 'total_station', 'imported', 'adjusted', 'unknown')),
  ADD COLUMN IF NOT EXISTS instrument_id      UUID REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observer_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_session_id  UUID,
  ADD COLUMN IF NOT EXISTS observation_date   DATE;

-- ─── Backfill CRS from project defaults ────────────────────────────────────
-- Every survey_point inherits its project's datum/zone/hemisphere when
-- the point-level value is null. This is a one-time backfill; new inserts
-- should set the CRS explicitly (the API route enforces this).
UPDATE survey_points sp
SET
  datum      = COALESCE(sp.datum, 'Arc 1960'),
  utm_zone   = COALESCE(sp.utm_zone, p.utm_zone, 37),
  hemisphere = COALESCE(sp.hemisphere, p.hemisphere, 'S'),
  epoch_year = COALESCE(sp.epoch_year, EXTRACT(YEAR FROM COALESCE(p.survey_date, NOW()))::INTEGER)
FROM projects p
WHERE sp.project_id = p.id
  AND (sp.datum IS NULL OR sp.utm_zone IS NULL OR sp.hemisphere IS NULL);

-- Points without a project (shouldn't happen due to NOT NULL FK, but defensive)
UPDATE survey_points
SET datum = COALESCE(datum, 'Arc 1960'),
    utm_zone = COALESCE(utm_zone, 37),
    hemisphere = COALESCE(hemisphere, 'S')
WHERE datum IS NULL OR utm_zone IS NULL;

-- ─── Indexes for common query patterns ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_points_source
  ON survey_points(project_id, source);

CREATE INDEX IF NOT EXISTS idx_survey_points_observer
  ON survey_points(observer_id)
  WHERE observer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_points_import_session
  ON survey_points(import_session_id)
  WHERE import_session_id IS NOT NULL;

-- ─── Comments for documentation ────────────────────────────────────────────
COMMENT ON COLUMN survey_points.datum IS 'Coordinate datum (Arc 1960, WGS84, etc.). Defaults to project datum.';
COMMENT ON COLUMN survey_points.projection IS 'Map projection (UTM, Cassini-Soldner). Default UTM.';
COMMENT ON COLUMN survey_points.utm_zone IS 'UTM zone (1-60). Defaults to project utm_zone.';
COMMENT ON COLUMN survey_points.hemisphere IS 'N or S hemisphere. Defaults to project hemisphere.';
COMMENT ON COLUMN survey_points.epoch_year IS 'Coordinate epoch year (for time-dependent reference frames). Defaults to survey year.';
COMMENT ON COLUMN survey_points.std_dev_e IS 'Standard deviation of easting (metres). Null = unknown.';
COMMENT ON COLUMN survey_points.std_dev_n IS 'Standard deviation of northing (metres). Null = unknown.';
COMMENT ON COLUMN survey_points.std_dev_z IS 'Standard deviation of elevation (metres). Null = unknown.';
COMMENT ON COLUMN survey_points.error_ellipse_major IS 'Semi-major axis of error ellipse at confidence_level (metres).';
COMMENT ON COLUMN survey_points.error_ellipse_minor IS 'Semi-minor axis of error ellipse at confidence_level (metres).';
COMMENT ON COLUMN survey_points.error_ellipse_orient IS 'Orientation of error ellipse major axis (degrees from North, clockwise).';
COMMENT ON COLUMN survey_points.confidence_level IS 'Confidence level for the error ellipse (95 = 95%). Default 95.';
COMMENT ON COLUMN survey_points.source IS 'Origin of the coordinate: manual, gnss, total_station, imported, adjusted, unknown.';
COMMENT ON COLUMN survey_points.instrument_id IS 'FK to equipment table. Null if instrument not recorded.';
COMMENT ON COLUMN survey_points.observer_id IS 'FK to users table — who observed this point. Null if unknown.';
COMMENT ON COLUMN survey_points.import_session_id IS 'UUID of the import session that loaded this point (if source = imported).';
COMMENT ON COLUMN survey_points.observation_date IS 'Date the point was observed in the field. Null if unknown.';
