-- 050_projects_workflow_step.sql
-- Fix: /project/[id] workspace silently redirected every user back to
-- /dashboard because page.tsx selects projects.workflow_step and
-- projects.workflow_max_unlocked — columns used by the workflow engine
-- (page.tsx, api/project/[id]/workflow/route.ts, ProjectWorkspaceClient)
-- but never defined in any migration. PostgREST errored on the select,
-- the page treated it as "project not found" and redirected.
--
-- Safe to re-run: IF NOT EXISTS guards, defaults match the code's
-- `?? 1` fallbacks so existing projects start at step 1 unlocked.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workflow_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workflow_max_unlocked integer NOT NULL DEFAULT 1;

-- Keep values sane if rows were written by partial paths
UPDATE projects
SET workflow_step = 1, workflow_max_unlocked = 1
WHERE workflow_step IS NULL OR workflow_step < 1 OR workflow_max_unlocked IS NULL OR workflow_max_unlocked < 1;
