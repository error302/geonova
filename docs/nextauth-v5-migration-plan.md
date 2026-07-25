# NextAuth v4 → v5 Migration Plan

**Status:** Ready to execute — all prerequisites in place (2026-07-03)
**Roadmap reference:** `docs/ROADMAP.md` → Technical debt → NextAuth v4 → v5 migration
**Estimated effort:** 2-week side-quest (per roadmap)
**Risk level:** HIGH — auth is the front door; a botched migration locks out all users

---

## Prerequisites ✅ (all complete as of 2026-07-03)

- ✅ Staging environment exists (`.github/workflows/deploy-staging.yml`)
- ✅ Rollback workflow exists (`.github/workflows/rollback.yml`)
- ✅ Pre-deploy DB backup automation (`promote.yml` takes backup before merge)
- ✅ `auth-v5.ts` config is complete (229 lines, all callbacks, type notes)
- ✅ Codemod script exists (`scripts/auth-v5-codemod.js`)
- ✅ Staging docker-compose (`docker-compose.staging.yml`)

The only remaining step is the actual 7-phase execution below.

---

## Why It's Deferred

The roadmap explicitly calls this a "2-week side-quest when there's a quiet
window." Doing it in one pass without:

- A full Prisma migration cycle
- End-to-end test runs against a staging DB
- A rollback plan
- User communication (forced re-login, possible password resets)

...would be irresponsible. The config and codemod are already staged
(see below); this plan documents how to execute the migration when you're
ready.

---

## What's Already Done

Per `docs/ROADMAP.md`:

- ✅ `src/lib/auth-v5.ts` — complete v5 config (JWT, cookie cache,
  `createUser` hooks)
- ✅ `scripts/auth-v5-codemod.js` — dry-run found 44 files / 46 call-sites
- ❌ `next-auth@beta` not installed
- ❌ Codemod not applied
- ❌ Prisma migration not run
- ❌ v5 not activated

---

## Execution Plan (7 Phases)

### Phase 1 — Branch + Install (1 hour)

```bash
git checkout -b nextauth-v5-migration
npm install next-auth@beta --legacy-peer-deps
# Verify the install didn't break anything
node node_modules/typescript/bin/tsc --noEmit
npm run dev   # smoke-test that the app still boots
```

**Acceptance:** App boots with v5 installed but v4 still active.

### Phase 2 — Apply Codemod (1 day)

```bash
# Dry run first
node scripts/auth-v5-codemod.js --dry-run

# Review the 44 files / 46 call-sites that will be touched
# Then apply for real
node scripts/auth-v5-codemod.js

# Fix any remaining type errors
node node_modules/typescript/bin/tsc --noEmit
```

The codemod handles:
- `getServerSession(authOptions)` → `auth()` (v5 default export)
- `signIn`/`signOut` import paths
- `useSession` hook import paths
- Type narrowing for `session.user`

**Acceptance:** All 44 files migrated, `tsc --noEmit` clean, app boots.

### Phase 3 — Prisma Schema Migration (1 day)

v5 changes the session model (JWT-only by default, no DB session by default
unless you opt in). The Prisma schema needs updating:

1. Review `src/lib/auth-v5.ts` to see which session strategy is configured
2. Create a new Prisma migration:
   ```bash
   npm run migrate:create -- add-nextauth-v5-session-model
   ```
3. Edit the generated SQL to:
   - Drop the old `accounts.sessions` relation if switching to JWT-only
   - OR add the new `sessions` table schema if keeping DB sessions
   - Add the `verified_email` column if not present
4. Test the migration locally:
   ```bash
   npm run migrate
   # Verify all existing users can still log in
   ```

**Acceptance:** Migration applies cleanly against a copy of the production DB.

### Phase 4 — Activate v5 (1 hour)

In `src/app/api/auth/[...nextauth]/route.ts` (or equivalent):
- Replace v4 `NextAuth(authOptions)` with v5 `export { GET, POST } = handlers`
- Switch the import in `src/lib/auth.ts` to re-export from `auth-v5.ts`
- Delete or rename the old `auth-v4.ts` file

**Acceptance:** App uses v5 for all auth flows.

### Phase 5 — E2E Test Cycle (2-3 days)

Run the full E2E suite against the migrated app:

```bash
# Existing E2E tests
npx playwright test e2e/auth-flow.spec.ts
npx playwright test e2e/login.spec.ts

# Manual smoke test
# - Sign up new user
# - Login existing user
# - Password reset flow
# - OAuth providers (Google, GitHub if configured)
# - Session refresh
# - Sign out
# - Protected route access without session
```

Fix any failures. The codemod is mechanical; edge cases in callback
handlers usually need manual attention.

**Acceptance:** All E2E tests green, manual smoke test passes.

### Phase 6 — Staging Deploy + User Communication (1 day)

1. Deploy the branch to staging
2. Test with a copy of production data
3. **Communicate to users** that they will be force-logged-out on the
   next deploy (v5 invalidates v4 sessions). Send email + in-app banner
   24h before deploy.
4. Have a rollback plan: `git revert` + `npm run migrate:rollback`

**Acceptance:** Staging works for 24h with no auth-related errors.

### Phase 7 — Production Deploy (1 hour + monitoring)

1. Schedule a maintenance window (off-peak, Kenya evening)
2. Deploy: `git merge nextauth-v5-migration && git push origin main`
3. Monitor Sentry for auth errors for 48h
4. Be ready to roll back if error rate spikes

**Acceptance:** Production stable for 48h, no auth error spike.

---

## Files to Watch

These files are likely to need manual attention after the codemod:

| File | Risk | Why |
|------|------|-----|
| `src/lib/auth.ts` | HIGH | Central re-export point; codemod may not handle the indirection |
| `src/lib/auth-v5.ts` | LOW | Already v5-shaped; just needs activation |
| `src/app/api/auth/[...nextauth]/route.ts` | HIGH | Route handler signature changes between v4 and v5 |
| `src/app/api/auth/*/route.ts` (any custom routes) | MEDIUM | Custom auth API routes may use v4 imports |
| `src/components/auth/*` | MEDIUM | Client components using `useSession` may need import updates |
| `src/middleware.ts` (if exists) | HIGH | v5 middleware uses `auth` export, not `withAuth(authOptions)` |
| `prisma/schema.prisma` | HIGH | Session model changes; needs migration |
| `e2e/auth-flow.spec.ts` | MEDIUM | Test selectors may change if UI changes |
| `e2e/login.spec.ts` | MEDIUM | Same as above |

---

## Rollback Plan

If anything goes wrong in production:

```bash
# 1. Revert the merge
git revert <merge-commit-sha>
git push origin main

# 2. Roll back the Prisma migration
npm run migrate:rollback

# 3. Restart the app
# (depends on your deploy process)

# 4. Notify users that the issue is resolved
```

**Time to rollback:** ~15 minutes if you've rehearsed it.

---

## What NOT to Do

- ❌ Don't skip the staging deploy. v5 has subtle cookie-path differences
  that only show up under real domain configurations.
- ❌ Don't delete the v4 config file until v5 has been in production for
  a week. Keep it as a rollback reference.
- ❌ Don't run the codemod against the production branch directly.
  Always use a feature branch.
- ❌ Don't forget to update the `next-auth` version constraint in
  `package.json` after install — `npm install next-auth@beta` will pin
  to a specific beta; you want `^5.0.0` once stable.

---

## Triggers to Start the Migration

Pick one:
- [ ] A quiet 2-week window with no major feature work planned
- [ ] A security advisory that forces the upgrade
- [ ] A v5-only feature you really need (e.g., new OAuth provider, WebAuthn)
- [ ] v4 hits end-of-life (check next-auth.js.org for EOL dates)

Until then, v4 works fine. The Tier 2 features shipped in this PR don't
depend on v5.
