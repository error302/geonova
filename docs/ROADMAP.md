# METARDU — Consolidated Roadmap

**Last updated:** 2026-07-09
**Status:** Tier 0 (digitizing toolbar fixes) shipped. Tier 1 in progress.
**Supersedes:** `PROFESSIONAL_GAP_ANALYSIS.md`, `GEOMATICS_GAP_ANALYSIS.md`, `ENGINEERING_CADASTRAL_GAP_ANALYSIS.md`, `TOPO_GAP_ANALYSIS.md` — those are now archived reference material; this document is the single source of truth for what's planned.

---

## How to read this roadmap

- **Tier 0** = surgical fixes already shipped (2026-07-09)
- **Tier 1** = critical correctness & data integrity (P0) — do next
- **Tier 2** = professional quality (P1) — next quarter
- **Tier 3** = polish & differentiation (P2) — backlog
- **Tier 4** = future (P3) — not committed

Each gap has an ID (`G-NNN`), source doc(s), and effort estimate. Items marked ✅ are done.

---

## Tier 0 — Shipped 2026-07-09

The digitizing toolbar (Split / Merge / Reshape / Rotate / Offset) had 8 bugs where the UI lied about what it did. All fixed:

| ID | Fix | File(s) |
|----|-----|---------|
| T0.1 | Merge uses real Shift+click selection, not all polygons | `MapClient.tsx` |
| T0.2 | Rotate uses slider angle, not hardcoded 15° | `MapClient.tsx`, `editingTools.ts` |
| T0.3 | Offset fires on Apply button, not slider drag | `MapClient.tsx`, `MapToolDock.tsx` |
| T0.4 | Split/Reshape target the polygon the line crosses | `MapClient.tsx` |
| T0.5 | Digitizing tools use `currentUtmEpsg()`, not hardcoded EPSG:21037 | `MapClient.tsx` |
| T0.6 | Deleted dead `DigitizingToolbar.tsx` (266 lines, zero importers) | deleted |
| T0.7 | All toast messages honestly describe the operation | `MapToolDock.tsx` |
| T0.8 | Split state into `activeDrawTool` + `activeOneShotTool` | `MapClient.tsx` |
| T0.9 | 20 contract regression tests added | `digitizingHandlerContract.test.ts` |
| T0.10 | Hoisted dynamic OL imports out of hot path | `MapClient.tsx` |
| Bonus | Fixed `rotatePolygon` — turf.transformRotate silently failed on concave shapes | `editingTools.ts` |

**Commit:** `75e2489` — `fix(map): Tier 0 digitizing toolbar`

---

## Tier 1 — Critical Correctness & Data Integrity (P0)

### T1.1 — Delete dead Prisma schema ✅
- **Done.** `prisma/schema.prisma` deleted (2026-07-09). Raw SQL in `src/lib/db/migrations/` is the single source of truth.
- **Source:** AUDIT H1, PGA G-104

### T1.2 — CI pipeline ✅ (already existed)
- **Verified.** `.github/workflows/ci.yml` already runs: typecheck, lint (ratchet), build, i18n, jest+coverage, Playwright E2E, mobile build check, security audit. No action needed.
- **Note:** Lint baseline is 1300 warnings — debt to ratchet down over time.

### T1.3 — NextAuth v4 → v5 migration
- **Scope:** `src/lib/auth.ts` (v4) → activate `src/lib/auth-v5.ts`. Update all `getServerSession()` callers. Test OAuth providers (Google, GitHub), magic link, and session cookie shape.
- **Effort:** 3-5 days. See `docs/nextauth-v5-migration-plan.md` for the detailed plan.
- **Risk:** v4 is end-of-life. Session shape changes could break RLS.
- **Status:** Plan exists, not started.

### T1.4 — Consolidated roadmap ✅
- **Done.** This document replaces the 4 competing gap-analysis docs.

### T1.5 — Eradicate hardcoded EPSG:21037 across src/lib
- **Scope:** 60 occurrences across 24 files (per audit). Top hotspots:
  - `src/app/map/hooks/useMapInteractions.ts` — 10 occurrences
  - `src/lib/map/turfHelpers.ts` — 5 (high-risk: consumed by editingTools, topologyChecker)
  - `src/app/map/utils/drawAnnotations.ts` — 4
  - `src/components/map/SurveyMap.tsx`, `src/lib/map/annotations.ts`, `src/lib/map/stakeout.ts` — 3 each
- **Approach:** Thread `currentUtmEpsg` from `MapReactContext` into all map lib functions. Pure lib files (outside React tree) need an `epsg` parameter added to their signatures.
- **Bonus bug:** `surveyPlan/renderer.ts:874` and `surveyReport/index.ts:248` interpolate the project's actual UTM zone into PDF labels but append hardcoded `EPSG:21037` — produces "UTM Zone 36S (EPSG:21037)" for Zone 36 projects.
- **ESLint guard:** Added `no-restricted-syntax` rule banning `EPSG:21xxx` literals in function calls (2026-07-09). New occurrences will warn.
- **Effort:** 2-3 days. Status: ESLint guard shipped; 60 fixes pending.

### T1.6 — ESLint enforcement for geo handlers ✅
- **Done.** Added `overrides` block in `.eslintrc.json` for `src/lib/map/`, `src/lib/survey/`, `src/lib/geodesy/`, `src/lib/geo/`, `src/app/map/`. Rules: `no-explicit-any`, `no-unsafe-*` escalated to `warn` (will escalate to `error` once existing violations are cleaned).

### T1.7 — Map disconnected from scheme data (G-07)
- **Scope:** Digitizing tools now work (Tier 0), but the map can't render parcel boundaries from the DB. The `/api/project/[id]/points` endpoint is broken.
- **Source:** PGA G-15, AUDIT C8
- **Effort:** 2 days

### T1.8 — Optimistic locking on survey data
- **Status:** Partially resolved per AUDIT H4. Verify `updated_at` + `If-Match` header pattern is enforced on all mutation endpoints.
- **Effort:** 1 day to verify + fix gaps

### T1.9 — Audit trail underuse
- **Scope:** `audit_log` table exists but <30% of mutation endpoints write to it. Add audit logging to all parcel/deed/project mutations.
- **Source:** PGA G-09, AUDIT C3
- **Effort:** 2 days

### T1.10 — API consistency (expand-and-contract)
- **Scope:** Several endpoints return inconsistent shapes. Enforce the v3 response envelope (`{ data, error: { code, message, details } }`) on all routes.
- **Source:** PGA G-07, AUDIT H3
- **Effort:** 3 days

---

## Tier 2 — Professional Quality (P1)

### Cadastral / Surveying
- **G-12** Sectional properties act compliance (Kenya Sectional Properties Act 2020)
- **G-13** Deed plan FR (Folio Reference) lookup integration with KIS
- **G-14** Beacon certificate auto-generation from surveyed beacons
- **G-15** Encroachment audit — detect parcel overlaps during digitizing (topology checker exists but not wired to save path)

### Engineering / Computation
- **G-22** Least-squares adjustment (LSA) — engine exists, not wired to traverse UI
- **G-23** Error ellipse visualization on adjusted points
- **G-24** Real-time QC on GNSS observations (NTRIP client exists, no QC display)
- **G-25** Clothoid transition curves — engine exists, no UI
- **G-26** Earthworks (end-area) — engine exists, no BoQ export

### Field Hardware Integration (P1-11, re-added 2026-07-24)
*Source: `docs/GEOMATICS_GAP_ANALYSIS.md` — these were the #1 feature requests
from Kenyan surveyors but had no ROADMAP home. They close the field-to-finish
loop so a surveyor can capture, compute, and submit without leaving the browser.*

- **G-27** Total station integration via Web Serial API / USB OTG — live observations into the field book from a connected total station (Topcon, Leica, Sokkia, Trimble). The `InstrumentConnectionPanel` component exists but only mocks the connection. Web Serial is supported in Chrome/Edge; Android via Capacitor Bluetooth plugin already in deps.
- **G-28** GNSS RTK rover over Bluetooth Low Energy (BLE) — connect to a rover receiver (e.g. Trimble R2, Leica GS18, Emlid Reach RS3) and stream NMEA + RTCM corrections to the `GNSSConnectionPanel`. The `@capacitor-community/bluetooth-le` dep is installed; needs the NMEA parser + RTCM relay wired to the now-deployed `metardu-ntrip` proxy (P0-6).
- **G-29** Real-time QC dashboard during field observation — show satellite count, PDOP, horizontal/vertical accuracy, fix type (float vs fixed), and correction age live in the field UI. The `RealTimeQCPanel` component exists but is a stub. Depends on G-28 for the data feed.

### UX / UI
- **G-41** Honest error messages — 20+ files emit generic "Failed to X". Tier 0 fixed digitizing area only.
- **G-42** Mobile field UI — Capacitor Android app works but iOS unsupported
- **G-43** Offline tile download — works but no progress indicator
- **G-44** Coordinate search — supports lat/lon/UTM/DMS but no MGRS

### Infrastructure
- **G-61** Redis-backed session store (currently in-memory)
- **G-62** BullMQ for background jobs (currently ad-hoc)
- **G-63** OpenTelemetry traces — instrumentation exists, not exported to collector
- **G-64** Multi-region deployment (currently single Nairobi DC)

---

## Tier 3 — Polish & Differentiation (P2)

- **G-71** Topo-plan SVG renderer — align with LinkedIn "State of Kart" reference
- **G-72** DXF layer standard compliance (see `docs/DXF_LAYER_STANDARD.md`)
- **G-73** LandXML 1.2 export (currently 1.0)
- **G-74** IFC 4.3 alignment export
- **G-75** PDF report templates — 6 generators use hardcoded EPSG in labels (see T1.5 bonus bug)
- **G-76** Marketplace: CPD certificate auto-generation
- **G-77** Marketplace: AI plan checker
- **G-78** Multi-language: complete Swahili/Amharic translations (currently ~60% coverage)

---

## Tier 4 — Future (P3)

- **G-91** PostGIS migration for spatial queries (currently client-side Turf)
- **G-92** Vector tiles for large cadastral schemes (>5k parcels)
- **G-93** iOS support via Capacitor
- **G-94** Bureau of Land Management (BLM) compliance for US expansion
- **G-95** Drone photogrammetry pipeline (currently manual)

---

## Out of Scope (Explicitly Declined)

- **Hydrographic surveying** — removed in v0.3 scope narrowing
- **Marine/USV** — removed in v0.3
- **Mining surveying** — removed in v0.3
- **Deformation monitoring** — folded into engineering as a method (not standalone)

---

## Technical Debt Log

| Item | Status | Notes |
|------|--------|-------|
| NextAuth v4 → v5 | T1.3 | Plan exists, 3-5 day effort |
| Prisma schema drift | ✅ T1.1 | Deleted |
| Lint warning baseline (1300) | Active | Ratchet down via CI `--max-warnings 0` on changed files |
| Hardcoded EPSG:21037 (60 occurrences) | T1.5 | ESLint guard added; fixes pending |
| `any` types in geo handlers | T1.6 | ESLint override added as `warn`; escalate to `error` after cleanup |
| Single squashed git commit | Accepted | History only on GitHub; can't reconstruct locally |

---

## Source of Truth Pointers

| What | Where |
|------|-------|
| Live DB schema | `src/lib/db/migrations/*.sql` (44 files, 106 tables) |
| DB connection | `src/lib/db.ts` (raw pg Pool + RLS via AsyncLocalStorage) |
| Migration runner | `scripts/migrate-unified.mjs` |
| Auth (current) | `src/lib/auth.ts` (NextAuth v4) |
| Auth (target) | `src/lib/auth-v5.ts` (not activated) |
| Map state | `src/app/map/MapReactContext.tsx` |
| Digitizing tools | `src/app/map/MapClient.tsx` + `src/lib/map/editingTools.ts` |
| Cassini projection | `src/lib/geo/cassini/` |
| Audit findings (archive) | `docs/AUDIT.md` (513 lines) |
| System design | `docs/SYSTEM_DESIGN_V3.md` |
| Archived gap analyses | `docs/PROFESSIONAL_GAP_ANALYSIS.md`, `docs/GEOMATICS_GAP_ANALYSIS.md`, `docs/ENGINEERING_CADASTRAL_GAP_ANALYSIS.md`, `docs/TOPO_GAP_ANALYSIS.md` |
