-- Migration 028: Organizations table + org-level multi-tenancy + re-enable RLS
-- Date: 2026-07-02
-- Audit finding: C6 — user_roles.organization_id existed with no FK, no
-- organizations table, no org-level RLS. A surveying firm with 10 surveyors
-- could not share projects at the firm level. Enterprise tier was vaporware.
--
-- This migration:
--   1. Creates the organizations table
--   2. Adds organization_id FK to projects (nullable for backward compat)
--   3. Adds FK constraint to user_roles.organization_id
--   4. Creates org_members junction table (user ↔ org with role)
--   5. Re-enables RLS on key tables with org-aware policies
--   6. Adds a helper function current_org_id() for policy expressions
--
-- Backward compatibility:
--   - All new columns are nullable; existing rows are untouched
--   - Existing user-level projects (organization_id = NULL) still work
--   - RLS policies fall back to user_id when organization_id is NULL
--   - A migration script (not included) should be run by the admin to
--     create organizations for existing firms (grouped by surveyor_profiles.firm_name)

-- ─── 1. Organizations table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  plan            VARCHAR(30) DEFAULT 'free'
                  CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  isk_firm_number VARCHAR(100),  -- ISK-registered firm number
  ebk_firm_number VARCHAR(100),  -- EBK-registered firm number
  contact_email   VARCHAR(255),
  contact_phone   VARCHAR(50),
  address         TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  max_seats       INTEGER DEFAULT 5,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ─── 2. Add organization_id to projects ───────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_organization
  ON projects(organization_id)
  WHERE organization_id IS NOT NULL;

-- ─── 3. Add FK constraint to user_roles.organization_id ────────────────────
-- (was a bare UUID with no FK; now references organizations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_organization_id_fkey'
      AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 4. Org_members junction (user ↔ org with role) ───────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(30) NOT NULL DEFAULT 'surveyor'
                  CHECK (role IN ('org_admin', 'project_manager', 'surveyor', 'viewer')),
  invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- ─── 5. Helper function: current_org_id() ─────────────────────────────────
-- Returns the organization_id from the current request context (set by
-- the app via SET LOCAL request.organization_id = '...'). Returns NULL
-- if not set — policies fall back to user_id in that case.
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.organization_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── 6. Re-enable RLS with org-aware policies ─────────────────────────────
-- AUDIT FIX (C6, 2026-07-02): RLS was disabled in migration 011. We
-- re-enable it here with policies that check BOTH user_id and
-- organization_id. When organization_id is NULL (legacy personal projects),
-- the user_id policy applies. When set, any org member can access.

-- 6a. Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_projects" ON projects;
CREATE POLICY "owner_all_projects" ON projects
  FOR ALL
  USING (user_id::text = current_setting('request.user_id', true))
  WITH CHECK (user_id::text = current_setting('request.user_id', true));

DROP POLICY IF EXISTS "org_member_all_projects" ON projects;
CREATE POLICY "org_member_all_projects" ON projects
  FOR ALL
  USING (
    organization_id IS NOT NULL
    AND organization_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
        AND om.user_id::text = current_setting('request.user_id', true)
        AND om.is_active = TRUE
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
        AND om.user_id::text = current_setting('request.user_id', true)
        AND om.is_active = TRUE
    )
  );

-- 6b. Survey points (inherit from project)
ALTER TABLE survey_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_child_all_survey_points" ON survey_points;
CREATE POLICY "project_child_all_survey_points" ON survey_points
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = survey_points.project_id
        AND (
          p.user_id::text = current_setting('request.user_id', true)
          OR (
            p.organization_id IS NOT NULL
            AND p.organization_id = current_org_id()
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = p.organization_id
                AND om.user_id::text = current_setting('request.user_id', true)
                AND om.is_active = TRUE
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = survey_points.project_id
        AND (
          p.user_id::text = current_setting('request.user_id', true)
          OR (
            p.organization_id IS NOT NULL
            AND p.organization_id = current_org_id()
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

-- 6c. Organizations — members can read their own orgs
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_read_organizations" ON organizations;
CREATE POLICY "member_read_organizations" ON organizations
  FOR SELECT
  USING (
    id = current_org_id()
    OR owner_id::text = current_setting('request.user_id', true)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id::text = current_setting('request.user_id', true)
        AND om.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "owner_all_organizations" ON organizations;
CREATE POLICY "owner_all_organizations" ON organizations
  FOR ALL
  USING (owner_id::text = current_setting('request.user_id', true))
  WITH CHECK (owner_id::text = current_setting('request.user_id', true));

-- 6d. Organization_members — users can read their own memberships
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_read_org_memberships" ON organization_members;
CREATE POLICY "self_read_org_memberships" ON organization_members
  FOR SELECT
  USING (user_id::text = current_setting('request.user_id', true));

DROP POLICY IF EXISTS "org_admin_all_members" ON organization_members;
CREATE POLICY "org_admin_all_members" ON organization_members
  FOR ALL
  USING (
    organization_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id::text = current_setting('request.user_id', true)
        AND om2.role = 'org_admin'
        AND om2.is_active = TRUE
    )
  )
  WITH CHECK (
    organization_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id::text = current_setting('request.user_id', true)
        AND om2.role = 'org_admin'
        AND om2.is_active = TRUE
    )
  );

-- ─── 7. Comments ──────────────────────────────────────────────────────────
COMMENT ON TABLE organizations IS 'Surveying firms / organizations. Enables firm-level multi-tenancy.';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier (e.g. "smith-surveyors-ltd").';
COMMENT ON COLUMN organizations.isk_firm_number IS 'ISK-registered firm number (if applicable).';
COMMENT ON COLUMN organizations.ebk_firm_number IS 'EBK-registered firm number (if applicable).';
COMMENT ON COLUMN organizations.max_seats IS 'Maximum number of active members. Enforced in application layer.';
COMMENT ON TABLE organization_members IS 'Junction: user ↔ organization with role. Replaces the bare organization_id on user_roles for membership tracking.';
COMMENT ON COLUMN organization_members.role IS 'Role within the org: org_admin, project_manager, surveyor, viewer.';
COMMENT ON FUNCTION current_org_id() IS 'Returns the organization_id from the current request context (SET LOCAL request.organization_id). NULL if not set.';
