-- 049_workflow_progress_columns.sql
-- Project workspace (src/app/project/[id]/page.tsx), ProjectWorkflowBadge and
-- /api/project/[id]/workflow all read/update workflow_step and
-- workflow_max_unlocked on the projects table, but no migration ever created
-- them. As a result every project workspace page errored and redirected to
-- /dashboard. Add the columns with safe defaults (idempotent).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workflow_step INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workflow_max_unlocked INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN projects.workflow_step IS 'Current 5-step workflow step (1-5)';
COMMENT ON COLUMN projects.workflow_max_unlocked IS 'Highest workflow step unlocked (1-5)';