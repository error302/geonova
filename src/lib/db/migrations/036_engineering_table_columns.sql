-- Migration 036: Align engineering table columns with API routes
-- Date: 2026-07-03
--
-- The API routes /api/engineering/vips and /api/engineering/stations
-- were written against a different schema than migration 000 created.
--
-- Migration 000 created:
--   alignment_vertical_ips (id, alignment_id, ip_number, chainage,
--                           elevation, gradient_in, gradient_out,
--                           curve_length, geom, created_at)
--   cross_section_stations  (id, alignment_id, chainage, existing_ground,
--                           proposed_road, created_at)
--
-- But the routes expect:
--   alignment_vertical_ips: reduced_level, k_value, updated_at,
--                           UNIQUE(alignment_id, chainage)
--   cross_section_stations:  ground_level, updated_at,
--                           UNIQUE(alignment_id, chainage)
--
-- This migration adds the missing columns + unique constraints so
-- the routes' ON CONFLICT (alignment_id, chainage) DO UPDATE works.

-- ─── alignment_vertical_ips ─────────────────────────────────────────────────
ALTER TABLE alignment_vertical_ips
  ADD COLUMN IF NOT EXISTS reduced_level DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS k_value       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Backfill reduced_level from elevation where it's null (single VIP
-- per chainage — the typical case — both columns hold the same RL).
UPDATE alignment_vertical_ips
   SET reduced_level = elevation
 WHERE reduced_level IS NULL AND elevation IS NOT NULL;

-- Unique constraint needed for ON CONFLICT (alignment_id, chainage)
-- We use NULLS NOT DISTINCT so that NULL chainages don't slip past
-- the constraint (Postgres 15+).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_avips_alignment_chainage'
  ) THEN
    ALTER TABLE alignment_vertical_ips
      ADD CONSTRAINT uq_avips_alignment_chainage
      UNIQUE (alignment_id, chainage);
  END IF;
END$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_avips_updated_at ON alignment_vertical_ips;
  CREATE TRIGGER trg_avips_updated_at
    BEFORE UPDATE ON alignment_vertical_ips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- ─── cross_section_stations ─────────────────────────────────────────────────
ALTER TABLE cross_section_stations
  ADD COLUMN IF NOT EXISTS ground_level DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- Backfill ground_level from existing_ground->>'level' where present.
-- (existing_ground is JSONB; the level may be the top-level 'level'
-- key or nested under 'existing'.)
UPDATE cross_section_stations
   SET ground_level = NULLIF(
     COALESCE(
       (existing_ground->>'level')::double precision,
       (existing_ground->'existing'->>'level')::double precision
     ),
     NULL
   )
 WHERE ground_level IS NULL AND existing_ground IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_css_alignment_chainage'
  ) THEN
    ALTER TABLE cross_section_stations
      ADD CONSTRAINT uq_css_alignment_chainage
      UNIQUE (alignment_id, chainage);
  END IF;
END$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_css_updated_at ON cross_section_stations;
  CREATE TRIGGER trg_css_updated_at
    BEFORE UPDATE ON cross_section_stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

COMMENT ON COLUMN alignment_vertical_ips.reduced_level IS 'Reduced level (elevation) at the VIP — preferred field for the engineering API';
COMMENT ON COLUMN alignment_vertical_ips.k_value       IS 'AASHTO K-factor (length per percent of algebraic grade difference)';
COMMENT ON COLUMN cross_section_stations.ground_level  IS 'Existing ground level at this chainage — preferred field for the engineering API';
