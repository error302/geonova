> **⚠️ ARCHIVED (2026-07-24):** This gap analysis is superseded by `docs/ROADMAP.md` (consolidated 2026-07-09) and `docs/MASTER_PLAN.md` (agent work plan). Unique findings have been cross-walked into ROADMAP Tier 1-4 items (G-NN IDs). This document is kept for historical reference only — do not act on findings here without checking ROADMAP.md first.

# METARDU — Professional Gap Analysis (Ground Truth Audit)
**Date:** 2026-05-06 | **Auditor:** Full source-level audit against the 16-item previous analysis

---

## VERDICT: The previous Claude analysis was ~60% wrong.

It claimed major categories were "MISSING" when they actually exist in the codebase. Below is what's ACTUALLY missing vs what already exists.

---

## CATEGORY-BY-CATEGORY TRUTH TABLE

### 1. Authentication & Authorization — ✅ MOSTLY EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| NextAuth.js | MISSING | ✅ EXISTS | `src/lib/auth.ts` — CredentialsProvider, bcrypt, JWT strategy, ISK fields |
| Auth routes | MISSING | ✅ EXISTS | `[...nextauth]/route.ts`, register, forgot-password, reset-password, update-password |
| Middleware | MISSING | ✅ EXISTS | `src/middleware.ts` — session token check, protected routes, public routes |
| RBAC | MISSING | ✅ EXISTS | `src/lib/auth/requireAuth.ts` — `requireAuth()` + `requireRole()` with UserRole enum |
| Session strategy | MISSING | ✅ EXISTS | JWT with 30-day maxAge, AUTH_SECRET enforcement |

**GAP:** `requireAuth()`/`requireRole()` exist but are NOT called in most API routes. The scheme routes manually check `getServerSession(authOptions)` instead of using the guard. This is inconsistent but functional.

**Action needed:** Add `requireAuth()` calls to API routes that don't check auth at all (tools routes, compute routes).

---

### 2. Input Validation & Data Integrity — ✅ EXISTS (partially deployed)

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Zod schemas | MISSING | ✅ EXISTS | `src/lib/validation/surveyData.ts` — CoordinateSchema, CreateProjectSchema, LevellingObservationSchema |
| Traverse validation | MISSING | ✅ EXISTS | `src/lib/validation/traverseValidation.ts` — angular misclosure check |
| Tolerance engine | MISSING | ✅ EXISTS | `src/lib/validation/toleranceEngine.ts` — 245 lines, Basak standards, 3 profiles |
| Sanitization | MISSING | ✅ EXISTS | `src/lib/security/sanitize.ts` — text, number, coordinate, bearing, email, point name |
| DB constraints | MISSING | ✅ EXISTS | `sql/025_scheme.sql` — NUMERIC types, UNIQUE, NOT NULL, DEFAULT values |
| Transaction safety | MISSING | ⚠️ PARTIAL | Some routes use BEGIN/COMMIT (projects, submission), most don't |

**GAP:** Zod schemas exist but are NOT used in many API routes. The audit-log route uses Zod; the projects route uses Zod; but most scheme routes do raw `req.json()` without validation.

**Action needed:** Deploy existing Zod schemas to all API routes.

---

### 3. Audit Trail / Data Provenance — ✅ EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| audit_logs table | MISSING | ✅ EXISTS | Referenced in `api/audit-log/route.ts`, `api/db/route.ts`, `api/analytics/route.ts` |
| Audit API route | MISSING | ✅ EXISTS | `src/app/api/audit-log/route.ts` — GET (list logs) + POST (create log) with auth check |
| Audit logger | MISSING | ✅ EXISTS | `src/lib/logger.ts` — `auditLog()` function with structured JSON output |
| CPD auto-logging | MISSING | ✅ EXISTS | Audit route auto-logs CPD activities for traverse/report/plan events |

**GAP:** The `auditLog()` function logs to console (PM2), not to the database. The API route writes to DB but is opt-in (client must POST). No DB triggers auto-log mutations.

**Action needed:** Add PostgreSQL triggers for INSERT/UPDATE/DELETE on parcels, blocks, traverse_results tables.

---

### 4. Coordinate Precision & Numerical Stability — ✅ EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| NUMERIC columns | MISSING | ✅ EXISTS | `sql/025_scheme.sql` — all coordinates are `NUMERIC(14,4)`, bearings `NUMERIC(10,6)`, areas `NUMERIC(12,6)` |
| Old tables still DOUBLE | — | ⚠️ TRUE | `supabase/migrations/014_leveling_runs.sql` uses DOUBLE PRECISION for RL/distance |
| DMS storage | MISSING | ✅ EXISTS | `traverse_observations` stores hcl_deg/hcl_min/hcl_sec separately |
| Misclosure checks | MISSING | ✅ EXISTS | `toleranceEngine.ts` + `traverseValidation.ts` + engine-level checks in all compute modules |

**GAP:** Legacy tables (leveling_runs, realtime cursors) still use DOUBLE PRECISION. New tables (scheme) correctly use NUMERIC.

**Action needed:** Migrate legacy tables from DOUBLE PRECISION to NUMERIC when those modules are touched.

---

### 5. Error Handling & Resilience — ✅ EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Error helper | MISSING | ✅ EXISTS | `src/lib/security/errors.ts` — structured error messages for PG codes (23505, 23503, 42501) |
| Error boundaries | MISSING | ✅ EXISTS | 4 separate error boundaries: `ErrorBoundary.tsx`, `CalculatorErrorBoundary.tsx`, `MapErrorBoundary`, `ui/ErrorBoundary.tsx` |
| Next.js error pages | MISSING | ✅ EXISTS | 6 error.tsx files: root, tools, project, process, fieldbook, dashboard |
| Auth error messages | MISSING | ✅ EXISTS | `getAuthErrorMessage()` and `getValidationError()` in errors.ts |

**GAP:** No global API error wrapper. Each route does its own try/catch. Inconsistent HTTP status codes across routes.

**Action needed:** Create an `apiHandler()` wrapper that standardizes try/catch, status codes, and error response format.

---

### 6. Database Migration Management — ⚠️ PARTIAL

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Migration scripts | MISSING | ✅ EXISTS | `scripts/phase25_scheme_tables.sql`, `phase27_parcel_traverse_tables.sql`, `phase31_team_workflow.sql`, `sql/025_scheme.sql` |
| Migration tracking | MISSING | ❌ MISSING | No `schema_migrations` table, no migration runner |
| Manual execution | — | ✅ TRUE | All migrations run manually via `psql -f` |

**GAP:** No automated migration system. 4+ SQL files exist but no tracking of which have been applied.

**Action needed:** Create a simple migration runner that tracks applied migrations in a `schema_migrations` table.

---

### 7. Testing — ✅ EXISTS (not zero)

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Unit tests | ZERO | ✅ 45+ TESTS | `src/lib/engine/__tests__/` — traverse, leveling, curves, area, cogo, distance, angles, coordinates, gnss, subdivision, etc. |
| Integration tests | ZERO | ✅ SOME | `tests/` directory — deedPlan, parcelNumber, beaconSymbols, safety, usv, geofusion, etc. |
| Survey plan tests | ZERO | ✅ EXISTS | `src/lib/reports/__tests__/` — traverseAccuracy, renderer |
| Engine verification | ZERO | ✅ EXISTS | `verify:engine` script in package.json |
| Test runner | ZERO | ✅ EXISTS | Jest configured (`"test": "jest"`) |

**GAP:** No API route integration tests. No E2E tests. No Playwright. Test coverage is engine-heavy but API-light.

**Action needed:** Add Zod validation tests and API route integration tests.

---

### 8. Version Control for Survey Data — ❌ MISSING

| Item | Previous Claim | Reality |
|---|---|---|
| Snapshot/version system | MISSING | ❌ CONFIRMED MISSING — no project_versions or data_versions table |
| Revision history UI | MISSING | ❌ MISSING — projects have a revision concept in types but no DB table |
| Immutable approved state | MISSING | ❌ MISSING |

**This is a real gap.** A deed plan that gets revised needs version tracking.

---

### 9. Reporting & Certificate Generation — ✅ MOSTLY EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Traverse computation sheet | MISSING | ✅ EXISTS | `src/lib/print/traverseSheet.ts` |
| Level book print | MISSING | ✅ EXISTS | `src/lib/print/levelBookPrint.ts` |
| Beacon certificate | MISSING | ✅ EXISTS | `src/lib/print/beaconCertificate.ts` + UI page |
| Setting out schedule | MISSING | ✅ EXISTS | `src/lib/print/settingOutSchedule.ts` |
| GNSS observation log | MISSING | ✅ EXISTS | `src/lib/print/gnssObservationLog.ts` |
| Earthworks BoQ | MISSING | ✅ EXISTS | `src/lib/print/earthworksBoQ.ts` |
| Deed plan print | MISSING | ✅ EXISTS | `src/lib/print/deedPlanPrint.ts` |
| Drone report | MISSING | ✅ EXISTS | `src/lib/print/droneReportPrint.ts` |
| Billable documents | MISSING | ✅ EXISTS | `src/lib/print/billableDocuments.ts` |
| Statutory workbook | MISSING | ✅ EXISTS | `src/lib/print/` + API route `api/tools/statutory-workbook/route.ts` |
| Survey report (14-section) | MISSING | ✅ EXISTS | `src/components/surveyreport/SurveyReportBuilder.tsx` |
| Shared print infrastructure | MISSING | ✅ EXISTS | `src/lib/print/buildPrintDocument.ts` + `PrintMetaPanel.tsx` |

**GAP:** Some generators exist without UI pages (earthworksBoQ, gnssObservationLog). Deed plan print needs wiring to the deed plan page. Mutation forms and PPA2 are in the scheme/submission route but not standalone.

---

### 10. Real-time Collaboration — ✅ EXISTS (partially)

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Real-time infra | MISSING | ✅ EXISTS | `src/lib/realtime/index.ts` — user presence, cursor tracking, activity feed |
| Poll endpoint | MISSING | ✅ EXISTS | `src/app/api/realtime/poll/route.ts` |
| Team workflow | MISSING | ✅ EXISTS | `scripts/phase31_team_workflow.sql` + `api/scheme/assign/route.ts` + `api/scheme/activity/route.ts` |
| Optimistic locking | MISSING | ❌ MISSING | No version/timestamp check on concurrent edits |

**GAP:** No optimistic locking. Two surveyors editing the same parcel will silently overwrite each other.

---

### 11. Map Integration — ✅ EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| OpenLayers | MISSING | ✅ EXISTS | `ol` v10.8.0 in package.json, `src/app/map/MapClient.tsx` |
| Map error boundary | MISSING | ✅ EXISTS | `MapErrorBoundary` in MapClient.tsx |
| OL CSS global | MISSING | ✅ EXISTS | `@import 'ol/ol.css'` in globals.css |
| proj4 integration | MISSING | ✅ EXISTS | `proj4` v2.20.6 in package.json, SRID 21037 support |

**GAP:** Map doesn't render parcel boundaries from scheme data yet. Map exists but is disconnected from the scheme feature.

---

### 12. Data Export & Interoperability — ✅ MOSTLY EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| CSV export | MISSING | ✅ EXISTS | Multiple tools have CSV export |
| DXF export | MISSING | ✅ EXISTS | `dxf-writer` v1.18.4 in package.json, 6 components using dynamic import |
| GeoJSON export | MISSING | ✅ EXISTS | `@tmcw/togeojson` + GIS export tools |
| Excel export | MISSING | ✅ EXISTS | `exceljs` v4.4.0 in package.json, statutory workbook generator |
| PDF generation | MISSING | ✅ EXISTS | `pdf-lib` + `jspdf` + `docx` in package.json, 11 print generators |
| Total station import | MISSING | ✅ EXISTS | `src/lib/parsers/totalStation.ts` — GSI, JobXML, generic CSV |
| KML export | MISSING | ⚠️ PARTIAL | `@tmcw/togeojson` can convert TO GeoJSON; KML export not explicit |
| Submission ZIP | MISSING | ✅ EXISTS | `jszip` + `api/scheme/submission/route.ts` — full package generation |

---

### 13. Security Hardening — ✅ MOSTLY EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Rate limiting | MISSING | ✅ EXISTS | `src/lib/security/rateLimit.ts` — Upstash Redis + in-memory fallback |
| CORS | MISSING | ✅ EXISTS | `src/lib/cors.ts` — origin whitelist + preflight handler |
| SQL injection prevention | UNKNOWN | ✅ DONE | All routes use parameterized `db.query(sql, [params])` |
| XSS prevention | MISSING | ✅ EXISTS | `src/lib/security/sanitize.ts` — script tag stripping, angle bracket removal |
| HTTPS/HSTS | MISSING | ✅ EXISTS | nginx config (referenced in worklog) with TLS 1.3 + security headers |
| .env in gitignore | UNKNOWN | ✅ EXISTS | `.env.production` added to .gitignore per worklog |
| Dependency audit | MISSING | ✅ EXISTS | GitHub Actions weekly-security.yml + npm audit in pr-checks.yml |
| Sentry | MISSING | ✅ EXISTS | `@sentry/nextjs` v10.43.0 in package.json |

---

### 14. UI/UX Principles — ✅ PARTIALLY EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| Dark mode | MISSING | ✅ EXISTS | `next-themes` v0.4.6 + `Sonner` component uses `useTheme()` |
| Toast notifications | MISSING | ✅ EXISTS | `sonner` + Radix `@radix-ui/react-toast` + `use-toast` hook |
| Responsive design | MISSING | ✅ PARTIAL | `max-w-7xl mx-auto px-4` convention, Capacitor mobile config |
| Loading states | MISSING | ✅ PARTIAL | Some pages have loading spinners, inconsistent |
| Error boundaries | MISSING | ✅ EXISTS | 4 error boundary components + 6 error.tsx pages |
| Keyboard shortcuts | MISSING | ❌ MISSING | No keyboard shortcut system |
| Undo/redo | MISSING | ❌ MISSING | No undo/redo for traverse observations |
| Bulk operations | MISSING | ❌ MISSING | No multi-select on parcel/block tables |
| Pagination | MISSING | ⚠️ PARTIAL | Audit log limits to 100; most tables don't paginate |
| TanStack Query | MISSING | ✅ EXISTS | `@tanstack/react-query` + `@tanstack/react-table` in package.json |

---

### 15. Deployment & DevOps — ✅ EXISTS

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| CI/CD pipeline | MISSING | ✅ EXISTS | `.github/workflows/` — pr-checks.yml, deploy.yml, weekly-security.yml |
| PM2 config | MISSING | ✅ EXISTS | `ecosystem.config.cjs` |
| Health check | MISSING | ✅ EXISTS | `src/app/api/public/health/route.ts` |
| Backup script | MISSING | ✅ EXISTS | `scripts/backup.sh` — 7-day retention |
| Docker testing | MISSING | ✅ EXISTS | `docker-compose.testing.yml` + npm scripts |
| Mobile build | MISSING | ✅ EXISTS | Capacitor config + `mobile:build` script |

---

### 16. Performance — ⚠️ PARTIAL

| Item | Previous Claim | Reality | File |
|---|---|---|---|
| React Query cache | MISSING | ✅ EXISTS | `@tanstack/react-query` installed, `src/lib/cache/reactQuery.ts` exists |
| React Query in pages | — | ❌ NOT DEPLOYED | No `QueryClientProvider` usage found in pages |
| Virtualized lists | MISSING | ❌ MISSING | No `react-window` or similar |
| Connection pooling | UNKNOWN | ✅ EXISTS | `db.ts` Pool with max connections configured |
| Dynamic imports | MISSING | ✅ EXISTS | Heavy components use `next/dynamic` with `ssr: false` |

---

## ACTUAL GAPS (confirmed missing or incomplete)

### P0 — Must Fix Before Professional Use

| # | Gap | Why It Matters | Effort |
|---|---|---|---|
| G1 | **requireAuth() not called in most API routes** | Any unauthenticated user can hit compute endpoints | 2h — add to each route file |
| G2 | **Zod validation not deployed to all API routes** | Garbage data can enter DB through scheme routes | 3h — wrap each route's req.json() |
| G3 | **No optimistic locking on concurrent edits** | Two surveyors silently overwrite each other's parcel data | 4h — add updated_at timestamp check to PATCH routes |
| G4 | **No data versioning / revision history** | Legal requirement — deed plan revisions must be traceable | 8h — project_revisions table + UI |

### P1 — Professional Quality

| # | Gap | Why It Matters | Effort |
|---|---|---|---|
| G5 | **No API route integration tests** | API regressions go undetected | 4h — Vitest + MSW for 5 key routes |
| G6 | **React Query installed but not deployed** | All pages do raw fetch() without caching | 6h — wrap data fetching in QueryClientProvider + useQuery |
| G7 | **No global API error wrapper** | Inconsistent error handling across 30+ routes | 2h — apiHandler() HOF |
| G8 | **Legacy tables use DOUBLE PRECISION** | Floating-point imprecision in leveling runs | 3h — migration script for legacy tables |
| G9 | **Audit log writes are opt-in only** | No DB triggers auto-log mutations to parcels/blocks | 4h — PostgreSQL triggers |
| G10 | **No migration tracking system** | Can't tell which scripts have been applied | 3h — schema_migrations table + runner |

### P2 — Nice to Have

| # | Gap | Why It Matters | Effort |
|---|---|---|---|
| G11 | **No undo/redo for field book edits** | Surveyor accidentally clears observations | 6h — command pattern |
| G12 | **No keyboard shortcuts** | Power users need efficiency | 4h — useHotkeys hook |
| G13 | **No bulk operations on tables** | Selecting 50 parcels → change status | 4h — multi-select UI |
| G14 | **No virtualized lists** | 500+ parcels will lag the page | 2h — react-window on data tables |
| G15 | **Map disconnected from scheme data** | Can't see parcel boundaries on map | 8h — GeoJSON layer from DB |

---

## WHAT THE PREVIOUS ANALYSIS GOT RIGHT

These items were correctly identified as missing:
- **Data versioning** (G4) — genuinely missing
- **Optimistic locking** (G3) — genuinely missing
- **Undo/redo** (G11) — genuinely missing
- **Keyboard shortcuts** (G12) — genuinely missing

## WHAT THE PREVIOUS ANALYSIS GOT WRONG

These were claimed as "MISSING" but actually EXIST:
- Auth (NextAuth + middleware + RBAC) — fully implemented
- Zod validation — exists, just not deployed everywhere
- Audit trail — exists (table + API + logger)
- Error handling — exists (4 error boundaries, 6 error pages, structured error messages)
- Rate limiting — exists (Upstash + in-memory)
- CORS — exists with origin whitelist
- Testing — 45+ unit tests exist
- Map integration — OpenLayers is working
- Data export — DXF, GeoJSON, CSV, Excel, PDF all exist
- Security hardening — Sentry, rate limiting, CORS, sanitization, HSTS all exist
- CI/CD — GitHub Actions with PR checks, deploy, weekly security scan
- Toast notifications — Sonner + Radix toast
- Dark mode — next-themes installed
- Health check endpoint — exists
- Backup scripts — exists
- TanStack Query/React Table — installed
