-- Migration 032: Create fieldbooks table for fieldbook persistence
-- Date: 2026-07-03
-- Audit finding: The fieldbook page saves to a 'fieldbooks' table that
-- doesn't exist in the DB. Online saves silently fail, falling back to
-- IndexedDB only. This migration creates the table so fieldbook data
-- actually persists to the database.

CREATE TABLE IF NOT EXISTS fieldbooks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL DEFAULT 'traverse'
                CHECK (type IN ('traverse', 'leveling', 'control', 'radiation', 'detail')),
  name          VARCHAR(255),
  data          JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(30) DEFAULT 'active'
                CHECK (status IN ('active', 'archived', 'deleted')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fieldbooks_user ON fieldbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_fieldbooks_project ON fieldbooks(project_id);
CREATE INDEX IF NOT EXISTS idx_fieldbooks_type ON fieldbooks(user_id, type);

-- Trigger for updated_at
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_fieldbooks_updated_at ON fieldbooks;
  CREATE TRIGGER trg_fieldbooks_updated_at
    BEFORE UPDATE ON fieldbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- Enable RLS (matching the project-scoped pattern)
ALTER TABLE fieldbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_fieldbooks" ON fieldbooks;
CREATE POLICY "owner_all_fieldbooks" ON fieldbooks
  FOR ALL
  USING (user_id::text = current_setting('request.user_id', true))
  WITH CHECK (user_id::text = current_setting('request.user_id', true));

-- Also allow org members to access fieldbooks for shared projects
DROP POLICY IF EXISTS "project_member_fieldbooks" ON fieldbooks;
CREATE POLICY "project_member_fieldbooks" ON fieldbooks
  FOR ALL
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = fieldbooks.project_id
        AND (
          p.user_id::text = current_setting('request.user_id', true)
          OR (
            p.organization_id = current_org_id()
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = p.organization_id
                AND om.user_id::text = current_setting('request.user_id', true)
                AND om.is_active = TRUE
            )
          )
        )
    )
  );

-- Add to /api/db allowlist will be done in code
COMMENT ON TABLE fieldbooks IS 'Persistent fieldbook records — traverse, leveling, control observations saved as JSONB';
