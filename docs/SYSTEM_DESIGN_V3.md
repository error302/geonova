# Metardu System Design — v0.3

Per `wondelai/system-design` skill: requirements first, architecture second.
This document captures capacity estimates, caching strategy, sync queue
architecture, RPO/RTO, and the NextAuth v5 migration plan.

## 1. Requirements

### Functional
- 9 survey types (cadastral, engineering, topographic, geodetic, mining,
  hydrographic, drone, deformation, mixed) with 5-step workflow each
- 40+ calculator tools (traverse, leveling, COGO, curves, volumes, etc.)
- Offline-first PWA + Capacitor mobile for field work
- Document generation: deed plans (Form No. 4), RDM 1.1 reports, NLIMS exports
- Multi-tenant with RBAC (surveyor, org_admin, admin, super_admin)

### Non-functional
- **Latency:** p50 < 200ms for read endpoints, p99 < 2s for calculator compute
- **Availability:** 99.5% (43 min/month downtime budget)
- **RPO:** 0 (survey data is legal evidence — no data loss acceptable)
- **RTO:** 4 hours
- **Offline:** full create/update capability offline, sync on reconnect

## 2. Capacity estimation

### Assumptions
- 1,000 active surveyors (Year 1 target)
- Each surveyor: 5 projects/month, 200 observations/project
- → 1,000,000 observations/month
- → ~0.4 QPS average, ~2 QPS peak (5× average)
- Storage: ~1KB per observation → 1GB/month observation data
- Plus projects, parcels, deed plans, audit logs: ~3GB/month total

### Implications
- **Single Postgres handles this trivially.** Vertical scaling first, shard last.
- Next 2-3 years: scale up the Postgres instance (more CPU/RAM), add read
  replicas only if read QPS grows faster than projected.
- No need for sharding until ~10,000 active surveyors (10× current target).

### Calculator QPS
- Calculators are deterministic → highly cacheable
- Same inputs → same outputs → cache by hash of inputs
- Expected cache hit rate: 60-80% (surveyors re-run with small input variations)

## 3. Caching strategy

### Cache layers
1. **Browser** — React Query staleTime 5min for reads, infinite for calculator results
2. **CDN** — static assets via Next.js, no dynamic content cached at CDN
3. **Application** — Redis cache-aside for calculator results
4. **Database** — Postgres shared buffers (tune `shared_buffers` to 25% of RAM)

### Calculator cache (Redis)
```
Key:   calc:traverse:${sha256(JSON.stringify(input))}
Value: JSON result
TTL:   infinite (until schema version changes)
```

Invalidation: bump `CALC_SCHEMA_VERSION` env var when algorithm changes.
On cache miss: compute, store, return. On cache hit: return immediately.

### Cache anti-patterns to avoid
- **No caching without invalidation strategy** (per system-design skill)
- **No cache-aside without TTL fallback** — if Redis is down, fall through to
  compute (don't fail the request)
- **No caching of auth/session data in Redis** — use NextAuth's session strategy
  (JWT or DB) instead

## 4. Offline sync queue architecture

### Design
- Client enqueues mutations in IndexedDB when offline (see `offline-queue.ts`)
- Each mutation gets a client-generated UUID
- On reconnect, FIFO sync to server
- Server reconciles by `X-Client-UUID` header (idempotent — same UUID = no dup)

### Conflict resolution
- **Last-write-wins** for most fields (surveyor overwrites their own draft)
- **Optimistic locking** via `updated_at` for collaborative projects (multiple
  surveyors on same project) — `apiHandler` already supports `optimisticLock: true`
- **UUID-based dedup** — if client retries a mutation that already succeeded,
  server returns the original result instead of creating a duplicate

### Queue limits
- Max 1000 pending mutations per client ( IndexedDB storage budget)
- If exceeded, oldest mutations are dropped with a warning
- Surveyor notified via UI when queue is > 50 items

### Failure modes
| Scenario | Behavior |
|----------|----------|
| Network error during sync | Stop sync, retry next online event |
| 4xx response | Drop mutation (client error, won't succeed) |
| 5xx response | Increment attempts, retry next sync |
| Attempts > 5 | Drop mutation, log to audit, notify user |
| IndexedDB unavailable | Fall back to in-memory queue (lost on page close) |

## 5. Reliability & operations

### Health checks
- `GET /api/health/live` — process alive (no deps)
- `GET /api/health/ready` — DB connected, ready to serve
- Docker: `HEALTHCHECK CMD curl -f http://localhost:3000/api/health/ready`
- PM2: `pm2 healthcheck http://localhost:3000/api/health/live`

### Deployment strategy
- **Rolling** for minor releases (zero downtime, slow canary)
- **Blue-green** for major schema migrations (flip traffic atomically)
- **Canary** for risky calculator changes (route 10% traffic to new algorithm,
  compare outputs against golden master before full rollout)

### Backup & DR
- **Continuous WAL archiving** to S3 (RPO = 0 — recover to any point in time)
- **Daily logical backups** via `pg_dump` (for fast point-in-time restore)
- **Tested restore procedure** — quarterly DR drill, documented runbook
- **Multi-AZ** Postgres replica in standby (promote on primary failure)

### Monitoring
- Sentry for error tracking (already integrated)
- Structured logs via Pino (JSON, with request ID for tracing)
- Metrics: QPS, p50/p99 latency, error rate, cache hit rate, queue depth
- Alerts: error rate > 1%, p99 > 5s, queue depth > 100, DB connections > 80%

## 6. NextAuth v4 → v5 (Auth.js) migration plan

### Why migrate
Per `better-auth-best-practices` skill (transferable to NextAuth):
- v5 has proper session strategy choices (JWT vs database)
- Cookie-cached sessions for read performance (no DB hit per request)
- Hooks for post-creation defaults (auto-create default project on register)
- Built-in rate limiting on auth endpoints
- Better TypeScript support (typed sessions, typed callbacks)

### Migration scope
1. **Schema migration** — NextAuth v5 uses different table shapes:
   - `users` table: add `emailVerified` timestamp field
   - `accounts` table: column renames (`providerAccountId` → `providerAccountId`)
   - `sessions` table: optional if using JWT strategy
2. **Config migration** — `authOptions` → `auth.ts` config object
3. **Route handler** — `app/api/auth/[...nextauth]/route.ts` updated
4. **Session provider** — `<SessionProvider>` import path changes
5. **Server session** — `getServerSession(authOptions)` → `auth()` function
6. **Hooks** — `events.createUser` callback for auto-creating default project

### Session strategy decision
**Recommendation: JWT with database fallback.**
- JWT for read performance (no DB hit on every request to check `user.role`)
- DB fallback for revocation (mark user `disabled`, JWT check fails on next refresh)
- Cookie cache: 5 min TTL for session data (role, plan, region)

### Rate limiting (auth endpoints)
- `/api/auth/sign-in`: 5 attempts / 15 min / IP
- `/api/auth/register`: 3 attempts / hour / IP
- `/api/auth/reset-password`: 3 attempts / hour / IP
- Exponential lockout: 1st failure → 1 min, 2nd → 5 min, 3rd → 15 min

### Hooks (post-creation defaults)
```ts
// auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... config
  events: {
    async createUser({ user }) {
      // Auto-create default surveyor profile
      await db.surveyorProfile.create({
        data: { userId: user.id, region: 'Kenya · 36S', plan: 'free' }
      })
      // Auto-create onboarding project
      await db.project.create({
        data: { userId: user.id, name: 'My first project', type: 'cadastral' }
      })
    },
  },
})
```

### Migration steps (1-2 weeks)
1. **Day 1-2:** Install `next-auth@beta`, create `auth.ts` config, run migration
   CLI to diff schema
2. **Day 3-4:** Apply Prisma schema migration, update route handler, update
   `<SessionProvider>` in root layout
3. **Day 5-7:** Find-and-replace `getServerSession(authOptions)` → `auth()` across
   all server components and route handlers (200+ sites — use codemod)
4. **Day 8-9:** Add `events.createUser` hook for auto-creating surveyor profile
   and onboarding project
5. **Day 10:** Add rate limiting to auth endpoints via `apiHandler` wrapper
6. **Day 11-12:** E2E test all auth flows (login, register, password reset,
   OAuth, 2FA, session refresh, logout)
7. **Day 13-14:** Staged rollout — deploy to staging, smoke test with real
   surveyors, deploy to production

### Rollback plan
- Keep NextAuth v4 config intact (don't delete `authOptions` export)
- Feature flag: `NEXT_PUBLIC_AUTH_V5=false` to fall back to v4
- If v5 breaks production: revert deploy, set flag false, v4 resumes

## 7. Future work (out of v0.3 scope)

- **Redis cache-aside** for calculator results (Phase 6, after usage data justifies it)
- **Async sync queue** with BullMQ + Redis (Phase 6, when queue depth > 1000 typical)
- **Multi-region** deployment (Phase 7, when expanding beyond East Africa)
- **Custom Metardu skills** via `skill-creator` (Phase 8, internal documentation)
