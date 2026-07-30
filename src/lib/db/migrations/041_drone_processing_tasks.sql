-- ──────────────────────────────────────────────────────────────────────────
-- 041_drone_processing_tasks.sql
-- AUDIT FIX (2026-07-05): Drone photogrammetry processing pipeline.
--
-- Stores WebODM processing tasks so surveyors can:
--   1. Upload drone photos to METARDU
--   2. Trigger WebODM processing (orthophoto + point cloud + DSM)
--   3. Monitor processing status (queued → running → completed → failed)
--   4. Download results and import into METARDU's existing tools
--      (point cloud importer, orthophoto viewer, contour generator)
--
-- The task lifecycle:
--   upload → queued → running → completed → imported
--                                ↘ failed
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drone_processing_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Task metadata
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  photo_count     INTEGER NOT NULL DEFAULT 0,
  total_size_mb   NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- WebODM integration
  webodm_task_id  VARCHAR(255),
  webodm_url      TEXT,  -- base URL of the WebODM instance

  -- Processing options (passed to WebODM)
  options         JSONB DEFAULT '{}'::jsonb,
  -- Common options:
  --   dem-resolution: 5 (cm/pixel for DSM/DTM)
  --   orthophoto-resolution: 5 (cm/pixel)
  --   dsm: true (generate Digital Surface Model)
  --   dtm: true (generate Digital Terrain Model)
  --   contour-resolution: 0.5 (m contour interval)
  --   gcp: path to GCP file (optional)

  -- Status tracking
  status          VARCHAR(50) NOT NULL DEFAULT 'uploading',
  -- Statuses: uploading → queued → running → completed → importing → imported → failed
  progress        INTEGER NOT NULL DEFAULT 0,  -- 0-100
  error_message   TEXT,

  -- Output paths (relative to STORAGE_ROOT)
  -- These are populated when the task completes and results are downloaded
  orthophoto_path TEXT,  -- path to orthophoto GeoTIFF
  pointcloud_path TEXT,  -- path to point cloud LAS/LAZ file
  dsm_path        TEXT,  -- path to DSM GeoTIFF
  dtm_path        TEXT,  -- path to DTM GeoTIFF
  contour_path    TEXT,  -- path to contour GeoJSON

  -- Photo storage (where the uploaded photos live, pre-processing)
  photos_dir      TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at  TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  imported_at     TIMESTAMPTZ
);

-- Index for user's task list (ordered by date)
CREATE INDEX IF NOT EXISTS idx_drone_tasks_user_date
  ON drone_processing_tasks (user_id, created_at DESC);

-- Index for status-based queries (find running tasks for the poller)
CREATE INDEX IF NOT EXISTS idx_drone_tasks_status
  ON drone_processing_tasks (status, updated_at)
  WHERE status IN ('queued', 'running');

-- Index for project-scoped tasks
CREATE INDEX IF NOT EXISTS idx_drone_tasks_project
  ON drone_processing_tasks (project_id)
  WHERE project_id IS NOT NULL;
