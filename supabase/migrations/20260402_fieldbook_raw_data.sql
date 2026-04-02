-- Phase 15: Dynamic field book — add raw_data jsonb for type-specific columns
ALTER TABLE project_fieldbook_entries
  ADD COLUMN IF NOT EXISTS survey_type text,
  ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fieldbook_raw_data
  ON project_fieldbook_entries USING GIN (raw_data);

COMMENT ON COLUMN project_fieldbook_entries.raw_data IS
  'Type-specific field book columns stored as JSON. '
  'Keys match FieldBookColumn.key values from fieldBookTemplates.ts. '
  'Fixed columns (bs, is, fs, rl, station, etc.) stay in their named columns.';