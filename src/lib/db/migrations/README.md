# METARDU Database Migration System

## Overview

Version-tracked SQL migrations for the self-hosted PostgreSQL database.
Each migration is a numbered `.sql` file. The system tracks applied
migrations in a `schema_migrations` table with SHA256 checksums.

## Commands

```bash
# Create a new migration
npm run migrate:create add_foo_column
# → creates src/lib/db/migrations/015_add_foo_column.sql

# Apply all pending migrations
npm run migrate

# Check what's pending
npm run migrate:status

# Dry run (show what would be applied)
npm run migrate:dry-run

# Rollback a specific migration
npm run migrate:rollback -- 015_add_foo_column
# (requires a -- DOWN: section in the migration file)
```

## Migration File Format

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: add_foo_column
-- Created: 2026-06-21T12:00:00.000Z
-- ═══════════════════════════════════════════════════════════════════════════════

-- UP: Forward migration (applied on 'npm run migrate')
ALTER TABLE projects ADD COLUMN foo TEXT;

-- DOWN: Rollback (applied on 'npm run migrate:rollback -- <filename>')
ALTER TABLE projects DROP COLUMN foo;
```

## Rules

1. **Never edit an applied migration.** The checksum is tracked — if you
   change a file after it's been applied, the system will warn and skip it.
2. **Always include a DOWN section.** Even if you don't plan to rollback,
   document the reverse for future reference.
3. **Number files sequentially.** Use `npm run migrate:create` which
   auto-numbers.
4. **One change per migration.** Don't combine unrelated schema changes.
5. **Test on a copy first.** Use `npm run migrate:dry-run` to preview.

## Docker Integration

Migrations run automatically in `docker-entrypoint.sh` before the app starts:

```bash
node /app/migrate.js || echo "WARNING: Migration failed"
```

## Current Migrations

| # | File | Description |
|---|---|---|
| 000 | canonical_schema.sql | Base schema (projects, users, survey_points, etc.) |
| 001 | rbac_fixed.sql | Role-based access control tables |
| 002 | rls_fixed.sql | Row-level security policies |
| 003 | rls_missing_tables.sql | RLS for missing tables |
| 004 | payment_history_fix.sql | Payment history columns |
| 005 | audit_triggers_precision.sql | Audit trigger precision |
| 006 | entity_versioning.sql | Entity version tracking |
| 007 | phase4_5_6_tables.sql | Phase 4-6 feature tables |
| 008 | phase10_indexes_and_audit.sql | Indexes + audit |
| 009 | rbac_tables.sql | RBAC table definitions |
| 010 | dpa2019_compliance.sql | Data Protection Act 2019 |
| 011 | disable_rls.sql | Disable RLS (temp) |
| 012 | search_indexes.sql | Search indexes |
| 013 | projects_add_surveyor_country.sql | Surveyor country column |
| 014 | entity_trigger_uuid_fix.sql | Entity trigger UUID fix |
| 048 | trial_reminder.sql | Trial-ending reminder idempotency column (trial_reminder_sent_at) |
