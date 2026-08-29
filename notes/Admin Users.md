---
title: Admin Users
tags: [admin, users, auth, seed]
---

# Admin Users

Seeded accounts for testing METARDU.

> **SECURITY (audit C-01, 2026-08-30):** All credentials were removed from this
> file. Never commit passwords, database credentials, or SSH secrets to the
> repository — they live in the VM environment files (`~/metardu/.env`) or your
> password manager only. The values previously recorded here are considered
> compromised by history and must not be reused anywhere.

## Admin
- **Email**: see `ADMIN_EMAIL` in the VM `.env` (owner-managed)
- **Password**: managed via password manager / VM `.env` — never stored in git
- **Role**: `admin`
- **user_id**: `5a278317-81db-4db9-b9b6-d5f8ca10ec38`
- **Project**: "Admin Test Project" (1 project)

## Test User (empty state)
- **Email**: `newuser-test@metardu.test`
- **Password**: set at seed time via `SEED_TEST_PASSWORD` env var
- **Role**: `user`
- **user_id**: `698fd2ca-ed35-4447-b041-e611fe38891f`
- **Projects**: 0 (for empty-state testing)
- Seed script: `scripts/_seed_new_user.js`

## Admin Plan Override Permissions
Plan override was `super_admin`-only. Fixed to allow `admin` + `super_admin`:
- `src/app/api/admin/users/override-plan/route.ts` — `roles: ['admin', 'super_admin']`
- `src/app/admin/page.tsx` — `canOverridePlans` var
- `src/app/admin/users/page.tsx` — 3 checks opened to admin

## DB
Database credentials are injected via environment variables from the VM's
`.env` file (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). They are not
recorded anywhere in the repository.
