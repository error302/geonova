-- Cloud Render Jobs Table

CREATE TABLE render_jobs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id),
  project_id      uuid REFERENCES projects(id),
  type            text NOT NULL,
  status          text NOT NULL DEFAULT 'QUEUED',
  input_data      jsonb NOT NULL,
  output_url      text,
  output_format   text NOT NULL DEFAULT 'PDF',
  point_count     integer,
  estimated_secs  integer,
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own render jobs" ON render_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_render_jobs_status ON render_jobs(status);
CREATE INDEX idx_render_jobs_user ON render_jobs(user_id);
