-- 042_beacon_quality_columns.sql
-- Add quality and provenance columns to the existing beacon_registry table
-- (originally created in 020_beacon_equipment.sql) so that the network
-- adjustment engine can use registry beacons as weighted fixed points.
--
-- Why: The adjustment engine (src/lib/engine/networkAdjustment.ts) needs
-- per-beacon a priori standard deviations to weight observations correctly.
-- A Class A SKSK trig beacon (σ = 5mm) is far more reliable than a town
-- control point (σ = 20mm). Without sigma columns, all beacons would be
-- weighted equally, degrading adjustment quality.
--
-- Storage impact: ~24 bytes/row added. For 100,000 beacons, that's 2.4 MB.

ALTER TABLE beacon_registry
  ADD COLUMN IF NOT EXISTS sigma_e DOUBLE PRECISION DEFAULT 0.005,
  ADD COLUMN IF NOT EXISTS sigma_n DOUBLE PRECISION DEFAULT 0.005,
  ADD COLUMN IF NOT EXISTS sigma_rl DOUBLE PRECISION DEFAULT 0.010,
  ADD COLUMN IF NOT EXISTS source_confidence REAL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Populate lat/lon from easting/northing for existing rows (best-effort).
-- Arc 1960 / UTM 37S → WGS84. We don't do the full datum transformation here
-- (that requires Molodensky parameters); this is a rough inverse UTM that
-- gets within ~50m, sufficient for map display. Surveyors who need exact
-- WGS84 should set latitude/longitude directly.
--
-- NOTE: This UPDATE only runs once at migration time. New rows should
-- populate latitude/longitude directly via the API.
DO $$
BEGIN
  -- Only attempt if PostGIS is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    -- Use ST_Transform to convert from UTM 37S (SRID 21037) to WGS84 (SRID 4326)
    UPDATE beacon_registry
    SET latitude = ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(easting, northing), 21037), 4326)),
        longitude = ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(easting, northing), 21037), 4326))
    WHERE latitude IS NULL
      AND easting IS NOT NULL
      AND northing IS NOT NULL;
  END IF;
END $$;

-- Index for lat/lon queries (map display, spatial search)
CREATE INDEX IF NOT EXISTS idx_beacon_lat_lon
  ON beacon_registry(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for status-based filtering (most queries want 'good' beacons only)
CREATE INDEX IF NOT EXISTS idx_beacon_condition
  ON beacon_registry(condition)
  WHERE condition != 'good';

-- Update the find_nearby_beacons function to also return sigma columns.
-- PostgreSQL cannot use CREATE OR REPLACE when widening the return type
-- or changing the LANGUAGE (plpgsql → sql), so we DROP first then CREATE.
-- The new signature preserves locality (from migration 020) and adds
-- sigma_e / sigma_n / sigma_rl / source_confidence.
DROP FUNCTION IF EXISTS find_nearby_beacons(
  DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER
);

CREATE FUNCTION find_nearby_beacons(
  p_easting DOUBLE PRECISION,
  p_northing DOUBLE PRECISION,
  p_radius_m INTEGER DEFAULT 500,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  beacon_number VARCHAR,
  beacon_type VARCHAR,
  easting DOUBLE PRECISION,
  northing DOUBLE PRECISION,
  elevation DOUBLE PRECISION,
  sigma_e DOUBLE PRECISION,
  sigma_n DOUBLE PRECISION,
  sigma_rl DOUBLE PRECISION,
  source_confidence REAL,
  county VARCHAR,
  locality TEXT,
  condition VARCHAR,
  distance_m DOUBLE PRECISION
) AS $$
  SELECT
    b.id,
    b.beacon_number,
    b.beacon_type,
    b.easting,
    b.northing,
    b.elevation,
    b.sigma_e,
    b.sigma_n,
    b.sigma_rl,
    b.source_confidence,
    b.county,
    b.locality,
    b.condition,
    SQRT(POWER(b.easting - p_easting, 2) + POWER(b.northing - p_northing, 2)) AS distance_m
  FROM beacon_registry b
  WHERE b.easting IS NOT NULL
    AND b.northing IS NOT NULL
    AND b.condition = 'good'
    AND SQRT(POWER(b.easting - p_easting, 2) + POWER(b.northing - p_northing, 2)) <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

COMMENT ON COLUMN beacon_registry.sigma_e IS 'A priori standard deviation of easting (meters). Used as weight in network adjustment. Default 5mm for SKSK trig, 20mm for town control.';
COMMENT ON COLUMN beacon_registry.sigma_n IS 'A priori standard deviation of northing (meters).';
COMMENT ON COLUMN beacon_registry.sigma_rl IS 'A priori standard deviation of elevation (meters).';
COMMENT ON COLUMN beacon_registry.source_confidence IS '0-1 scale. KSD official = 1.0, user_verified = 0.7, imported unverified = 0.5. Used to weight observations in adjustment.';
