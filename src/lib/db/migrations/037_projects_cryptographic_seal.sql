-- Migration 037: Add cryptographic_seal column to projects
-- Date: 2026-07-03
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cryptographic_seal VARCHAR(64);
COMMENT ON COLUMN projects.cryptographic_seal IS 'SHA-256 hash of canonical JSON set when a licensed surveyor approves & locks the project. NULL until locked.';
