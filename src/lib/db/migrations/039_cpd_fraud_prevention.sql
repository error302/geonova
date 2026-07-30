-- ──────────────────────────────────────────────────────────────────────────
-- 039_cpd_fraud_prevention.sql
-- AUDIT FIX (2026-07-05): Fraud prevention for the CPD (Continuing
-- Professional Development) points system.
--
-- Problems this migration addresses:
--   1. No duplicate prevention — the same reference_id could award points
--      multiple times (e.g., clicking "complete" twice on a peer review)
--   2. No approval workflow — manual entries (training, conferences) were
--      immediately counted toward the annual total with no verification
--   3. No audit trail — no record of WHO awarded the points (self-award
--      was possible for system-generated activities)
--   4. No annual cap — a user could accumulate unlimited points
--
-- Changes:
--   1. Add `approved` column (default TRUE for system-generated, FALSE for
--      manual entries that need admin review)
--   2. Add `awarded_by` column (tracks who awarded the points — NULL for
--      system-generated, user_id for manual entries)
--   3. Add `approved_by` column (admin who approved a manual entry)
--   4. Add `approved_at` column (timestamp of approval)
--   5. Add unique constraint on (user_id, reference_id) to prevent duplicates
--   6. Add `rejection_reason` column (for rejected manual entries)
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Add approval workflow columns
ALTER TABLE cpd_records
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Add unique constraint to prevent duplicate awards
-- (Same user + same reference_id = duplicate. NULL reference_id is allowed
--  multiple times — for manual entries without a reference.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpd_records_unique_reference
  ON cpd_records (user_id, reference_id)
  WHERE reference_id IS NOT NULL;

-- 3. Index for querying pending approvals (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_cpd_records_pending
  ON cpd_records (approved, earned_at DESC)
  WHERE approved = FALSE;

-- 4. Index for querying approved records by user+year (for totals)
CREATE INDEX IF NOT EXISTS idx_cpd_records_approved_user_year
  ON cpd_records (user_id, earned_at, approved)
  WHERE approved = TRUE;

-- 5. Add a trigger to log CPD award events to the audit chain
-- (This catches both system-generated and manual awards)
CREATE OR REPLACE FUNCTION log_cpd_award()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is a new record (not an update of approval status)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_chain (user_id, entity_type, entity_id, action, payload, hash_prev, hash_current, created_at)
    VALUES (
      NEW.user_id,
      'cpd_record',
      NEW.id,
      'cpd_award',
      jsonb_build_object(
        'activity', NEW.activity,
        'points', NEW.points,
        'description', NEW.description,
        'reference_id', NEW.reference_id,
        'awarded_by', NEW.awarded_by,
        'approved', NEW.approved
      ),
      -- Hash chain: previous hash from the latest entry for this user
      COALESCE((
        SELECT hash_current FROM audit_chain
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC LIMIT 1
      ), ''),
      -- Current hash = SHA256(prev_hash + payload + created_at)
      encode(
        digest(
          COALESCE((
            SELECT hash_current FROM audit_chain
            WHERE user_id = NEW.user_id
            ORDER BY created_at DESC LIMIT 1
          ), '') || NEW.id::text || NEW.activity || NEW.points::text || NEW.earned_at::text,
          'sha256'
        ),
        'hex'
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cpd_award ON cpd_records;
CREATE TRIGGER trg_cpd_award
  AFTER INSERT ON cpd_records
  FOR EACH ROW
  EXECUTE FUNCTION log_cpd_award();

-- 6. Add a trigger to log CPD approval/rejection events
CREATE OR REPLACE FUNCTION log_cpd_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.approved IS DISTINCT FROM NEW.approved THEN
    INSERT INTO audit_chain (user_id, entity_type, entity_id, action, payload, hash_prev, hash_current, created_at)
    VALUES (
      NEW.user_id,
      'cpd_record',
      NEW.id,
      CASE WHEN NEW.approved THEN 'cpd_approved' ELSE 'cpd_rejected' END,
      jsonb_build_object(
        'activity', NEW.activity,
        'points', NEW.points,
        'approved_by', NEW.approved_by,
        'rejection_reason', NEW.rejection_reason
      ),
      COALESCE((
        SELECT hash_current FROM audit_chain
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC LIMIT 1
      ), ''),
      encode(
        digest(
          COALESCE((
            SELECT hash_current FROM audit_chain
            WHERE user_id = NEW.user_id
            ORDER BY created_at DESC LIMIT 1
          ), '') || NEW.id::text || NEW.approved::text || NOW()::text,
          'sha256'
        ),
        'hex'
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cpd_approval ON cpd_records;
CREATE TRIGGER trg_cpd_approval
  AFTER UPDATE OF approved ON cpd_records
  FOR EACH ROW
  EXECUTE FUNCTION log_cpd_approval();
