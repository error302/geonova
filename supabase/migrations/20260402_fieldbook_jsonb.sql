-- Add JSONB data column to project_fieldbook_entries for flexible per-type schema
-- File: supabase/migrations/20260402_fieldbook_jsonb.sql

-- Add data JSONB column if it doesn't exist
ALTER TABLE project_fieldbook_entries
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN project_fieldbook_entries.data IS 'Flexible JSONB storage for type-specific field book data';
