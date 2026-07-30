-- Migration 045: Session revocation table
-- ByteByteGo audit fix: JWT-only auth has no server-side revocation.
-- This adds a revoked_tokens table so admins can force-logout users.
-- The JWT validation callback checks this table on every request.

CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti VARCHAR(255) PRIMARY KEY,           -- JWT ID claim
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by UUID REFERENCES users(id),   -- admin who revoked
    reason TEXT DEFAULT 'manual_revocation'
);

CREATE INDEX idx_revoked_tokens_user ON revoked_tokens(user_id);
CREATE INDEX idx_revoked_tokens_revoked_at ON revoked_tokens(revoked_at);

-- Auto-cleanup: delete revoked tokens older than 30 days
-- (they've expired from JWT maxAge anyway)
CREATE OR REPLACE FUNCTION cleanup_old_revoked_tokens() RETURNS void AS $$
BEGIN
    DELETE FROM revoked_tokens WHERE revoked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE revoked_tokens IS 'ByteByteGo audit: Server-side JWT revocation for forced logout';
