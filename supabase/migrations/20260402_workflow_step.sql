-- Phase 14: Workflow step tracking
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workflow_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workflow_max_unlocked integer NOT NULL DEFAULT 1;

ALTER TABLE projects
  ADD CONSTRAINT projects_workflow_step_range
  CHECK (workflow_step BETWEEN 1 AND 5);

ALTER TABLE projects
  ADD CONSTRAINT projects_workflow_max_unlocked_range
  CHECK (workflow_max_unlocked BETWEEN 1 AND 5);

UPDATE projects
  SET workflow_step = 1, workflow_max_unlocked = 1
  WHERE workflow_step IS NULL;