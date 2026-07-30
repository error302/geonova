-- Migration 034: Extend document_signatures table
-- Date: 2026-07-03
-- Audit finding: Digital signatures were generated but never persisted.
-- Refreshing the page lost the signature.
--
-- The document_signatures table already exists (created in 000_canonical_schema
-- with a project-scoped schema). This migration adds the missing
-- persistence columns: hash, signer_user_id, signature text, and metadata.
-- Use ALTER TABLE … ADD COLUMN IF NOT EXISTS so this is safe / idempotent.

ALTER TABLE document_signatures
  ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_hash   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_name   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS signature       TEXT,
  ADD COLUMN IF NOT EXISTS algorithm       VARCHAR(50) DEFAULT 'HMAC-SHA256',
  ADD COLUMN IF NOT EXISTS metadata        JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_signatures_user ON document_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_hash ON document_signatures(document_hash);

DO $$
BEGIN
  ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "owner_signatures" ON document_signatures;
  CREATE POLICY "owner_signatures" ON document_signatures
    FOR ALL
    USING (
      user_id::text = current_setting('request.user_id', true)
      OR signer_id::text = current_setting('request.user_id', true)
    )
    WITH CHECK (
      user_id::text = current_setting('request.user_id', true)
      OR signer_id::text = current_setting('request.user_id', true)
    );
EXCEPTION WHEN OTHERS THEN
  -- Policy may fail if matching columns don't exist for legacy schema
  RAISE NOTICE 'owner_signatures policy not applied (schema mismatch)';
END $$;

COMMENT ON TABLE document_signatures IS 'Digital document signatures — HMAC-SHA256 signed documents';
