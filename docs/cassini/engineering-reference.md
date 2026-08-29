# METARDU — Full Startup Engineering Team Reference

> **PERSISTENT CONTEXT DOCUMENT** — Re-send this file when AI context resets to resume work from exactly where you left off.
>
> **Repo**: `git@github.com:error302/metardu.git` | **Branch**: `main` | **Last commit**: `d0cb39a3`
> **Deploy VM**: (address managed via environment — audit C-01) | **Domain**: `metardu.space`
> **Local path**: `/home/z/my-project/metardu-repo/`
> **Output path**: `/home/z/my-project/download/`

---

## TABLE OF CONTENTS

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Persona 1: Full-Stack MVP Builder](#2-persona-1-full-stack-mvp-builder)
3. [Persona 2: Senior Codebase Auditor](#3-persona-2-senior-codebase-auditor)
4. [Persona 3: Production Debugging Engineer](#4-persona-3-production-debugging-engineer)
5. [Persona 4: Performance Optimization Engineer](#5-persona-4-performance-optimization-engineer)
6. [Persona 5: Clean Architecture Rebuilder](#6-persona-5-clean-architecture-rebuilder)
7. [Persona 6: Backend Systems Architect](#7-persona-6-backend-systems-architect)
8. [Persona 7: Senior Frontend Engineer](#8-persona-7-senior-frontend-engineer)
9. [Persona 8: AI Technical Lead](#9-persona-8-ai-technical-lead)
10. [Persona 9: UI/Component Architect](#10-persona-9-uicomponent-architect)
11. [Persona 10: Production Security Engineer](#11-persona-10-production-security-engineer)
12. [Persona 11: Senior DevOps & Deployment Engineer](#12-persona-11-senior-devops--deployment-engineer)
13. [Active Task Tracker](#13-active-task-tracker)
14. [Critical Bug Log](#14-critical-bug-log)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2 |
| Language | TypeScript | 5.3 (strict) |
| UI | React + Tailwind CSS + shadcn/ui (Radix) | 18 / 3.4 / New York |
| Database | PostgreSQL + PostGIS (raw `pg` driver, NO ORM) | - |
| Auth | NextAuth v4 (credentials, JWT 30-day) | 4.24 |
| State | Zustand (2 stores) + React Context | latest |
| Payments | Stripe + PayPal + M-Pesa + Airtel Money | - |
| Maps | OpenLayers 10.8 + proj4 (EPSG:21037 Kenya) | 10.8 |
| Mobile | Capacitor (Android) + PWA | - |
| Monitoring | Sentry | - |
| Deploy | Docker multi-stage + Caddy reverse proxy | - |

### 1.2 Scale Metrics

| Metric | Count |
|---|---|
| Page Routes | 158 `page.tsx` files |
| API Routes | 173 `route.ts` files |
| Components | 275 `.tsx` files (56 shadcn/ui primitives) |
| Lib Modules | 554 `.ts` files across 60+ directories |
| Type Definitions | 43 files |
| Custom Hooks | 14 files |
| Database Migrations | 13 SQL files |
| i18n Languages | 14 (only EN has ~16 keys populated) |
| Web Workers | 3 |
| Tests | 16 unit + 5 e2e |
| Skills (AI agent) | 57 directories |

### 1.3 Directory Structure (Key Paths)

```
src/
├── app/
│   ├── layout.tsx              # Root layout → AuthProvider → AppShell → children
│   ├── page.tsx                # Landing page (805 lines, framer-motion)
│   ├── admin/
│   │   ├── layout.tsx          # Admin sidebar layout (already created, working)
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── payments/page.tsx   # Admin payments (created in prev session)
│   │   └── users/page.tsx      # Admin user management
│   ├── field/
│   │   └── map/page.tsx       # Field map (NEEDS Kenya UI rewrite)
│   ├── dashboard/page.tsx      # Main dashboard (N+1 query issue)
│   ├── tools/                  # 47+ individual tool pages
│   ├── api/                    # 173 API routes
│   └── ... (login, register, projects, etc.)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx        # Route-aware shell (CREATED, working)
│   │   ├── QuickCompute.tsx    # FAB button + slide panel (positioning bug)
│   │   ├── ProjectionInit.tsx  # OL projection registration
│   │   └── ...
│   ├── NavBar.tsx              # Top nav (617 lines, dual auth bug)
│   ├── MobileNav.tsx           # Bottom tab bar (239 lines)
│   ├── FeedbackWidget.tsx      # Feedback FAB (positioning bug)
│   ├── field/MapViewer.tsx     # Kenya map component (294 lines)
│   ├── ui/                     # 56 shadcn/ui components
│   └── ... (219 domain components across 35 subdirs)
├── lib/
│   ├── db.ts                   # PostgreSQL pool + RLS context
│   ├── db/queryBuilder.ts      # Custom Supabase-compatible query builder (455 lines)
│   ├── auth.ts                 # NextAuth config (171 lines)
│   ├── rbac.ts                 # Domain role system (123 lines)
│   ├── auth/rbac.ts            # Admin role system
│   ├── i18n/                   # Custom i18n (NOT next-intl despite being installed)
│   ├── security/               # CSP, CSRF, rate limit, sanitization (7 files)
│   ├── engine/                 # Pure computation math (31 files)
│   ├── compute/                # Computation orchestrators (28 files)
│   ├── engineering/             # Road engineering (12 files + 8 tests)
│   ├── export/                 # DXF/GeoJSON/Shapefile/IFC (19 files)
│   ├── generators/             # PDF/DOCX generators (22 files)
│   ├── map/                    # OL layers/editing (16 files)
│   ├── payments/               # Stripe/PayPal/M-Pesa (4 files)
│   ├── submission/             # Submission workflow (14 files)
│   └── ... (554 total .ts files)
├── stores/
│   ├── uiStore.ts              # Global UI state (252 lines)
│   └── projectStore.ts         # Project data (510 lines)
├── hooks/                      # 14 custom hooks
├── types/                      # 43 type definition files
└── messages/                   # i18n JSON (14 languages, only EN has ~16 keys)
```

### 1.4 Database Schema Highlights

- **No ORM** — Raw PostgreSQL via `pg` Pool with custom `QueryBuilder` class
- **PostGIS** — All spatial tables use geometry columns with GIST indexes
- **Migrations** — 13 versioned SQL files (000–012), idempotent
- **Core tables**: `users`, `profiles`, `surveyor_profiles`, `projects`
- **Survey tables**: `parcel_traverses`, `traverse_observations`, `level_networks`, `road_alignments`, `cross_section_stations`
- **Business tables**: `equipment`, `payment_history`, `user_subscriptions`, `audit_logs`
- **Government**: `public_beacons`, `submissions`, `deed_plans`

### 1.5 Context Provider Nesting

```
layout.tsx → AuthProvider → AppShell →
  AppUpdateBanner + OfflineIndicator + ProjectionInit →
  LanguageProvider → CountryProvider → SubscriptionProvider → [children]
```

### 1.6 AppShell Route Logic

```
/field/map/*    → Full-screen mode (no NavBar, no Footer, no FABs)
/admin/*        → Admin mode (no NavBar, no Footer, no FABs — admin has own layout)
/all others     → Full app shell (NavBar + Footer + QuickCompute + Feedback + MobileNav)
```

---

## 2. PERSONA 1: FULL-STACK MVP BUILDER

### 2.1 System Architecture Assessment

**Architecture Type**: Monolithic Next.js 14 App Router application with standalone output mode.

**Strengths for MVP**:
- App Router file-based routing scales well
- Standalone output enables Docker containerization
- Comprehensive feature coverage (47+ tools) provides immediate value
- Mobile-first via Capacitor + PWA

**Architectural Risks**:
- Monolith with 158 pages + 173 API routes is at the upper bound of manageable monolith size
- No micro-service boundary defined — if traffic spikes, entire app must scale together
- No ORM means every query is hand-written SQL (fragile for schema changes)

### 2.2 What to Build If Starting Fresh

**Recommended MVP Architecture**:
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js App  │────▶│  API Layer   │────▶│  PostgreSQL  │
│  (React SSR)  │     │  (tRPC/REST) │     │  + PostGIS   │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │                    │
       │             ┌──────┴───────┐
       │             │  Redis Cache  │
       │             └──────────────┘
       │
  ┌────┴────┐
  │ Capacitor │ (Mobile)
  └──────────┘
```

**Key decisions METARDU got right**: Standalone Next.js output, PostGIS for spatial, Capacitor for mobile, multi-payment providers for African market.

**Key decisions METARDU got wrong**: No ORM (Drizzle ORM would be ideal for this stack), no tRPC (raw API routes with inconsistent patterns), no shared API handler adoption.

---

## 3. PERSONA 2: SENIOR CODEBASE AUDITOR

### 3.1 Bad Architecture Decisions

| # | Issue | Severity | Location |
|---|---|---|---|
| A1 | **No ORM** — raw SQL everywhere via custom QueryBuilder | HIGH | `lib/db/queryBuilder.ts` |
| A2 | **Dual auth systems** — NextAuth + Supabase auth used simultaneously | CRITICAL | `NavBar.tsx`, `MobileNav.tsx` |
| A3 | **Dual RBAC systems** — `lib/rbac.ts` vs `lib/auth/rbac.ts` with ad-hoc bridge | HIGH | `auth.ts`, `rbac.ts` |
| A4 | **`typescript.ignoreBuildErrors: true`** — TypeScript errors silently ignored | CRITICAL | `next.config.js` |
| A5 | **ESLint fully disabled** — all rules `"off"` | HIGH | `eslint.config.mjs` |
| A6 | **`zustand` not in `package.json`** — stores will crash if imported | CRITICAL | `package.json` vs `stores/*.ts` |
| A7 | **React Query installed but completely unused** — wasted bundle | MEDIUM | `package.json` vs components |
| A8 | **`next-intl` installed but unused** — dead dependency, custom i18n used instead | MEDIUM | `package.json` vs `lib/i18n/` |
| A9 | **`better-sqlite3` in dependencies alongside `pg`** — unclear purpose | LOW | `package.json` |
| A10 | **Admin pages wrapped by root layout NavBar** (FIXED by AppShell) | RESOLVED | `layout.tsx` → `AppShell.tsx` |

### 3.2 Duplicate Logic

| Duplicate | Files | Impact |
|---|---|---|
| Auth check | `NavBar.tsx`, `MobileNav.tsx`, `dashboard/page.tsx`, `admin/layout.tsx` | 4 different auth patterns |
| Supabase client creation | `createClient()` called independently in 20+ components | No connection pooling |
| i18n `t()` function | `LanguageContext.tsx` + `getServerTranslator()` + raw English strings | Inconsistent usage |
| Error handling | Some routes use `apiHandler`, others manual try/catch | Inconsistent error responses |
| Rate limiting | Middleware rate limit + `apiHandler` rate limit + in-memory login limiter | 3 different systems |

### 3.3 Performance Bottlenecks

| Bottleneck | Location | Impact |
|---|---|---|
| Dashboard N+1 queries | `dashboard/page.tsx` lines 53-69 | Fetches point_count and parcel_count per-project in loop |
| `MapClient.tsx` monolith | 1000+ lines single component | Hard to optimize, no code splitting |
| OpenLayers CDN fallback | `MapViewer.tsx` | 37 separate dynamic imports |
| `landing page` 805 lines | `app/page.tsx` | Heavy framer-motion + inline SVGs, no lazy loading |
| In-memory rate limiting | Falls back when Redis unavailable | No protection in serverless/multi-instance |

### 3.4 Scalability Risks

| Risk | Why it matters |
|---|---|
| Single pg Pool (max 20 connections) | Connection exhaustion under load |
| No connection pooling at pg-bouncer level | Direct connections to Postgres |
| No Redis for session storage | JWT-only, no server-side session invalidation |
| In-memory brute-force store | Resets on cold start |
| No CDN for static assets | Caddy serves everything |
| No image optimization pipeline | Raw images stored in GCS |
| 158 client-side pages | Bundle size will grow unbounded |

### 3.5 Maintainability Issues

| Issue | Impact |
|---|---|
| 554 lib .ts files with no barrel exports | Import paths are deep and fragile |
| 3 validation libraries (Zod, custom sanitize, QueryBuilder validation) | Confusion about which to use |
| `as any` type casts in 15+ locations | Type safety is illusory |
| No storybook or component documentation | UI components undocumented |
| 13/14 i18n locales are empty stubs | Can't ship to non-English markets |
| Mixed styled-jsx + Tailwind | Inconsistent styling approach |

---

## 4. PERSONA 3: PRODUCTION DEBUGGING ENGINEER

### 4.1 Root Cause Analysis — Active Bugs

#### BUG 1: QuickCompute & FeedbackWidget FAB Overlap
**Status**: UNFIXED
**Root Cause**: Both FABs are positioned at the bottom-right with overlapping z-index and vertical positions.
- QuickCompute FAB: `fixed bottom-28 right-4 md:bottom-10 md:right-6 z-40` (height ~48px, occupies ~64–112px from bottom on mobile)
- FeedbackWidget FAB: `fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40` (height ~36px, occupies ~44–80px from bottom on mobile)
- **Overlap zone on mobile**: 64–80px from bottom (16px overlap)
- **Overlap zone on desktop**: QuickCompute at bottom-10 (40px), Feedback at bottom-6 (24px) — same overlap

**Fix**: Stack them vertically with guaranteed gap:
- FeedbackWidget: `bottom-6 right-4 md:bottom-6 md:right-6` (keep)
- QuickCompute: `bottom-16 right-4 md:bottom-20 md:right-6` (move up to create gap)

#### BUG 2: Admin Pages 404
**Status**: PARTIALLY FIXED (AppShell created, admin/layout.tsx exists)
**Root Cause**: Root `layout.tsx` was rendering NavBar for ALL routes, conflicting with admin pages' own sidebar layout.
**Fix Applied**: Created `AppShell.tsx` that checks `usePathname()` and skips NavBar/Footer/FABs for `/admin/*` routes.
**Remaining**: Verify admin/payments page renders correctly, verify admin/overview exists.

#### BUG 3: Field Map Kenya UI Rewrite Lost
**Status**: UNFIXED
**Root Cause**: Previous session's context ran out before the field/map/page.tsx rewrite was committed.
**Required spec**: Zero-obstruction full-screen map with:
- FAB stack (right side): QuickCompute, Export, Layers, Measure
- Zoom controls (bottom-left): +/- buttons
- GPS badge (top-left): coordinate display below title
- Title bar (top-center): "Field Map — Kenya"
- Export drawer (left side, slide-in)
- Kenya bounding box: `[33.90, -4.72, 41.92, 4.62]` EPSG:4326

#### BUG 4: i18n Only 16 Keys
**Status**: UNFIXED
**Root Cause**: `messages/en.json` has only ~16 keys. 95% of UI is hardcoded English.
**Impact**: Non-English users see raw English for almost everything.

#### BUG 5: Zustand Not in package.json
**Status**: UNFIXED (may be unused)
**Root Cause**: `uiStore.ts` and `projectStore.ts` import from `zustand` but it's not in dependencies.
**Risk**: Runtime crash if these stores are imported. Need to verify if any component actually imports them.

### 4.2 Hidden Edge Cases

| Edge Case | Risk |
|---|---|
| NLIMS API returns empty parcel | `nlims/lookup` has no auth — data exposure |
| PayPal sandbox skips webhook verification | Spoofed payment confirmations possible |
| Build-time dummy AUTH_SECRET deployed to prod | All JWTs forgeable |
| ` ADMIN_EMAILS` env var has public email | Anyone matching gets super_admin |
| Dashboard with 100+ projects | N+1 queries = 200+ DB calls per page load |

---

## 5. PERSONA 4: PERFORMANCE OPTIMIZATION ENGINEER

### 5.1 Performance Issue Breakdown

#### Critical Performance Issues

| Issue | Current State | Target State | Estimated Impact |
|---|---|---|---|
| Dashboard N+1 queries | 2N+1 queries (N=projects) | 2 queries (batch) | 10x faster for 50+ projects |
| MapClient.tsx monolith | 1000+ lines, 37 dynamic imports | Code-split map modules | 50% faster initial map load |
| Landing page no code splitting | 805 lines loaded at once | Lazy-loaded sections | 40% faster LCP |
| No image optimization | Raw GCS images | Next.js `<Image>` + CDN | 60% smaller images |
| No React Query caching | Every mount = new fetch | Stale-while-revalidate | Eliminate redundant fetches |

#### Memory Leak Candidates

| Location | Issue |
|---|---|
| `MapClient.tsx` | OpenLayers map not properly disposed on unmount |
| `FeedbackWidget.tsx` | Base64 screenshot stored in state (can be multi-MB) |
| `NavBar.tsx` | New Supabase client created on every render cycle |
| `projectStore.ts` | Unbounded arrays for control points, observations, parcels |

### 5.2 Optimization Strategies

1. **Adopt React Query** (already installed!) — Replace all `useState/useEffect + Supabase` with `useQuery/useMutation`
2. **Batch dashboard queries** — Single SQL with JOINs instead of per-project counts
3. **Split MapClient** — Extract draw/measure/import/export into separate hooks/components
4. **Add `loading="lazy"` to images** — Native lazy loading for all `<img>` tags
5. **Enable Next.js Image component** — Auto-optimize, WebP, responsive srcset
6. **Virtualize long lists** — React Virtuoso for tool lists, project lists, user lists
7. **Add pg-bouncer** — Connection pooling between Next.js and PostgreSQL
8. **Implement ISR** — `revalidate` for dashboard, tools page, pricing page

---

## 6. PERSONA 5: CLEAN ARCHITECTURE REBUILDER

### 6.1 Current vs Proposed Architecture

**Current Problems**:
- 554 lib files with flat module organization
- No clear domain boundaries
- Mixed concerns (e.g., `auth.ts` has both config + brute-force protection)
- Components create their own Supabase clients (no DI)

**Proposed Folder Structure**:
```
src/
├── app/                           # Next.js App Router (routes only)
│   ├── (auth)/                   # Auth route group
│   ├── (dashboard)/              # Dashboard route group
│   ├── (admin)/                  # Admin route group
│   ├── (tools)/                  # Tools route group
│   └── (field)/                  # Field route group
├── domains/                      # Domain-driven design modules
│   ├── auth/
│   │   ├── api/                  # Auth API routes (thin controllers)
│   │   ├── components/           # Auth UI components
│   │   ├── hooks/               # Auth hooks
│   │   ├── services/            # Auth business logic
│   │   └── types/               # Auth types
│   ├── survey/
│   ├── project/
│   ├── payment/
│   ├── admin/
│   └── field/
├── infrastructure/                # Shared infrastructure
│   ├── db/                       # Database (ORM migration to Drizzle)
│   ├── cache/                    # Redis caching
│   ├── storage/                  # File storage
│   ├── auth/                     # NextAuth config
│   └── i18n/                     # Internationalization
├── shared/                        # Cross-cutting
│   ├── components/               # Shared UI components
│   ├── hooks/                    # Shared hooks
│   ├── utils/                    # Shared utilities
│   └── types/                    # Shared types
└── config/                        # Environment & app config
```

### 6.2 Key Refactoring Strategies

1. **Migrate from raw `pg` to Drizzle ORM** — Type-safe queries, migrations, schema validation
2. **Unify auth** — Remove Supabase client-side auth, use NextAuth only
3. **Unify RBAC** — Merge `rbac.ts` and `auth/rbac.ts` into single role system
4. **Adopt tRPC or standardize on apiHandler** — Every API route through same pattern
5. **Remove dead dependencies** — `next-intl`, `zustand` (if unused), `better-sqlite3`
6. **Standardize i18n** — Either use next-intl properly or remove it

---

## 7. PERSONA 6: BACKEND SYSTEMS ARCHITECT

### 7.1 Current API Architecture

```
Client → Next.js Middleware (auth + rate limit + CSP)
       → API Routes (173 individual route.ts files)
          → apiHandler wrapper (some routes) or manual auth (others)
          → db.queryBuilder (raw SQL via pg Pool)
          → PostgreSQL + PostGIS
```

### 7.2 API Endpoint Categories

| Category | Count | Auth Level | Notes |
|---|---|---|---|
| Auth | 7 | Mixed | Register, login, password reset |
| Admin | 10 | super_admin/admin/org_admin | Users, licenses, audit, payments |
| AI | 3 | Mixed | Chat, cadastra validate, data clean |
| Compute | 10 | Auth | Traverse, leveling, TIN, raster |
| Engineering | 13 | Auth | Road, curves, earthworks, volumes |
| Projects | 8 | Auth | CRUD + export |
| Scheme/Subdivision | 18 | Auth | Complex parcel workflow |
| Submission | 7 | Auth | Document assembly |
| Field | 7 | Mixed | GPS, NTRIP, tiles |
| Payments | 5 | Mixed | Stripe, PayPal, M-Pesa |
| Equipment | 4 | Auth | CRUD, calibration |
| Infrastructure | 10+ | Mixed | Health, search, storage, webhooks |

### 7.3 Database Schema Summary

- **30+ tables** with UUID primary keys
- **PostGIS geometry columns** on spatial tables
- **GIST spatial indexes** for fast geographic queries
- **Row Level Security** (RLS) via `AsyncLocalStorage` per-request context
- **13 migrations**, idempotent, versioned
- **No ORM** — all queries parameterized via custom QueryBuilder

### 7.4 Caching Strategy (Current)

| Layer | Implementation | Status |
|---|---|---|
| API response cache | React Query (installed, NOT used) | WASTED |
| Redis cache | Upstash Redis (rate limiting only) | UNDERUTILIZED |
| Browser cache | Next.js `revalidate` (not configured) | NOT CONFIGURED |
| Static cache | Caddy gzip/zstd + 1h TTL | PARTIAL |

### 7.5 Recommended Backend Improvements

1. **Add pg-bouncer** for connection pooling (max 20 → max 100+)
2. **Actually use React Query** for all data fetching
3. **Add Redis caching** for expensive compute operations (traverse, leveling)
4. **Implement query result caching** for dashboard/stats endpoints
5. **Add database read replicas** for heavy query endpoints
6. **Standardize all API routes** through `apiHandler` wrapper
7. **Add OpenAPI/Swagger** for API documentation

---

## 8. PERSONA 7: SENIOR FRONTEND ENGINEER

### 8.1 Component Architecture Issues

| Issue | Location | Fix |
|---|---|---|
| 617-line NavBar | `components/NavBar.tsx` | Extract: SearchModal, UserDropdown, LanguageSelector |
| 1000+ line MapClient | `app/map/MapClient.tsx` | Extract: DrawInteraction, MeasureInteraction, BasemapSwitcher, ImportExport |
| 292-line FeedbackWidget | `components/FeedbackWidget.tsx` | Extract: FeedbackForm, ChangelogPanel, ScreenshotCapture |
| 215-line QuickCompute | `components/layout/QuickCompute.tsx` | Extract: ToolCategory, ToolList |
| 805-line landing page | `app/page.tsx` | Extract: Hero, Features, Pricing, Footer into sections |

### 8.2 Missing Loading/Empty/Edge States

| Page | Missing State | Impact |
|---|---|---|
| Dashboard | No skeleton loading, no empty projects state | Jarring flash of content |
| Projects list | No loading skeleton | Same |
| All 47 tool pages | No error boundaries | One crash kills entire page |
| Map | Has `MapErrorBoundary` (good) | - |
| Field map | No GPS permission denied state | No feedback to user |

### 8.3 Accessibility Gaps

| Issue | Components Affected | WCAG Level |
|---|---|---|
| No ARIA labels on inputs | 47+ tool pages | A (basic) |
| No focus trap in modals | KeyboardShortcuts, QuickCompute panel | A |
| No `aria-modal` on dialogs | Search modal, feedback panel | A |
| No live regions for map results | MeasurementTool, GNSS display | AA |
| Missing keyboard navigation | Most tool forms | A |
| Color contrast borderline | Gray text (#737373) on dark (#0a0a0a) | AA (4.6:1) |

### 8.4 Responsive Design Issues

| Issue | Location |
|---|---|
| QuickCompute + Feedback FAB overlap on mobile | Bottom-right congestion |
| Map `h-[calc(100vh-4rem)]` conflicts with MobileNav | Content hidden behind nav |
| Tool pages not mobile-optimized | Dense forms on small screens |
| Admin sidebar mobile hamburger works | OK (admin/layout.tsx has mobile header) |

---

## 9. PERSONA 8: AI TECHNICAL LEAD

### 9.1 Technical Decisions & Tradeoffs

| Decision | Tradeoff | Recommendation |
|---|---|---|
| No ORM vs Drizzle | Speed of development vs type safety | **Migrate to Drizzle** — critical for scaling |
| NextAuth vs Supabase Auth | Standard vs feature-rich | **Keep NextAuth, remove Supabase auth** — simplify |
| Raw SQL vs QueryBuilder | Flexibility vs safety | **QueryBuilder is good but add Drizzle for types** |
| Custom i18n vs next-intl | Control vs standard | **Either fully adopt next-intl or remove it** |
| Zustand vs React Context | Performance vs simplicity | **Add zustand to package.json or remove stores** |
| Monolith vs Microservices | Speed vs scalability | **Stay monolith, add module boundaries** |
| shadcn/ui vs custom components | Standard vs unique | **Keep shadcn, standardize custom components** |

### 9.2 Recommended Implementation Plan (Priority Order)

**Phase 1: Critical Fixes (Week 1)**
1. Fix FAB overlap (QuickCompute + Feedback)
2. Complete field/map/page.tsx Kenya rewrite
3. Verify admin pages work with AppShell
4. Add `zustand` to package.json (or remove stores)
5. Enable TypeScript build errors (remove `ignoreBuildErrors`)

**Phase 2: Security Hardening (Week 2)**
6. Rotate all secrets, remove .env from git history
7. Add auth to `/api/nlims/lookup` and `/api/storage` GET
8. Fix CSP conflict (remove `unsafe-inline` from next.config.js)
9. Migrate brute-force lockout to Redis
10. Unify RBAC systems

**Phase 3: Architecture Cleanup (Week 3-4)**
11. Standardize all API routes through apiHandler
12. Migrate to Drizzle ORM
13. Remove dead dependencies (next-intl if unused, better-sqlite3)
14. Adopt React Query for data fetching
15. Split monolithic components

**Phase 4: Quality & Scale (Week 5-6)**
16. Complete i18n translations (at minimum: Swahili)
17. Add form validation to all tool pages
18. Implement loading/error/empty states
19. Add accessibility (ARIA, focus management)
20. Set up CI/CD with automated testing

---

## 10. PERSONA 9: UI/COMPONENT ARCHITECT

### 10.1 Component Reusability Score

| Component | Reusable? | Issues |
|---|---|---|
| shadcn/ui primitives | YES | Well-structured, standard |
| NavBar | NO | Self-contained, hardcoded routes, dual auth |
| MobileNav | NO | Self-contained, hardcoded tabs |
| QuickCompute | PARTIAL | Hardcoded tool list, no i18n |
| FeedbackWidget | PARTIAL | Self-contained, hardcoded labels |
| MapViewer | YES | Good forwardRef pattern |
| MotionComponents | YES | Reusable framer-motion wrappers |

### 10.2 Props/API Design Issues

| Component | Issue | Fix |
|---|---|---|
| NavBar | No props at all (self-contained) | Accept `navigation`, `user`, `onAction` props |
| MobileNav | No props (self-contained) | Accept `tabs`, `activeTab`, `onNavigate` props |
| QuickCompute | No props | Accept `tools`, `onSelect` props, make configurable |
| FeedbackWidget | No props | Accept `position`, `showScreenshot` props |

### 10.3 Best Practices to Implement

1. **Compound components pattern** for complex UI (Map, Workspace, Forms)
2. **Render props** for tool pages (shared layout with injectable computation)
3. **Error boundaries** per feature section (not just one at root)
4. **Skeleton components** for every data-loading state
5. **Storybook** for component development and documentation

---

## 11. PERSONA 10: PRODUCTION SECURITY ENGINEER

### 11.1 Vulnerability Report

#### CRITICAL

| ID | Vulnerability | Location | Attack Scenario |
|---|---|---|---|
| C1 | `.env` committed to git with DB credentials | `.env` at commit `4036359` | Full DB access if repo exposed |
| C2 | Build-time dummy AUTH_SECRET | `src/lib/auth.ts:164` | Forged JWTs if deployed without runtime override |
| C3 | NLIMS lookup endpoint has NO authentication | `/api/nlims/lookup/route.ts` | Anyone can query parcel data |

#### HIGH

| ID | Vulnerability | Location | Attack Scenario |
|---|---|---|---|
| H1 | Storage GET endpoint unauthenticated | `/api/storage/route.ts:64` | File access if path is known |
| H2 | No CSRF protection for originless requests | `middleware.ts:95` | curl/fetch bypasses CSRF check |
| H3 | CSP conflict — `unsafe-inline` in next.config.js | `next.config.js:198` | Weakens nonce-based CSP |
| H4 | Dual auth (NextAuth + Supabase) | NavBar, MobileNav | Potential auth bypass |

#### MEDIUM

| ID | Vulnerability | Location |
|---|---|---|
| M1 | In-memory brute-force resets on cold start | `lib/security/loginLimiter.ts` |
| M2 | `ADMIN_EMAILS` grants silent super_admin | `lib/auth.ts:82-84` |
| M3 | Inconsistent password min (6 vs 8 chars) | `apiSchemas.ts` vs `auth/register` |
| M4 | 30-day JWT no refresh rotation | `lib/auth.ts:156` |
| M5 | PayPal sandbox skips webhook signature | `webhooks/paypal/route.ts:99` |
| M6 | Community stats endpoint public | `/api/community/stats` |
| M7 | Peer review endpoint public | `/api/peer-review` |

### 11.2 Security Fix Priority

1. **IMMEDIATE**: Rotate ALL secrets, BFG repo cleaner for git history
2. **IMMEDIATE**: Add auth to nlims/lookup and storage GET
3. **THIS WEEK**: Fix CSP conflict, remove unsafe-inline
4. **THIS WEEK**: Remove build-time dummy AUTH_SECRET (fail hard)
5. **NEXT WEEK**: Migrate login limiter to Redis, add refresh tokens
6. **NEXT WEEK**: Unify RBAC, remove Supabase auth client-side

### 11.3 Security Strengths

- Parameterized SQL queries throughout (no SQL injection)
- CSP headers with nonce-based script-src (in middleware)
- Origin-based CSRF protection
- Rate limiting via Upstash Redis (with in-memory fallback)
- Zod validation on auth/admin endpoints
- RBAC with permission system
- Brute-force login protection (in-memory)
- bcryptjs password hashing
- PostGIS for spatial data

---

## 12. PERSONA 11: SENIOR DEVOPS & DEPLOYMENT ENGINEER

### 12.1 Current Infrastructure

```
the deploy VM (address managed via environment)
├── Docker container (Next.js standalone)
│   ├── Node 20 Alpine
│   ├── Canvas dependencies (native)
│   ├── Auto-migration on startup
│   └── Health check every 30s
├── PostgreSQL (co-located)
├── Caddy reverse proxy
│   ├── Auto-HTTPS (Let's Encrypt)
│   ├── Security headers
│   ├── NTRIP proxy routing
│   └── gzip/zstd compression
├── NTRIP proxy (Node.js, separate process)
└── Python worker (FastAPI, separate Dockerfile)
```

### 12.2 Docker Build Details

- **Dockerfile**: Multi-stage (deps → builder → runner)
- **Base**: `node:20-alpine` with canvas build deps
- **Output**: Next.js standalone mode
- **User**: Non-root `nextjs:nodejs`
- **Entry**: `docker-entrypoint.sh` → migrations → `node server.js`
- **Health**: `wget --spider http://localhost:3000/api/public/health`

### 12.3 Deployment Issues

| Issue | Status | Fix |
|---|---|---|
| Old Docker image deployed (previous session) | REPORTED | Delete old images, `--no-cache` rebuild |
| No CI/CD pipeline | NOT STARTED | GitHub Actions → build → push → deploy |
| No staging environment | NOT STARTED | Separate branch/instance for testing |
| No automated rollback | NOT STARTED | Keep previous image tag, instant rollback |
| No monitoring dashboard | Sentry only | Add Prometheus + Grafana |
| No log aggregation | Docker logs only | Add Loki or CloudWatch |

### 12.4 Production Deployment Checklist

- [ ] Delete old Docker images on VM: `docker images | grep metardu && docker rmi`
- [ ] Build with `--no-cache`: `docker build --no-cache -t metardu:latest .`
- [ ] Verify health check: `curl http://localhost:3000/api/public/health`
- [ ] Verify HTTPS: `curl -I https://metardu.space`
- [ ] Verify CSP headers present
- [ ] Verify admin routes work: `/admin`, `/admin/users`, `/admin/payments`
- [ ] Verify field map loads: `/field/map`
- [ ] Verify FAB buttons don't overlap
- [ ] Check Sentry is receiving errors
- [ ] Check Docker container restart policy: `unless-stopped`

---

## 13. ACTIVE TASK TRACKER

### Completed (All Sessions Combined)

- [x] Deep codebase audit (architecture, security, frontend)
- [x] Created AppShell.tsx (route-aware shell component) — commit `a85aad4`
- [x] Updated root layout.tsx to use AppShell — commit `a85aad4`
- [x] Created admin/layout.tsx (sidebar with mobile support) — commit `a85aad4`
- [x] Created admin/payments/page.tsx — commit `a85aad4`
- [x] Completed messages/en.json i18n keys (130+) — commit `ecdcd16`
- [x] Fixed QuickCompute & Feedback FAB overlap — `bottom-32`/`bottom-16` (uncommitted)
- [x] Field map Kenya UI rewrite ALREADY committed (zero-obstruction layout)
- [x] DOMPurify integration — commit `614e196`
- [x] TS errors resolved — commit `614e196`
- [x] Dependency upgrades — commit `614e196`

### In Progress / Pending (Uncommitted)

- [ ] **Commit QuickCompute FAB positioning fix** — `bottom-32 right-4 md:bottom-16 md:right-6 z-[41]`

### Still Pending

- [ ] **Fix Docker deployment** — Delete old images, rebuild with --no-cache
- [ ] **9 tools 404** — Add "Coming Soon" labels
- [ ] **Field Book nav 404** — Remove or build page
- [ ] **Delete ecosystem.config.cjs** — Contains hardcoded credentials
- [ ] **SurveyorProfile cleanup** — Remove duplicate logic
- [ ] **Login limiter Redis migration** — Move from in-memory to Upstash

### Future Priorities

- [ ] Migrate from raw pg to Drizzle ORM
- [ ] Remove Supabase client-side auth (unify on NextAuth)
- [ ] Adopt React Query for data fetching
- [ ] Split MapClient.tsx into modules
- [ ] Add form validation to 47+ tool pages
- [ ] Complete i18n (Swahili minimum for Kenya market)
- [ ] Enable TypeScript build errors
- [ ] Set up CI/CD pipeline
- [ ] Security fixes (C1-C3 criticals)

---

## 14. CRITICAL BUG LOG

| ID | Bug | Severity | Status | File(s) |
|---|---|---|---|---|
| BUG-001 | QuickCompute & Feedback FAB overlap | HIGH | FIXED | `QuickCompute.tsx:128` |
| BUG-002 | Admin pages 404 | HIGH | FIXED | `AppShell.tsx`, `admin/layout.tsx` (commit a85aad4) |
| BUG-003 | Field map Kenya UI rewrite lost | HIGH | NOT LOST | Already committed in prior session |
| BUG-004 | i18n only 16 keys | MEDIUM | FIXED | `messages/en.json` (commit ecdcd16, 130+ keys) |
| BUG-005 | Zustand not in package.json | CRITICAL | OPEN | `package.json`, `stores/*.ts` |
| BUG-006 | Dashboard N+1 queries | MEDIUM | OPEN | `dashboard/page.tsx:53-69` |
| BUG-007 | Dual auth (NextAuth + Supabase) | HIGH | OPEN | `NavBar.tsx`, `MobileNav.tsx` |
| BUG-008 | .env committed to git | CRITICAL | OPEN | `.env` (commit 4036359) |
| BUG-009 | Build-time dummy AUTH_SECRET | CRITICAL | OPEN | `auth.ts:164` |
| BUG-010 | NLIMS lookup no auth | HIGH | OPEN | `api/nlims/lookup/route.ts` |
| BUG-011 | 9 tools pages return 404 | MEDIUM | OPEN | `app/tools/*/page.tsx` |
| BUG-012 | TypeScript errors ignored | MEDIUM | FIXED | `next.config.js` (commit 614e196) |
| BUG-013 | React Query installed but unused | LOW | OPEN | `package.json` |
| BUG-014 | next-intl installed but unused | LOW | OPEN | `package.json` |
| BUG-015 | CSP unsafe-inline conflict | MEDIUM | OPEN | `next.config.js:198` |
| BUG-016 | DOMPurify not wired | MEDIUM | FIXED | (commit 614e196) |

---

## QUICK RESUME INSTRUCTIONS

When AI context resets, send this file with the instruction:

> "Read this reference file and continue from where we left off. Start with the Active Task Tracker section — check off completed items and begin the next pending task."

The file is located at: `/home/z/my-project/download/METARDU_ENGINEERING_REFERENCE.md`

---

*Last updated: 2025-05-30 (Session 3)*
*Generated by z.ai Full Startup Engineering Team*
