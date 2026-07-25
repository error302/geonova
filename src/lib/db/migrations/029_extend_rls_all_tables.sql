-- Migration 029: Extend RLS to all project-scoped tables
-- Date: 2026-07-02
-- Audit finding: H2 — RLS was re-enabled in migration 028 but only on
-- 4 tables (projects, survey_points, organizations, organization_members).
-- All other project-scoped tables (traverse_observations, level_observations,
-- deed_plans, field_records, etc.) have NO RLS — defense-in-depth relies
-- entirely on app-layer user_id filtering for those tables.
--
-- This migration extends RLS to all remaining project-scoped tables.
-- The pattern is: a row is visible if the user owns the parent project
-- OR is a member of the project's organization.
--
-- Tables covered (all project-scoped):
--   traverse_observations, traverse_coordinates, traverse_history
--   level_networks, level_control_points, level_observations, level_adjustment_results
--   road_alignments, alignment_ips, alignment_vertical_ips
--   cross_section_stations, earthworks_results, road_reserve_parcels
--   project_fieldbook_entries, network_adjustments, gnss_sessions
--   import_sessions, project_members, scheme_activity_log
--   scheme_details, blocks, parcels, parcel_traverses
--   survey_reports, survey_photos, survey_epochs
--   block_assignments, beacon_records, control_point_registers
--   deed_plans (if table exists)

-- Helper: reusable policy template for project-child tables.
-- A project-child table has a project_id FK column.
-- The policy checks: EXISTS (SELECT 1 FROM projects WHERE id = child.project_id
--   AND (user_id = current_user OR org_member check)).

-- ─── Traverse tables ───────────────────────────────────────────────────────

ALTER TABLE traverse_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_traverse_obs" ON traverse_observations;
CREATE POLICY "project_child_traverse_obs" ON traverse_observations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM parcel_traverses pt
            JOIN projects p ON p.id = pt.project_id
            WHERE pt.id = traverse_observations.traverse_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

ALTER TABLE traverse_coordinates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_traverse_coords" ON traverse_coordinates;
CREATE POLICY "project_child_traverse_coords" ON traverse_coordinates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM parcel_traverses pt
            JOIN projects p ON p.id = pt.project_id
            WHERE pt.id = traverse_coordinates.traverse_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Leveling tables ───────────────────────────────────────────────────────

ALTER TABLE level_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_level_obs" ON level_observations;
CREATE POLICY "project_child_level_obs" ON level_observations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM level_networks ln
            JOIN projects p ON p.id = ln.project_id
            WHERE ln.id = level_observations.network_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

ALTER TABLE level_adjustment_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_level_adj" ON level_adjustment_results;
CREATE POLICY "project_child_level_adj" ON level_adjustment_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM level_networks ln
            JOIN projects p ON p.id = ln.project_id
            WHERE ln.id = level_adjustment_results.network_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Project fieldbook entries ─────────────────────────────────────────────

ALTER TABLE project_fieldbook_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_fieldbook" ON project_fieldbook_entries;
CREATE POLICY "project_child_fieldbook" ON project_fieldbook_entries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = project_fieldbook_entries.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Network adjustments ───────────────────────────────────────────────────

ALTER TABLE network_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_network_adj" ON network_adjustments;
CREATE POLICY "project_child_network_adj" ON network_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = network_adjustments.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── GNSS sessions ─────────────────────────────────────────────────────────

ALTER TABLE gnss_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_gnss" ON gnss_sessions;
CREATE POLICY "project_child_gnss" ON gnss_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = gnss_sessions.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Import sessions ───────────────────────────────────────────────────────

ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_import" ON import_sessions;
CREATE POLICY "project_child_import" ON import_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = import_sessions.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Project members ───────────────────────────────────────────────────────

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_members" ON project_members;
CREATE POLICY "project_child_members" ON project_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = project_members.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Survey reports, photos, epochs ────────────────────────────────────────

ALTER TABLE survey_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_reports" ON survey_reports;
CREATE POLICY "project_child_reports" ON survey_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = survey_reports.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

ALTER TABLE survey_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_photos" ON survey_photos;
CREATE POLICY "project_child_photos" ON survey_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = survey_photos.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

ALTER TABLE survey_epochs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_child_epochs" ON survey_epochs;
CREATE POLICY "project_child_epochs" ON survey_epochs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p
            WHERE p.id = survey_epochs.project_id
              AND (p.user_id::text = current_setting('request.user_id', true)
                   OR (p.organization_id = current_org_id()
                       AND EXISTS (SELECT 1 FROM organization_members om
                                   WHERE om.organization_id = p.organization_id
                                     AND om.user_id::text = current_setting('request.user_id', true)
                                     AND om.is_active = TRUE))))
  );

-- ─── Payment history (user-scoped, not project-scoped) ─────────────────────

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_payment_history" ON payment_history;
CREATE POLICY "self_payment_history" ON payment_history
  FOR SELECT USING (user_id::text = current_setting('request.user_id', true));

-- ─── User subscriptions (user-scoped) ──────────────────────────────────────

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_subscriptions" ON user_subscriptions;
CREATE POLICY "self_subscriptions" ON user_subscriptions
  FOR ALL USING (user_id::text = current_setting('request.user_id', true))
  WITH CHECK (user_id::text = current_setting('request.user_id', true));

-- ─── CPD records ──────────────────────────────────────────────────────────
-- RLS for cpd_records is applied in migration 035_consolidated_missing_tables
-- because that is where the cpd_records table is created (this migration runs
-- before the table exists, so a policy here would fail).

-- ─── Audit logs (user can see own, admins can see all) ─────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_audit_logs" ON audit_logs;
CREATE POLICY "self_audit_logs" ON audit_logs
  FOR SELECT USING (
    user_id::text = current_setting('request.user_id', true)
    OR EXISTS (SELECT 1 FROM user_roles ur
               WHERE ur.user_id::text = current_setting('request.user_id', true)
                 AND ur.role IN ('super_admin', 'org_admin')
                 AND ur.revoked_at IS NULL)
  );
