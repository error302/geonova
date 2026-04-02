-- Online service logs for audit trail
-- File: supabase/migrations/20260402_online_service_logs.sql

CREATE TABLE IF NOT EXISTS online_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  service text NOT NULL,
  input_summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE online_service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own service logs"
  ON online_service_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert logs"
  ON online_service_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
