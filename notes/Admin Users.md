---
title: Admin Users
tags: [admin, users, auth, seed]
---

# Admin Users

Seeded accounts for testing METARDU.

## Admin
- **Email**: `mohameddosho20@gmail.com`
- **Password**: `Z7m7066C6UJBUK`
- **Role**: `admin`
- **user_id**: `5a278317-81db-4db9-b9b6-d5f8ca10ec38`
- **Project**: "Admin Test Project" (1 project)

## Test User (empty state)
- **Email**: `newuser-test@metardu.test`
- **Password**: `TestNewUser!`
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
- POSTGRES_USER=`metardu`
- POSTGRES_PASSWORD=`JV3IexxVLcKdK6Cr0FOQ_R7O3ak_ptMt`
- POSTGRES_DB=`metardu`
