-- 055_ghost_row_purge.sql
-- One-time sweep: historical blank rows that predate page.tsx:937 guard
-- (empty station/pointId) rendered as “—” ghosts in QA data.

DELETE FROM survey_points WHERE trim(coalesce(point_name,'')) = '' AND coalesce(easting,0)=0 AND coalesce(northing,0)=0;
DELETE FROM project_fieldbook_entries WHERE trim(coalesce(station,'')) = '';
