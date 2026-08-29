-- 054_ghost_row_purge.sql
-- One-time sweep: historical blank rows that predate page.tsx:937 guard
-- (empty station/pointId) rendered as “—” ghosts in QA data.
--
-- FIX (2026-08-30): the original second DELETE referenced columns
-- (point_id, fs, slope_dist, slope_distance) that do not exist on
-- project_fieldbook_entries in ANY environment — those fields live inside
-- the raw_data JSONB column, not as table columns. The statement raised
-- "column \"point_id\" does not exist" on every apply (production AND CI
-- fresh databases), and because the unified migration runner aborts the
-- chain on first failure, migrations 055+ were silently never applied
-- anywhere. Rewritten against the real schema: a ghost row is one with a
-- blank station AND no non-blank value anywhere in raw_data.

DELETE FROM survey_points WHERE trim(coalesce(point_name,'')) = '' AND coalesce(easting,0)=0 AND coalesce(northing,0)=0;

DELETE FROM project_fieldbook_entries
WHERE trim(coalesce(station,'')) = ''
  AND (
    raw_data IS NULL
    OR raw_data = '{}'::jsonb
    OR (jsonb_typeof(raw_data) = 'object' AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(raw_data) e
          WHERE trim(e.value) <> ''
        ))
  );
