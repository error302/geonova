-- Migration 056: users.email_verified (account pre-hijacking defense)
--
-- SECURITY (audit C-06, 2026-08-30): registration never verified email
-- ownership, while sign-in grants super_admin purely on an email match with
-- PLATFORM_OWNER_EMAIL / ADMIN_EMAILS. Anyone could register the owner's
-- email first and sign in as super_admin, and OAuth identities were linked
-- to password accounts purely by email match (pre-hijacking).
--
-- This migration adds an email_verified flag:
--   * ALL existing accounts are grandfathered as verified (they predate this
--     change; the production owner keeps working access unchanged).
--   * New self-service registrations default to NOT verified — they can use
--     the platform, but email-matched super_admin grants are refused until
--     the address is verified (OAuth provider-verified, or set manually by
--     an existing admin).
--   * OAuth identity linking requires the pre-existing account to be either
--     OAuth-created (no password) or already email-verified.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Grandfather: every account that exists today is treated as verified.
UPDATE users SET email_verified = TRUE;
