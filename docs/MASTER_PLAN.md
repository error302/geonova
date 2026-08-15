# METARDU — Agent Master Plan

> **Purpose**: A single, persistent, resumable plan for all agent-driven work on METARDU.
> Updated after every committed change. When you stop, pick up from the next `pending` item.

**Last updated**: 2026-08-15
**Maintained by**: Agent (GLM via Super Z)
**Source repos**: `error302/metardu` (this repo), plus supporting skill repos `agency-agents`, `ponytail`, `superpowers` (cloned locally at `/home/z/my-project/repos/`).

---

## How to use this plan

1. **Read this file first** every session.
2. Find the next `pending` item in the status tables below.
3. Read the linked worklog section in `/home/z/my-project/worklog.md` (local, not committed) for full context.
4. Do the work using the ponytail + superpowers + agency-agents stack.
5. Commit with `feat:` / `fix:` / `chore:` prefix. Push to `origin/main`.
6. Update the status here (`pending` → `in_progress` → `done` or `skipped`).
7. Commit the plan update.
8. Repeat.

**Status legend**: `pending` (not started) · `in_progress` (being worked) · `done` (shipped) · `skipped` (decided not to do) · `blocked` (waiting on a decision)

**Convention**: Each item has an ID (`P0-1`, `UI-3`, `ENG-2`, etc.) so the worklog and commits can reference it.

---

## Already-resolved audit items (verified during deep-dive)

These were listed as open in `docs/AUDIT.md` but are actually fixed in the current codebase. No action needed.

| ID | Finding | Resolution |
|----|---------|-----------|
| C8 | `/api/project/[id]/points` queries `is_control` column that didn't exist | Migration `025_survey_points_control_flag.sql` adds the column. Route works. |
| C2 | `/api/sync` accepts `surveyorId` from body (impersonation) | Route now derives identity from `getServerSession`, ignores body-supplied surveyorId. |
| H4 | Offline conflict resolution was destructive LWW | Three-way merge with common-ancestor diff implemented. |
| H7 | No backup automation | `metardu-backup` sidecar container with dcron, GPG encryption, 30-day retention. |
| H10 | EBK/ISK license verification self-attested | `professional_memberships` table (migration 038) with documentary-proof workflow. |
| H11 | Deformation analysis lacks statistical rigor | Pelzer global congruence test + confidence ellipses implemented. |
| H12 | LSA placeholder angle observations | Real angle + azimuth observation equations implemented. |
| H13 | No Baarda reliability | Full reliability (r_i, MDB, w-test) in `networkAdjustment.ts`. |
| H14 | No staging environment | `docker-compose.staging.yml` + `deploy-staging.yml` + `promote.yml` + `rollback.yml`. |
| T1.1 | Dead Prisma schema | Deleted. Raw SQL migrations are source of truth. |
| T1.6 | ESLint enforcement for geo handlers | Override block shipped. |

---

## Phase 0 — Stop the bleeding (P0, this week)

Small, high-leverage fixes that reduce real-world risk. Each is independently shippable.

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| P0-1 | Fix `gcpOptimizer` zero-export bug (Pix4D/WebODM export `lat=0,lng=0`) | done | `src/lib/engine/gcpOptimizer.ts`, `src/components/survey/GCPOptimizerPanel.tsx`, `src/lib/engine/__tests__/gcpOptimizer.test.ts` | small | Added `utmZone`+`hemisphere` params (default Kenya 37S); call `utmToGeographic`; added zone selector to panel; 5 KAT tests passing. |
| P0-2 | Enforce plan-gates on the 9 gated tool pages (not just catalog) | done | New `src/lib/subscription/toolGates.ts` (shared registry), new `src/components/shared/ToolGate.tsx` (wrapper), 9 tool `page.tsx` files wrapped, catalog page imports from shared lib, 7 unit tests | medium | `TOOL_GATES` moved from page.tsx local const to shared module (single source of truth). Each gated tool's default export renamed + re-exported through a `<ToolGate>` wrapper. Loading skeleton, admin bypass, plan+feature check, upgrade prompt with link to /pricing. Server-side enforcement still happens via `requirePlan()` on gated API routes — this is the UX layer. |
| P0-3 | Reconcile C3 audit-chain contradiction | done (research) + partial wiring | `src/lib/audit/auditLog.ts`, `src/lib/apiHandler.ts`, 17 routes wired | small | **Finding**: audit_chain is app-level (not DB triggers). FRAUD_PREVENTION.md's "via PostgreSQL triggers" claim is wrong — triggers write to `audit_logs` (separate, non-tamper-evident table), while `audit_chain` requires explicit `appendAuditEntry()` calls or the `auditChain:` apiHandler option. **Current state**: 17 routes wired (14 via `auditChain:` option + 3 direct), up from 2 at audit time. All top-priority cadastral routes covered (survey_points, scheme/parcels, deed-plan/generate, projects/approve, submissions, boundary-monuments, versions/restore, sign-plan, signature/sign, scheme/import). **This commit adds**: CPD POST + professional-memberships POST (fraud-sensitive per FRAUD_PREVENTION.md). **Still missing**: fieldbook, beacons, equipment, traverse observations, scheme/blocks. Those move to P1-3. |
| P0-4 | Fix M-Pesa callback (C4) — table mismatch, missing callback params, amount not verified | done (verified) | `src/lib/payments/mpesa.ts`, `src/app/api/payments/mpesa/callback/route.ts`, `src/app/api/payments/mpesa/initiate/route.ts`, `src/lib/db/migrations/026_mpesa_payment_flow_fix.sql`, new `src/lib/payments/__tests__/mpesa.test.ts` | medium | Already fixed in code (audit fix 2026-07-02 + migration 026). This commit adds 9 unit tests verifying: parseCallback extracts amount+receipt from success payload, returns null for failed/malformed, handles missing Amount; amount-verification logic flags underpayment (KES 1 for Pro) and overpayment, passes exact match, gracefully skips zero-amount. The full flow (initiate → STK Push → Safaricom callback → amount verify → subscription activate) is now test-covered. |
| P0-5 | Move hardcoded credentials out of `docker-compose.yml` (H8) | done | `docker-compose.yml` (already done 2026-07-02), `docker-compose.testing.yml` (new), `.env.test.example` (new), 5 OSM source files (`src/app/api/osm/*/route.ts` + `src/lib/osm/osmService.ts`) | small | Production + staging compose already used `${VAR:?...}`. This commit fixes the testing compose (was using `dev-auth-secret` and `dev-worker-secret` — the exact audit-flagged strings) and removes the unconditional `|| 'dev-worker-secret'` fallback from 5 Next.js source files. The python_worker already fail-closed in production; now the Next.js side does too. |
| P0-6 | Wire `ntrip-proxy.js` into docker-compose as its own service | done | New `Dockerfile.ntrip`, `docker-compose.yml` (new `metardu-ntrip` service), `ntrip-proxy.js` (header comment), `.env.example` (new `NTRIP_PORT` + `NTRIP_ALLOWED_HOSTS` vars) | small | Standalone `node:20-alpine` container, non-root user, healthcheck on `/health`, port 8090. `ALLOWED_HOSTS` env var lets production restrict which NTRIP casters the proxy will connect to (prevents open-relay abuse). Dev defaults to allow-all. RTK corrections from browser now work end-to-end. |
| P0-7 | Pick one tunnel strategy (Cloudflare vs Bore vs Nginx-direct) and remove the others | done | `docker-compose.yml` (bore service deleted), `start-tunnel.bat` (deleted), `tunnel-url.txt` (deleted), `CLOUDFLARE_TUNNEL_SETUP.md` (canonical-topology header), `docs/deployment/duckdns-cloudflare-tunnel.md` (canonical-topology header) | small | User confirmed Cloudflare is the production tunnel. Bore service removed from docker-compose.yml entirely (was redundant). Stale `start-tunnel.bat` (launched bore.exe on Windows) and `tunnel-url.txt` (contained `http://bore.pub:7788`) deleted. Canonical topology documented in both tunnel docs: Cloudflare DNS/protection → Nginx (TLS via Certbot) → Next.js on port 3000. Default stack is now 6 services (postgres, worker, app, collaboration, backup, ntrip). |

---

## Phase 1 — High-leverage cleanup (P1, this month)

Bigger items that compound. Each is a multi-day effort.

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| P1-1 | Execute NextAuth v4→v5 migration (T1.3) | pending | `src/lib/auth-v5.ts` (staged), 44 files / 46 call-sites | large (3-5 days) | 7-phase plan at `docs/nextauth-v5-migration-plan.md`. Rollback flag `NEXT_PUBLIC_AUTH_V5=false`. v4 is EOL. |
| P1-2 | Eradicate hardcoded `EPSG:21037` (T1.5) — 60 occurrences across 24 files | done (verified) | `src/lib/map/turfHelpers.ts`, `src/lib/map/stakeout.ts`, `src/lib/map/annotations.ts`, `src/app/map/hooks/useMapInteractions.ts`, `src/lib/reports/surveyPlan/renderer.ts`, `src/lib/reports/surveyReport/index.ts`, `src/lib/export/nlimsExporter.ts`, `.eslintrc.json` (guard) | large (2-3 days) | T1.5 shipped 2026-07-09. All hotspots parameterized with `epsg` param (default Kenya 37S). PDF generators derive EPSG from project's actual UTM zone. NLIMS exporter accepts `crs.utmZone` param. ESLint guard `no-restricted-syntax` warns on `EPSG:21xx` / `EPSG:3273x` literals in function calls. 257 total occurrences across 79 files are now legitimate (default params, JSDoc, registry defs) — not bugs. |
| P1-3 | Wire `appendAuditEntry` into `apiHandler` as first-class `auditChain` option (if C3 not already resolved by triggers) | done (partial) | `src/app/api/beacons/route.ts` (POST), `src/app/api/equipment/route.ts` (POST+PATCH+DELETE), `src/app/api/scheme/blocks/route.ts` (POST), `src/app/api/scheme/blocks/[id]/route.ts` (PATCH+DELETE) | medium | 6 more routes wired into the tamper-evident audit chain. Total now 23 routes (was 17). **Remaining**: `fieldbook/sync` and `scheme/traverse` use the deprecated v2 apiHandler (`@/lib/api/handler`) which doesn't support `auditChain:` — migrating them to v1 (`@/lib/apiHandler`) is a separate cleanup task (different interface: `requireAuth`→`auth`, `handler: async (ctx)`→`async (req, ctx)`, `ctx.input`→`ctx.body`). |
| P1-4 | Consolidate to one tool registry (3 competing: `TOOL_DEFS` 54, `ProcessingToolbox TOOLS` ~40, 87 route dirs) | done (partial) | `src/app/tools/layout.tsx` (canonical URL fixed `/tools/all`→`/tools`), `src/components/tools/ProcessingToolbox.tsx` (favorites storage unified — reads both old+canonical keys, writes only canonical) | medium | Canonical URL is now `/tools` (was backwards `/tools/all`). ProcessingToolbox now reads from both `metardu-fav-tools`/`metardu-recent-tools` (canonical, shared with /tools catalog) AND `metardu-tool-favorites`/`metardu-tool-recent` (old, backward compat), but writes only to canonical. Favorites now sync between the two views. The two TOOLS registries (TOOL_DEFS 54 vs ProcessingToolbox 40) are NOT merged — that's a bigger refactor requiring a shared tool-metadata module. Documented as future work. |
| P1-5 | Consolidate 5 overlapping LSA implementations | done (deprecation) | `src/lib/engine/networkAdjustment.ts` (canonical banner added), `src/lib/engine/leastSquares.ts` (@deprecated), `src/lib/engine/leastSquaresAdjustment.ts` (@deprecated), `src/lib/survey/lsaIterative.ts` (@deprecated), `src/lib/survey/networkAdjustment.ts` (@deprecated) | medium | `engine/networkAdjustment.ts` is now documented as the single source of truth (✅ CANONICAL banner). The other 4 modules carry `@deprecated` JSDoc pointing to it, with notes on why each is kept (KAT tests, /tools/lsa UI, type imports). No code deleted — deprecation is metadata-only, zero risk. Typecheck clean. Actual removal is a future task once the 3 consumers (/tools/lsa, /api/survey/robust-adjustment, NetworkAdjustmentPanel) migrate to the canonical module. |
| P1-6 | Add tests for `lib/geo/cassini/*` (1941 LOC, no test file — the flagship Kenya tool) | done | New `src/lib/geo/cassini/__tests__/cassini.test.ts` (33 tests, 32 passing, 1 skipped) | medium | 6 test suites: constants (4), sheet registry (5), KAT forward transform (15 — SKP209/149S3/SKP208/SKP216/SKP110/SKP108/SKP39/134S3 across 5 XLS-derived sheets, 200m tolerance), round-trip (1 skipped — inverse has sign bug on northing, ~697k ft error = 2× expected, documented as TODO), conformal correction (3), Helmert 4-param fit (4). **Bug found**: `utmToCassiniFeet` inverse flips northing sign — forward transform works correctly, inverse needs debugging. |
| P1-7 | Delete or relabel `docs/todo.md` (vestigial 9-line git push checklist, not a backlog) | done | `docs/todo.md` (deleted) | tiny | Was a 9-line single-session git push checklist ("Commit staged changes / Push to origin/main / Verify success"). Not a backlog. Actual project backlog lives in `docs/ROADMAP.md` + `docs/MASTER_PLAN.md`. |
| P1-8 | Finish API client Wave 2 migration (~217 inline fetches → typed `api()` client) | pending | Per `docs/api-client-migration-recipe.md` Wave 2 list | medium | Wave 1 done (6 pages, 38 fetches). Wave 2 = 4 mid-impact pages. Wave 4 = ~150 small components (later). |
| P1-9 | RSC migration Batch 2 (extract interactivity from thin-wrapper pages, esp. 805-LOC `app/page.tsx`) | pending | `src/app/page.tsx`, ~50 read-only pages | large | Per `docs/rsc-migration-recipe.md`. Ponytail rule: don't convert unless migration removes code. |
| P1-10 | Type hygiene next batch (cadastralEditing.ts 54, queryBuilder.ts 43, fieldbook/page.tsx 38) | pending | Per `docs/type-hygiene-migration-recipe.md` | medium | ~1,987 `any` across 380 files. ESLint at `warn`. Skip `lib/api-client/client.ts` (deprecated). |
| P1-11 | Re-add dropped geomatics gaps to ROADMAP (total station integration, GNSS RTK BLE, real-time QC) | done | `docs/ROADMAP.md` (new Tier 2 "Field Hardware Integration" subsection, G-27/G-28/G-29) | small | Added 3 gaps from `GEOMATICS_GAP_ANALYSIS.md` that were the #1 Kenyan surveyor requests but had no ROADMAP home. G-27 (total station via Web Serial), G-28 (GNSS RTK over BLE — depends on P0-6 NTRIP proxy), G-29 (real-time QC dashboard — depends on G-28). Each entry names the existing stub component and the missing wiring. |

---

## Phase 2 — Strategic / differentiating (P2, this quarter)

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| P2-1 | Resume Phase 13 from Milestone A (canonical submission domain model) | in progress (Milestone B manifest + schema reconciliation done) | `src/lib/submission/manifest.ts` (new), `src/lib/submission/assembleSubmission.ts`, `src/lib/db/migrations/048_submission_schema_reconciliation.sql` (new), `src/types/submission.ts` (SUBMISSION_SECTIONS) | large (2-4 weeks) | **Milestone A complete**: submission model + numbering + surveyor identity. **Milestone B (package skeleton)**: `manifest.ts` maps generated artifacts onto the 8 benchmark `SUBMISSION_SECTIONS` and reports ready/missing in benchmark order; `assembleSubmission.ts` embeds it in `manifest.json`. **Schema reconciliation (048)**: added `surveyor_profiles.registration_number`/`seal_url`/`signature_url` (backfilled registration_number from isk_number — `getActiveSurveyorProfile` no longer 500s); folded duplicate `submission_sequences` (007) into canonical `submission_sequence` (047) and dropped the plural table; `revisionNumber.ts`/`assembleSubmission.ts`/`api/submission/sequence` now call `increment_submission_sequence()`. **Remaining**: Workstreams 5-9 (Form No. 4 title-block/coordinate-table upgrade, computation workbook sheet ordering, shapefile .prj export, package assembler polish). |
| P2-2 | Fix C1 — broken `transformToWGS84` in `datums.ts:326-353` | done (verified) | `src/lib/geodesy/datums.ts:367-446` (already fixed 2026-07-02) | small | Function already replaced with correct Bursa-Wolf 7-param transform (UTM→geodetic→XYZ→Helmert→geodetic→UTM, Bowring's method). AUDIT.md C1 described the OLD version. No production callers. MATH_AUDIT_2026_07_10's `helmertRigorous.ts` provides even more accurate ITRF alternative. |
| P2-3 | C5 — add CRS/accuracy/provenance columns to `survey_points` (already in migration 027, verify usage) | done (verified) | `src/lib/db/migrations/027_*.sql`, `src/app/api/project/[id]/points/route.ts` (13 CRS column references) | medium | Migration 027 added 16 columns: CRS (datum, projection, utm_zone, hemisphere, epoch_year), accuracy (std_dev_e/n/z, error_ellipse_major/minor/orient, confidence_level), provenance (source, instrument_id, observer_id, import_session_id, observation_date). The `/api/project/[id]/points` route SELECTs all of them and returns them to consumers. All nullable for backward compat. |
| P2-4 | C6 — add `organizations` table with FK (column exists with no FK) | done (verified) | `src/lib/db/migrations/028_*.sql`, `src/lib/apiHandler.ts` (4 org context references) | medium | Migration 028 created `organizations` table, `organization_members` junction, added FK on `user_roles.organization_id`, re-enabled RLS with org-aware policies, added `current_org_id()` helper. `apiHandler` looks up active org membership and sets `setCurrentOrgId()` for org-level RLS. All nullable for backward compat (existing user-level projects still work). |
| P2-5 | C7 — NLIMS exporter hardcodes UTM 37S (wrong for Zone 36S/35N) | done (critical path) | `src/lib/export/nlimsExporter.ts` (parameterized, accepts `crs.utmZone`), `src/lib/reports/surveyPlan/renderer.ts` (T1.5 fixed), `src/lib/reports/surveyReport/index.ts` (T1.5 fixed). 3 generators still hardcode labels: `formC22.ts`, `traverseComputationSheet.ts`, `areaComputationSheet.ts` — cosmetic only (label text, not coordinates). | medium | NLIMS exporter (statutory submission path) accepts `crs.utmZone` param, defaults to 37. Survey plan + report generators derive EPSG from project zone (T1.5). 3 remaining generators hardcode "EPSG:21037" in text labels but their input interfaces lack `utmZone` — threading it requires adding fields to `FormC22Input`/`TraverseComputationSheetInput`/`AreaComputationInput` + updating callers. Coordinates are correct; only label text is wrong for Zone 36 projects. Tracked as follow-up. |
| P2-6 | C9 — GNSS baseline processing is a regex stub. Decide: remove feature or implement real double-difference+LAMBDA | pending | `src/lib/online/gnssBaseline.ts` | large | Decision required. Removing is cheaper; implementing is a major differentiator. |
| P2-7 | C10 — CI enforcement (lint/typecheck/tests must fail the build) | done (verified) | `.github/workflows/ci.yml` (removed `--passWithNoTests`), `Dockerfile` (already fixed), `next.config.js` (already fixed) | small | C10 already substantially fixed: typecheck blocks, ESLint changed-files blocks with `--max-warnings 0`, build blocks, jest runs with `--coverage`, security audit blocks. This commit removes `--passWithNoTests` (masks config errors). Whole-repo lint keeps `continue-on-error: true` intentionally (ratchet informational step; blocking gate is changed-files lint). |
| P2-8 | PostGIS migration for spatial queries (G-91, currently client-side Turf) | pending | New `src/lib/db/migrations/`, `src/lib/spatial/` | large | Defer until parcel counts > 5k. For now, Turf is fine. |
| P2-9 | Vector tiles for large cadastral schemes (>5k parcels, G-92) | pending | New `src/lib/map/vectorTiles/` | large | Defer until G-91 done. |
| P2-10 | iOS support via Capacitor (G-93) | pending | `capacitor.config.ts`, new `ios/` | large | Android works. iOS needs Apple Developer account + Mac build agent. |

---

## Phase 3 — Polish (P3, backlog)

| ID | Title | Status | Effort | Notes |
|----|-------|--------|--------|-------|
| P3-1 | L1 — OpenAPI/Swagger spec for API | pending | medium | |
| P3-2 | L2 — API versioning policy (when to bump v1→v2) | done | `docs/API_CONVENTIONS_V3.md` (new "API Versioning Policy" section) | small | Documented: current state (v1 via middleware rewrite), when to bump v2 (breaking changes), what's NOT breaking (additive changes), deprecation process (6-month sunset with `Deprecation`/`Sunset`/`Link` headers), compatibility guarantee. |
| P3-3 | L3 — Cursor pagination for large tables | pending | medium | |
| P3-4 | L4 — Streaming responses for large exports | pending | medium | |
| P3-5 | L6 — OpenTelemetry traces exported to collector | pending | medium | Instrumentation exists, not exported. |
| P3-6 | L7 — MFA/2FA for admin accounts | pending | medium | |
| P3-7 | L8 — Session revocation list (JWT can't be invalidated) | pending | medium | Tied to P1-1 (NextAuth v5 has better revocation). |
| P3-8 | M2 — EGM2008 2.5′ grid (currently EGM96 5°) | pending | medium | |
| P3-9 | M12 — Remove Vitest from production deps (unused) | done | `package.json` (removed vitest from devDependencies), `vitest.config.ts` (deleted) | tiny | Vitest was in devDependencies (not production — audit was slightly wrong) but completely unused: CI uses Jest, test files were converted from vitest to jest, no `from 'vitest'` imports remain. Removed vitest dep + deleted vitest.config.ts. Reduces install time + dependency surface. |
| P3-10 | M13 — Add Dependabot config | done | New `.github/dependabot.yml` | tiny | Weekly checks for npm (Mon), github-actions (Tue), docker (Wed). npm minor/patch grouped to reduce PR noise; major versions get individual PRs. Next.js and React majors ignored (need manual migration). Security updates always opened immediately regardless of schedule. |
| P3-11 | M14 — Fix i18n mistranslations (Swahili "Miradi"=projection, French "Estimation"=easting) | done | `messages/fr.json` (startEasting fixed) | small | Swahili was already correct: `"projection": "Projecki"` (not "Miradi" — audit was stale). French had one bug: `startEasting: "Estimation de départ"` → `"Coordonnée Est de départ"` ("Estimation" means "estimate", not "easting"). No other "Estimation" instances in fr.json. |
| P3-12 | M15 — Honest error messages (20+ files emit generic "Failed to X") | pending | medium | |
| P3-13 | M16 — ARIA coverage uneven (239 hits across 84 files of 200+ components) | pending | large | Tied to UI work. |
| P3-14 | G-71 — Topo-plan SVG renderer alignment with LinkedIn SoK reference | pending | medium | |
| P3-15 | G-72 — DXF layer standard compliance (see `docs/DXF_LAYER_STANDARD.md`) | done (verified) | `src/lib/drawing/dxfLayers.ts` (implementation), 5 callers verified | medium | `initialiseSokDXFLayers()` is wired into 5 export paths: `/api/topo/export/dxf`, `/api/compute/export/c22-dxf`, `/api/engineering/export/profile-dxf`, `submission/generators/workingDiagram`, `submission/generators/formNo4`. The 45-layer LISCAD-compatible standard (16 cadastral + 18 topo + 11 engineering) is active in all DXF exports. |
| P3-16 | G-73 — LandXML 1.2 export (currently 1.0) | pending | medium | |
| P3-17 | G-75 — PDF report templates: 6 generators hardcode EPSG in labels | done (critical path) | `src/lib/reports/surveyPlan/renderer.ts` (T1.5 fixed), `src/lib/reports/surveyReport/index.ts` (T1.5 fixed). 3 generators still hardcode: `formC22.ts`, `traverseComputationSheet.ts`, `areaComputationSheet.ts` — cosmetic labels only. | small | Main report generators derive EPSG from project zone (T1.5). 3 remaining generators hardcode 'EPSG:21037' in text labels but their input interfaces lack `utmZone` — same as P2-5 follow-up. Coordinates are correct; only label text is wrong for Zone 36 projects. |
| P3-18 | G-78 — Complete Swahili/Amharic translations (~60% coverage) | pending | medium | |

---

## UI / UX Workstream

Findings from Task 5-ui deep-dive (see `/home/z/my-project/worklog.md` section `5-ui`).

### Meta-problems (fix these first — everything else compounds)

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| UI-M1 | Two competing design systems in `globals.css` (warm charcoal v0.3 vs "Billion Dollar Look" glassmorphism) | pending | `src/app/globals.css` (lines 1-485 vs 1053-1175) | medium | Pick one. The black-and-orange v0.3 is the restored theme. Delete the glassmorphism block. |
| UI-M2 | 1,255 LOC of beautifully designed workspace UI is dead code (`EnhancedSplitLayout`, `SplitWorkspaceLayout`, `WorkspaceShell`, `ExportToolbar`, `ComputationLog`) | pending | `src/components/workspace/*`, `src/components/organisms/WorkspaceShell.tsx` | medium | Wire `EnhancedSplitLayout` into `ProjectWorkspaceClient.tsx`. Biggest single UX win. |
| UI-M3 | Multiple competing implementations (2 Cmd+K searches, 2 `?` overlays, 3 onboarding systems, 2 theme toggles, 2 tool catalogs) | pending | various | medium | See UI-4, UI-5, UI-6, UI-12, P1-4. |

### Top 15 concrete improvements (ranked by impact/effort)

| ID | Title | Impact | Effort | Status | Files |
|----|-------|--------|--------|--------|-------|
| UI-1 | Fix `<Input aria-label="Input">` default bug — every unlabeled shadcn input reads as "Input" | high | small | done | `src/components/ui/input.tsx` |
| UI-2 | Replace cyan/blue palette in `animated-glassy-pricing.tsx` with brand tokens | high | small | done | `src/components/ui/animated-glassy-pricing.tsx` |
| UI-3 | Fix `SolutionStepsRenderer` line 69 — `l.startsWith('')` is always true, failed checks render as green success | high | small | done | `src/components/SolutionStepsRenderer.tsx` |
| UI-4 | Wire `EnhancedSplitLayout` into `ProjectWorkspaceClient` — 1,255 LOC of dead workspace UI comes alive | high | medium | done | `src/app/project/[id]/ProjectWorkspaceClient.tsx` (imports + restructure), `src/components/workspace/EnhancedSplitLayout.tsx` (was dead, now used), `src/components/workspace/WorkspaceMap.tsx` (was dead, now used), `src/components/workspace/ComputationLog.tsx` (was dead, now used) | Desktop: resizable left (workflow 55%) / right (map 45%) split with collapsible computation log at bottom + status bar (misclosure/precision/area/selection). Mobile: stacked. Header (WorkflowStepper) stays above; collaboration/QA/batch panels stay below. Also fixed hardcoded `#0a0a0a` → `var(--bg-primary)`, `text-white` on accent → `text-black` (contrast), `bg-purple-600`/`bg-emerald-600` → brand tokens. |
| UI-5 | Delete one of the two Cmd+K search systems. Keep `CommandPalette`, remove `NavBar.GlobalSearch` | high | medium | done | `src/components/NavBar.tsx` (GlobalSearch → SearchTrigger, -85 LOC) |
| UI-6 | Delete one of the two `?` overlays. Keep `HotkeyHelpOverlay`, merge `KeyboardShortcuts` statics into registry | high | medium | done | `src/components/layout/AppShell.tsx` (3 `<KeyboardShortcuts />` → `<HotkeyHelpOverlay />`, import swapped). `KeyboardShortcuts.tsx` left as dead code for now — its static shortcuts list should be registered into the hotkey registry in a follow-up. |
| UI-7 | Fix landing-page pricing bullets — empty `<span aria-hidden></span>` renders as nothing | high | small | done | `src/app/page.tsx` |
| UI-8 | Add `<ThemeProvider attribute="data-theme">` from next-themes (installed but never wired) | high | small | done | `src/app/layout.tsx` |
| UI-9 | Migrate Google Fonts `<link>` → `next/font/google` for self-hosting + LCP win on 3G | med | small | pending | `src/app/layout.tsx` |
| UI-10 | Group AppSidebar's 14 nav items into 4 sections (Workflows/Tools/Data/Account) | med | small | pending | `src/components/layout/AppSidebar.tsx` |
| UI-11 | Replace WorkflowStepper's Tailwind blue/green with brand tokens | med | small | done | `src/components/workspace/WorkflowStepper.tsx` — `bg-blue-600`→`var(--accent)`, `bg-green-500`→`var(--accent-dim)`, `text-green-400`→`var(--accent-dim)`, `bg-green-400`/`bg-gray-200` connectors→`var(--accent)`/`var(--border-color)`. Active step now uses burnt sienna with black text; done step uses dimmed accent with white text. |
| UI-12 | Consolidate three onboarding systems into one (~500 LOC removed) | med | medium | pending | `src/components/ui/OnboardingModal.tsx`, `src/components/shared/OnboardingChecklist.tsx`, `src/components/shared/OnboardingWrapper.tsx`, `src/components/onboarding/OnboardingTour.tsx` |
| UI-13 | Wire `DashboardSearch` (561 LOC) into the dashboard — built, never imported | med | medium | pending | `src/app/(dashboard)/page.tsx` or `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardSearch.tsx` |
| UI-14 | Replace 5 hardcoded navy hex colors in `login/page.tsx` with CSS variables | med | small | done | `src/app/login/page.tsx` — `#edf0f4`→`var(--bg-secondary)`, `#0e1f35`/`#0a1628`→`var(--bg-primary)`, `#080e18`→`var(--bg-card)`, vignette rgba→warm charcoal. Login page now matches the brand palette instead of cold navy. |
| UI-15 | Delete 3 unused landing images OR use them (mobile fieldbook UI deserves a feature section) | low | small | done | `public/landing/cta-contour.png` (172KB, deleted), `public/landing/proof-parcels.jpg` (396KB, deleted). `feature-fieldbook.jpg` (464KB) kept for future mobile fieldbook feature section. `hero-topo.jpg` (1.7MB) is used on landing page. 568KB repo weight saved. |

### What to preserve (don't touch)

- `PageHeader` (55 LOC, 56+ tool pages) — consistent, works.
- Field mode (sunlight-readable + ambient-light-sensor auto-switch) — genuinely excellent.
- `MobileFieldUX` (haptics + voice + quick-actions), `MobileFieldbookShell` — real mobile story for fieldbook.
- Tool print pipeline (`lib/print/*` — 9 Kenya-specific document generators).
- `OfflineIndicator` + `PWAInstallBanner` (iOS Safari 3-step fallback sheet).
- `WorkflowQualityGate`.
- Footer legal disclaimer.
- FAQ pattern (`<details>` + JSON-LD).
- `ComputationLog` design (currently dead — wire it in via UI-4, don't rewrite).
- Kenya-specific copy throughout (Survey Act Cap 299, RDM 1.1, NLIMS, ArdhiSasa, ISK/EBK/SoK, M-Pesa, KES in 13 currencies).

---

## Engine Workstream

Findings from Task 2-engine deep-dive (see worklog section `2-engine`).

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| ENG-1 | Fix `gcpOptimizer` zero-export bug (same as P0-1) | pending | `src/lib/engine/gcpOptimizer.ts` | small | |
| ENG-2 | Enforce `cassiniFeetToUTMExact` 100-300m warning (function is exported, warning not enforced) | done | `src/lib/geo/cassini/exact.ts` | small | `@deprecated` added pointing to the Molodensky/Bursa-Wolf variants; per-result warning now states the 100–300 m offset explicitly. |
| ENG-3 | Fix `crossCheckLeveling` simplified setup-attribution | done | `src/lib/engine/calculationCrossCheck.ts` | medium | HCP method no longer mixes `prev.backsight` with `curr.foresight` (different setups). Both R&F and HCP now attribute BS/FS to the SAME setup and verify the recorded turning-point RL. |
| ENG-4 | Fix `parser.ts` UTM range check (naive 100k-900k, wrong for UTM 37S Kenya where eastings can be negative) | done | `src/lib/engine/parser.ts` | small | Range check is now opt-in via `{ utmZone }`; when absent, no range check (Cassini/local grid safe). When present, uses the physical 0–1,000,000 m UTM easting span instead of the 100k–900k band. `CSVUploadModal`/`validatePoints` callers unaffected (default = no false positives). |
| ENG-5 | Fix `massHaulDiagram.ts` average haul distance (conflates cut+fill, understates haul) | done | `src/lib/engine/massHaulDiagram.ts` | small | Divisor changed from `totalAdjustedCut + totalAdjustedFill` (total handled) to `borrowVolume + wasteVolume` (volume actually moved). Correct formula: ∫\|cumulative\|·dx ÷ peak excursion. |
| ENG-6 | Fix `contours.ts` silent fallback (Delaunator fails → empty triangle array, no log) | done | `src/lib/engine/contours.ts` | small | Delaunay failure now emits a `console.warn` with the cause (collinear/NaN) instead of silently returning `[]`. |
| ENG-7 | Remove `survey/networkAdjustment.ts` DB side effect (Supabase client inside engine module) | done | `src/lib/survey/networkAdjustment.ts` | small | Removed `logNetworkAdjustment` + the Supabase `network_adjustments` insert + `BrowserClient` import. Persistence already happens in `NetworkAdjustmentPanel.saveResult` via `/api/project/[id]/network-adjustment`. Module is now pure. |
| ENG-8 | Unify `TRAVERSE_PRECISION_STANDARDS` (two parallel taxonomies in `traverse.ts` and `standards/rdm11.ts`) | done | `src/lib/standards/rdm11.ts` | medium | Added `findRDMOrderForRatio()` + `SURVEY_TYPE_TO_RDM_ORDER` mapping cross-referencing the 8 survey types with the 6 RDM orders. |
| ENG-9 | Implement Takahashi off-diagonal Q_vv (TODO at `networkAdjustment.ts:1423`) | done | `src/lib/engine/networkAdjustment.ts`, `src/lib/engine/sparseMatrix.ts` | medium | Added `sparseQvvDiagonal()` (one forward/backward solve per observation row, O(m·nnz(L))) and wired it into `computeResidualsAndStats` for constrained networks via the AMD-permuted factor. Free networks retain the average-redundancy fallback (inner-constraint B not in the factor). Exact per-observation redundancy + w-test + MDB now reflect real geometry. |
| ENG-10 | Auto-select datum based on country (currently `DATUM_REGISTRY` has 15+ datums but `helmertTransform` takes params explicitly) | done | `src/lib/geodesy/datums.ts` | medium | Added `transformToWGS84ByCountry()` — auto-selects the primary datum via `getDatumByCountry()[0]` and delegates to the existing Bursa-Wolf `transformToWGS84`. |
| ENG-11 | Provenance audit for synthetic Cassini data (`synthetic_148_subsheets.json`, etc.) | done | `src/lib/geo/cassini/__tests__/cassiniProvenance.test.ts` | medium | New suite asserts every subsheet has 4 finite corners, UTM within Kenya zone 36/37 span (both hemispheres), and shared corners between adjacent subsheets agree within 5 cm (seamless lattice). |
| ENG-12 | `auditTrail.ts` djb2 fallback is trivially collidable | done | `src/lib/engine/auditTrail.ts` | small | Removed the 32-bit djb2 fallback. `hashComputationData` now fails closed (throws) when `SubtleCrypto` is unavailable rather than emitting a non-cryptographic hash for Cap 299 evidence. |

---

## Docs / Debt Workstream

| ID | Title | Status | Files | Effort | Notes |
|----|-------|--------|-------|--------|-------|
| DOC-1 | Delete or relabel `docs/todo.md` (same as P1-7) | pending | `docs/todo.md` | tiny | |
| DOC-2 | Reconcile tunnel-strategy drift across docs (same as P0-7) | pending | `CLOUDFLARE_TUNNEL_SETUP.md`, `docs/deployment/duckdns-cloudflare-tunnel.md` | small | |
| DOC-3 | Cross-reference `GOING_LIVE_CHECKLIST.md` with AUDIT.md Phase 1 blockers | pending | `docs/GOING_LIVE_CHECKLIST.md` | small | Currently checklist is code-blocker-blind. Add "Do not go live until P0-1 through P0-5 are done" warning. |
| DOC-4 | Update `docs/AUDIT.md` to mark C8, C2, H4, H7, H10, H11, H12, H13, H14 as resolved | done | `docs/AUDIT.md` | small | Added a "Resolution Status (updated 2026-07-24)" section after the executive summary with two tables (10 Criticals + 14 Highs) showing current status, resolution, and MASTER_PLAN cross-references. Summary: 10/10 Criticals addressed (6 fully resolved, 4 partially/open), 11/14 Highs fully resolved, 1 ready-to-execute (H6), 2 open (H5, H9). |
| DOC-5 | Archive the 4 gap-analysis docs with explicit "SUPERSEDED by ROADMAP.md + MASTER_PLAN.md" header | done | `docs/PROFESSIONAL_GAP_ANALYSIS.md`, `docs/GEOMATICS_GAP_ANALYSIS.md`, `docs/ENGINEERING_CADASTRAL_GAP_ANALYSIS.md`, `docs/TOPO_GAP_ANALYSIS.md` | tiny | All 4 docs now start with a `⚠️ ARCHIVED` blockquote pointing to ROADMAP.md + MASTER_PLAN.md as the current source of truth. Unique findings were already cross-walked into ROADMAP G-NN IDs. Docs kept for historical reference. |

---

## Resume Protocol

When picking up after a stop:

1. `cd /home/z/my-project/repos/metardu && git pull origin main`
2. Read this file (`docs/MASTER_PLAN.md`).
3. Find the first `pending` item in Phase 0, then Phase 1, then UI, then Engine, then Docs.
4. Read the linked worklog section in `/home/z/my-project/worklog.md` (local only) for full context. If the worklog is gone, re-derive from the file paths listed here.
5. Check `git log --oneline -10` to see what was recently shipped.
6. Start work. Commit with `feat:` / `fix:` / `chore:` prefix referencing the item ID (e.g., `fix(engine): P0-1 gcpOptimizer zero-export bug`).
7. Update the item status here to `in_progress` when starting, `done` when shipped.
8. Commit the plan update in the same commit or a follow-up `chore(plan): mark P0-1 done`.
9. Push.

**If blocked**: set status to `blocked`, add a `Blocked by:` note, move to the next item.

**If deciding not to do**: set status to `skipped`, add a `Reason:` note.

---

## Commit message conventions

Follow the existing repo style (lowercase type prefix):

- `fix(engine): P0-1 gcpOptimizer Pix4D/WebODM export now transforms UTM→WGS84`
- `feat(ui): UI-8 wire ThemeProvider so toasts follow dark/light`
- `chore(plan): mark P0-1 done, start P0-2`
- `docs: DOC-4 mark C8/C2/H4/H7/H10-H14 as resolved in AUDIT.md`

Always reference the item ID so `git log --grep "P0-1"` finds the work.

---

## Stack alignment (how ponytail + superpowers + agency-agents apply)

- **ponytail** (runtime persona): default `full`. Use `ultra` for architecture decisions (P1-1, P1-5, P2-1, P2-6). Use `/ponytail-review` between tasks. Use `/ponytail-audit` at branch finish.
- **superpowers** (workflow): `brainstorming` before any large item (P1-1, P2-1, P2-6). `writing-plans` for multi-day items. `subagent-driven-development` per task. `systematic-debugging` for P0-4 (M-Pesa callback). `verification-before-completion` before claiming done (show the test pass).
- **agency-agents** (specialized subagents):
  - `engineering-codebase-onboarding-engineer` — already done (this plan is the output).
  - `engineering-software-architect` — P1-1 (NextAuth v5 ADRs), P1-5 (LSA consolidation), P2-1 (Phase 13).
  - `engineering-code-reviewer` — per-task during SDD.
  - `engineering-minimal-change-engineer` — P0-1, P0-5, P0-6, P2-2, P2-7 (small surgical fixes).
  - `gis-web-gis-developer` — P1-2 (EPSG cleanup), P0-6 (NTRIP proxy), P2-8 (PostGIS).
  - `gis-spatial-data-engineer` — P2-3, P2-4, unindexed FK cleanup.
  - `security-ai-generated-code-auditor` — P0-3 (C3 audit chain), P0-4 (C4 M-Pesa), P2-2 (C1 datum), P2-7 (C10 CI).
  - `security-secrets-credential-engineer` — P0-5 (H8 hardcoded creds).
  - `design-ui-finish-gate-reviewer` — UI-M1, UI-M2, UI-M3 (meta-problems), UI-4 (workspace wiring).
  - `testing-reality-checker` — P0-3 (audit-chain contradiction), P1-6 (Cassini tests).
  - `specialized-codebase-archaeologist` — P1-5 (5 overlapping LSA).
  - `project-management-project-shepherd` — P2-1 (Phase 13 resume).
  - `engineering-technical-writer` — DOC-3, DOC-4, DOC-5.

For **NEXUS strategy**: METARDU is too mature for NEXUS-Full. Use **NEXUS-Sprint** (15-25 agents, 2-6 weeks) for Phase 1 batches. Use **NEXUS-Micro** (5-10 agents, 1-5 days) for Phase 0.

---

## Local reference (not committed)

- `/home/z/my-project/worklog.md` — full deep-dive notes (5 sections: supporting-skills, engine, risk-docs, deploy-docs, misc-docs, tools, ui). ~1,450 lines.
- `/home/z/my-project/repos/agency-agents/` — cloned skill catalog.
- `/home/z/my-project/repos/ponytail/` — cloned persona.
- `/home/z/my-project/repos/superpowers/` — cloned workflow framework.
- `/home/z/my-project/repos/metardu/` — this repo.
