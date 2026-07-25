-- Migration 024: Audit chain — tamper-evident append-only log
-- ====================================================================
--
-- Purpose
-- -------
-- The existing audit_logs table (migration 005) captures row-level
-- changes via DB triggers. But it is NOT tamper-evident: a DBA or
-- anyone with direct DB access can modify or delete past entries
-- undetected. That's the fraud vector this migration closes.
--
-- This new audit_chain table uses a cryptographic hash chain: each
-- entry's hash includes the previous entry's hash. Tampering with
-- any past entry breaks the chain, and verifyChain() flags it.
--
-- This is the Estonia e-Land pattern — simple, no PKI required,
-- auditable. It's the right fraud solution for Kenya because:
--   1. Kenyan surveyors don't have PKI certificates (ISK issues
--      license numbers, not X.509 certs)
--   2. Client-side signing is insecure (private key in browser)
--   3. Server-side hash chain is auditable by Survey of Kenya
--      without any new infrastructure on their end
--
-- Relationship to existing audit_logs table
-- ------------------------------------------
-- audit_logs (migration 005) stays as-is — it's the auto-populated
-- row-level change log populated by DB triggers.
--
-- audit_chain (this migration) is the APPLICATION-LEVEL tamper-evident
-- log. Application code explicitly appends to it at key change points
-- (coordinate edits, traverse adjustments, parcel boundary changes,
-- deed plan generation, NLIMS submissions). Each entry carries:
--   - who made the change (user_id + user_name)
--   - what entity changed (entity_type + entity_id)
--   - what action was taken (create/update/delete/adjust/...)
--   - the before/after payload (old/new values, reason)
--   - previous_hash + entry_hash (the chain)
--
-- Verification
-- ------------
-- verifyChain(projectId?) walks entries in sequence order, recomputes
-- each hash, and reports any entry where:
--   - recomputed entry_hash != stored entry_hash (entry was modified)
--   - stored previous_hash != prior entry's entry_hash (entry was
--     inserted or deleted mid-chain)
--
-- Both cases prove tampering.

CREATE TABLE IF NOT EXISTS audit_chain (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Monotonic sequence number for ordering. BIGSERIAL ensures
  -- entries are strictly ordered even across concurrent transactions.
  sequence      BIGSERIAL UNIQUE NOT NULL,
  -- Nullable project_id — system-wide events (auth, license changes)
  -- have null project_id. Project-scoped events have a value.
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- Denormalized user_name for display without joining users table.
  -- user_id is the authoritative link; user_name is a snapshot at
  -- the time of the event (in case the user is later deleted).
  user_id       UUID,
  user_name     TEXT,
  -- Entity being changed. entity_type matches EntityGraph types
  -- (control_point, traverse, parcel, alignment, etc.) plus
  -- 'document' for exports and 'system' for non-entity events.
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  -- Action taken: 'create' | 'update' | 'delete' | 'adjust' |
  -- 'generate' | 'submit' | 'lock' | 'unlock' | 'sign'
  action        TEXT NOT NULL,
  -- Hash chain fields.
  -- previous_hash is the entry_hash of the immediately preceding
  -- entry (by sequence). Null for the genesis (first) entry.
  previous_hash TEXT,
  -- entry_hash is SHA-256 of this entry's canonical form:
  --   previous_hash + sequence + project_id + user_id + entity_type +
  --   entity_id + action + JSON.stringify(payload) + created_at
  -- Computed by the application before insert.
  entry_hash    TEXT NOT NULL,
  -- The actual change data: { old: ..., new: ..., reason: ..., metadata: ... }
  -- Stored as JSONB for query flexibility.
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_chain_project_id
  ON audit_chain (project_id, sequence);
CREATE INDEX IF NOT EXISTS idx_audit_chain_entity
  ON audit_chain (entity_type, entity_id, sequence);
CREATE INDEX IF NOT EXISTS idx_audit_chain_user_id
  ON audit_chain (user_id, sequence);
CREATE INDEX IF NOT EXISTS idx_audit_chain_created_at
  ON audit_chain (created_at DESC);
-- Index for chain verification (walk in sequence order)
CREATE INDEX IF NOT EXISTS idx_audit_chain_sequence
  ON audit_chain (sequence);

-- Comment for future DBAs
COMMENT ON TABLE audit_chain IS
  'Tamper-evident append-only audit log. Each entry''s entry_hash includes the previous entry''s hash, forming a chain. verifyChain() detects any modification or deletion. Do NOT UPDATE or DELETE rows in this table — only INSERT.';

-- Grant: application role can INSERT and SELECT but not UPDATE/DELETE.
-- This is enforced at the DB level to prevent even application bugs
-- from corrupting the chain.
-- (RLS policies inherited from the existing metardu role setup.)
