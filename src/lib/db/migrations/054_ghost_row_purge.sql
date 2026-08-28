-- 054_ghost_row_purge.sql
-- Fixed version: previous version had an error querying columns that don't exist directly on project_fieldbook_entries
-- One-time sweep: historical blank rows that predate page.tsx:937 guard
-- (empty station/pointId) rendered as “—” ghosts in QA data.

DELETE FROM survey_points WHERE trim(coalesce(point_name,'')) = '' AND coalesce(easting,0)=0 AND coalesce(northing,0)=0;

DELETE FROM project_fieldbook_entries
WHERE
  trim(coalesce(station,'')) = ''
  AND trim(coalesce(raw_data->>'pointId', '')) = ''
  AND trim(coalesce(raw_data->>'bs', '')) = ''
  AND trim(coalesce(raw_data->>'fs', '')) = ''
  AND trim(coalesce(raw_data->>'slopeDist', coalesce(raw_data->>'slopeDistance', ''))) = '';
