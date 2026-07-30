-- Migration 023: Drop mining + hydro tables (v1 scope narrowing)
-- ====================================================================
-- Metardu v1 has been narrowed to three core survey types:
--   cadastral, engineering, topographic (+ geodetic, drone, deformation).
--
-- Mining (MineTwin module) and marine (seabed, depth sounder, sounding
-- chart) functionality has been moved to the separate `metardu-industrial`
-- desktop application repo.
--
-- This migration drops the now-unused `mining_surveys` and `hydro_surveys`
-- tables, their triggers, and their indexes. Fresh installs (running
-- 000_canonical_schema.sql after this migration was committed) will not
-- create these tables in the first place; this migration is idempotent
-- and safe to run on both fresh and existing deployments.
--
-- Down (rollback): re-create the tables by reverting to a pre-023
-- checkout of 000_canonical_schema.sql. Data is NOT preserved — mining
-- and hydro data should be exported via the industrial app before
-- running this migration.

DROP TRIGGER IF EXISTS trg_mining_surveys_updated_at ON mining_surveys;
DROP TRIGGER IF EXISTS trg_hydro_surveys_updated_at ON hydro_surveys;

DROP INDEX IF EXISTS idx_mining_surveys_project_id;

DROP TABLE IF EXISTS mining_surveys CASCADE;
DROP TABLE IF EXISTS hydro_surveys CASCADE;
