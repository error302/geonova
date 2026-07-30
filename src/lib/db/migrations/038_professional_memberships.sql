-- Migration 038: Professional memberships with documentary proof + admin review
-- Date: 2026-07-03
--
-- AUDIT FIX (H10): ISK/EBK license verification was self-attested —
-- surveyors entered their ISK number and it was marked "verified"
-- with no actual verification. Real ISK/EBK APIs don't exist (or
-- aren't publicly available), so we implement a documentary-proof
-- workflow:
--
--   1. Surveyor enters their membership number + uploads a scan/photo
--      of their practicing certificate (PDF, JPG, PNG)
--   2. Status starts as PENDING
--   3. An admin reviews the document and sets status to VERIFIED or
--      FAILED with a reason
--   4. VERIFIED memberships unlock statutory document generation
--      (deed plans, Form No. 4, NLIMS submissions)
--   5. Memberships have an expiry date — expired memberships block
--      statutory generation until renewed
--
-- This table replaces the `surveyor_profiles.verified_isk BOOLEAN`
-- column, which was self-attested. The old column is kept for
-- backward compatibility but the new table is the source of truth.

CREATE TABLE IF NOT EXISTS professional_memberships (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                VARCHAR(20) NOT NULL CHECK (body IN ('ISK', 'EBK', 'ISU', 'RICS', 'FIG', 'OTHER')),
  membership_number   VARCHAR(100) NOT NULL,
  membership_grade    VARCHAR(50),  -- e.g., ' Fellow', 'Member', 'Graduate'
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED')),
  verification_method VARCHAR(20) NOT NULL DEFAULT 'DOCUMENT'
                        CHECK (verification_method IN ('MANUAL', 'API', 'DOCUMENT')),
  verified_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  verification_notes  TEXT,         -- admin's notes on review
  rejection_reason    TEXT,         -- if status = FAILED
  expires_at          DATE,         -- practising certificate expiry
  supporting_doc_path TEXT,         -- path to uploaded certificate scan
  supporting_doc_hash VARCHAR(64),  -- SHA-256 of the uploaded doc
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prof_memberships_user ON professional_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_prof_memberships_body ON professional_memberships(user_id, body, verification_status);
CREATE INDEX IF NOT EXISTS idx_prof_memberships_pending ON professional_memberships(verification_status, created_at DESC)
  WHERE verification_status = 'PENDING';

COMMENT ON TABLE professional_memberships IS 'Professional body memberships (ISK, EBK, etc.) with documentary proof + admin review workflow';
COMMENT ON COLUMN professional_memberships.verification_status IS 'PENDING = awaiting admin review, VERIFIED = admin confirmed, FAILED = rejected, EXPIRED = past expiry date';
COMMENT ON COLUMN professional_memberships.supporting_doc_path IS 'Path to the uploaded practising certificate scan (PDF/JPG/PNG)';
