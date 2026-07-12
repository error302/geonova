-- ────────────────────────────────────────────────────────────────────────────
-- 047_fix_audit_logs_record_id_type.sql
--
-- CRITICAL FIX: Registration (and every audited INSERT/UPDATE/DELETE) returns
-- HTTP 500 with:
--     column "record_id" is of type uuid but expression is of type text
--
-- Root cause — a schema split-brain between two migrations:
--   • 000_canonical_schema.sql  creates audit_logs.record_id as  UUID
--   • 005_audit_triggers_precision.sql  expects  record_id  to be TEXT and its
--     trigger function audit_trigger_func() inserts  NEW.id::TEXT  into it.
--
-- Because 000 runs first, the table already exists, so the
-- `CREATE TABLE IF NOT EXISTS` in 005 is a no-op and record_id stays UUID.
-- PostgreSQL does not implicitly cast text → uuid on INSERT, so the trigger
-- fails on the very first audited write (surveyor_profiles on registration).
--
-- Fix: make record_id TEXT (the trigger's contract). TEXT is the correct type
-- anyway — some audited tables may have non-UUID primary keys in future, and
-- to_jsonb captures the typed value regardless. Existing UUID values cast
-- cleanly to text. Idempotent: only alters if the column is still UUID.
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- audit_logs.record_id : UUID → TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'record_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE audit_logs
      ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;
  END IF;

  -- government_audit_logs.record_id : UUID → TEXT (same contract, future-proof)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'government_audit_logs'
      AND column_name = 'record_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE government_audit_logs
      ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;
  END IF;
END $$;

-- Re-assert the trigger function so a fresh DB and an upgraded DB converge on
-- the exact same definition (NEW.id::TEXT into a TEXT column — no cast error).
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
BEGIN
  BEGIN
    current_user_id := current_setting('request.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (current_user_id, 'INSERT', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (current_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (current_user_id, 'DELETE', TG_TABLE_NAME, OLD.id::TEXT, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
