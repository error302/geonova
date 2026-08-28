-- 054_equipment_column_fix.sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment TEXT;
