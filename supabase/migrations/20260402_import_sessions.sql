-- Import sessions table for audit trail
-- File: supabase/migrations/20260402_import_sessions.sql

CREATE TABLE IF NOT EXISTS import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  format text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'mapped', 'committed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own import sessions"
  ON import_sessions FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add import traceability to field book entries
ALTER TABLE project_fieldbook_entries
  ADD COLUMN IF NOT EXISTS import_session_id uuid REFERENCES import_sessions(id);
