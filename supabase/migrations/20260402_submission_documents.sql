-- File: supabase/migrations/20260402_submission_documents.sql
-- Phase 13: Submission Package document tracking

CREATE TABLE IF NOT EXISTS submission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'error')),
  file_url text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, document_id)
);

ALTER TABLE submission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own submission documents"
  ON submission_documents
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );