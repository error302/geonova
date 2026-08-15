---
title: Project State Assessment
tags: [index, assessment, onboarding, desktop, production-readiness]
---

# Project State Assessment

> One-stop onboarding + honest readiness snapshot for any agent resuming work on METARDU.
> Read this first, then [[METARDU Home]], then `docs/MASTER_PLAN.md`.

## What METARDU is

Surveying software for Kenyan/East-African land surveyors. One workspace for the
field-to-finish flow: field book → compute (traverse/levelling/COGO/volumes) →
deed plans (Form No. 4, Cap. 299) → submission package (NLIMS-ready).

**Stack:** Next.js 14 (App Router) + TypeScript + raw PostgreSQL (RLS) + NextAuth v4 +
OpenLayers + Capacitor (Android) + Python compute worker + PM2/nginx/cloudflared tunnel.
~220 API routes, ~106 DB tables, ~2,270 Jest tests.

## Honest readiness verdict (2026-08-14)

**NOT "perfect" — but genuinely strong in the core and close on the wrong edges.**

| Area | Status |
|------|--------|
| Survey math / engine | 🟢 Strong. Rigorous (Rodrigues epochs, ITRF frames, robust LSA, TLS, covariance). Heavy test coverage. |
| Compute correctness | 🟢 Strong. Bowditch/Transit/LSA, ISO EDM corrections, Kahan summation, cross-checks, tamper-evident audit chain. |
| Web UI breadth | 🟢 Broad (200+ routes, 40+ tools). Prior live audit fixed 12 real bugs; remaining are mostly polish. |
| Payments ($$$) | 🔴 **NOT live.** PayPal in sandbox, M-Pesa unconfigured. See `docs/GOING_LIVE_CHECKLIST.md`. |
| Submission package | 🟠 **Incomplete.** Phase 13 (Form No. 4 benchmark-aligned package) only finished Milestone A. See `docs/PHASE13_SUBMISSION_PACKAGE_HANDOFF.md`. |
| Field hardware | 🔴 Stubbed. Total station (Web Serial), GNSS RTK over BLE, real-time QC = #1 surveyor ask, not wired. |
| Desktop app | 🔴 **Concept only.** A banner (`ComputeLimitNotice`) + notes. No Electron/Tauri binary. |
| Auth | 🟠 NextAuth v4 is EOL; v5 migration (`P1-1`) staged but pending. |
| Observability | 🟢 Sentry + PM2 + OpenTelemetry instrumentation (not exported) + Cloudflare Observability. |

**Bottom line:** the engine is production-grade. The *product* is not yet
customer-ready end-to-end because billing and the actual submission deliverable
(the package a surveyor hands to Ardhi House) are unfinished, and the field-hardware
story that Kenyan surveyors actually want is missing.

## What "production-ready" actually requires (the short list)

1. **Billing** — live PayPal + M-Pesa Daraja creds, webhooks verified (runbook exists in `GOING_LIVE_CHECKLIST.md`).
2. **Submission package** — finish Phase 13 (Workstreams 4–10): canonical workspace route, Form No. 4 title block, computation workbook, package assembler, shapefile export with `.prj`.
3. **Field hardware** — G-27/G-28/G-29: total station over Web Serial, GNSS RTK over BLE (NTRIP proxy `P0-6` is already live), real-time QC.
4. **Auth** — NextAuth v4 → v5 (plan: `docs/nextauth-v5-migration-plan.md`).
5. **Desktop** — see below.

## Can it succeed? (yes, and why)

The positioning is genuinely differentiated and underserved: Kenya/East-Africa
cadastral with **Cap. 299 + NLIMS + ISK/EBK compliance** baked in. Competitors are
desktop CAD packages (Trimble/Leica/Civil 3D) with no Kenya-specific submission layer.
METARDU wins on (a) statutory correctness, (b) field-to-finish in one place, (c) price.

**Success depends on three things, in order:**
1. Field hardware integration (the #1 request — without it you're "compute-only").
2. Submission-grade output that a surveyor will actually stake their license on.
3. M-Pesa billing that works in Kenya (not PayPal-first).

Not "more calculators." The calculator surface is already ~40 tools deep.

---

## The single source of truth for planning

| Doc | Role |
|-----|------|
| `docs/MASTER_PLAN.md` | Agent master plan — the working backlog. **Read this first.** |
| `docs/ROADMAP.md` | Consolidated feature roadmap (Tier 0–4, G-NN IDs). |
| `docs/PHASE13_SUBMISSION_PACKAGE_HANDOFF.md` | The submission-package build plan (most valuable unfinished work). |
| `docs/GOING_LIVE_CHECKLIST.md` | Exactly what's blocking paying customers (billing/SSL/env). |
| `docs/AUDIT.md` | Security/architecture audit with resolution status. |
| `docs/BUGS.md` | Live UI bug log (mostly resolved). |
| `worklog.md` (root) | Chronological task history. |

**Repo map:**
- `src/lib/engine/` — survey compute (traverse, leveling, COGO, area, curves, volumes, contours).
- `src/lib/geodesy/`, `src/lib/geo/` — datums, projections, Cassini-Soldner.
- `src/lib/reports/`, `src/lib/print/` — document generators (survey plan, deed plan, traverse sheet).
- `src/lib/submission/` — Phase 13 submission domain (partial).
- `src/lib/db/migrations/*.sql` — raw SQL migrations (single source of truth; **no Prisma**).
- `src/app/api/` — ~220 API routes. `src/app/map/` — OpenLayers. `python_worker/` — Python compute sidecar.

---

## Desktop version plan (the "unlimited" app)

> The web app caps heavy compute (100k point cloud cap, TIN in a web worker) and
> forces uploads. The desktop app should run the **same engine** locally with no caps.

### Core principle: one engine, two shells

Do **NOT** rewrite the math. Package the existing pure-TS engine into a desktop
shell so web and desktop produce *identical* results. The only thing that changes
between web/desktop is *where* the compute runs.

The engine modules (`src/lib/engine`, `geodesy`, `geo`, `reports`, `print`) are
already largely free of Next.js/React imports — verify and hoist the few that
aren't (e.g. `survey/networkAdjustment.ts` has a Supabase side effect — ENG-7).

### Recommended stack: Electron + shared core (not Tauri, not a rewrite)

| Choice | Why |
|--------|-----|
| **Electron** | Reuse the React components + TS engine as-is. Web Serial / WebUSB / Web Bluetooth / BLE work for total stations + GNSS rovers. |
| **Shared core as a workspace package** (`@metardu/engine`) | Prevents the #1 desktop-app failure mode: two diverging codebases. |
| **Python sidecar** (`python_worker`, PyInstaller) | The genuinely heavy stuff (LAS/LAZ point clouds >100M pts, photogrammetry) is better in numpy/PDAL than JS. Bundle as a sidecar process, not ported. |
| **WebGPU / WebLLM** | Already present — keep AI assistant + 3D (Three.js) on-GPU, offline. |

### What desktop must add (the differentiators)

1. **Native file access, no caps** — read/write arbitrary LAS/LAZ/CSV/DXF/JobXML/RINEX locally via IPC, no upload, no `MAX_POINTS`.
2. **Hardware I/O** — Web Serial (total stations), WebUSB/BLE (GNSS rovers), RTCM relay (reuse `ntrip-proxy.js`).
3. **Offline compute** — full traverse/LSA/point-cloud/earthworks/mass-haul batches across whole projects.
4. **Same document generators** — deed plans, Form No. 4, workbooks produced locally, identical to web output.
5. **Local project storage** — SQLite (better-sqlite3 is already a dep) or the same Postgres via Docker for power users.

### Suggested build order

1. Create a `packages/engine` workspace extracting `src/lib/engine|geodesy|geo|reports|print` (pure core). Make web import it — this is the safety-critical step, do it first.
2. Stand up an Electron shell (`electron-vite`) loading the existing React app in renderer + engine in main via IPC.
3. Wire file I/O + the 3 `ComputeLimitNotice` tools (point-cloud import, cut-fill, contour-generator) to run uncapped locally.
4. Add Web Serial + BLE hardware panels (currently stubbed: `InstrumentConnectionPanel`, `GNSSConnectionPanel`).
5. Bundle Python worker as sidecar for point-cloud/photogrammetry.
6. Auto-update (e.g. electron-updater) + code-signing.

### What to avoid

- Rewriting the engine in a different language (Rust/C++/Python) — only port the
  truly GPU/CPU-bound pieces to the Python sidecar, keep everything else in the shared TS core.
- Building desktop before the shared `@metardu/engine` extraction, or you'll fork the codebase.
- Treating desktop as a *separate product* — it's the same product with the caps removed.

---

## Resume protocol (for the next agent)

1. `git pull origin main`
2. Read this note + `docs/MASTER_PLAN.md` (find the next `pending` item).
3. Confirm current work: `git status` and `git log --oneline -10`.
4. Verify the build: `npx tsc --noEmit` then `npx jest` (heavy; Docker build uses `--max-old-space-size=4096`).
5. Highest-value unfinished work, in order:
   - Phase 13 submission package (`docs/PHASE13_SUBMISSION_PACKAGE_HANDOFF.md`, resume at Milestone B).
   - Field hardware (G-27/G-28/G-29 in `ROADMAP.md`).
   - Billing go-live (`GOING_LIVE_CHECKLIST.md`).
   - Desktop app (plan above).
6. Commit with `type(scope): ID summary` referencing the MASTER_PLAN/ROADMAP ID.

## Session log

### 2026-08-14 — UI/UX sweep round 1 (theme correctness)
- Fixed **broken shadcn/Tailwind colors in dark mode**: unprefixed tokens
  (`--background`, `--card`, `--primary`, `--accent`, `--border`, `--ring`,
  `--chart-*`) were hex but `tailwind.config.ts` wraps them in `hsl(var(--x))`
  → invalid `hsl(#hex)` → every shadcn component rendered transparent in dark.
  Converted to space-separated HSL in `src/app/globals.css`.
- Unified accent to canonical `#D17B47` (was `#FF7733` in tokens vs `#D17B47`
  in 158 hardcoded usages + `<meta theme-color>`).
- Reconciled "Billion Dollar Look" navy `rgba(13,13,20)` → warm charcoal.
- PWA manifest: `theme_color` `#e8841a`→`#D17B47`, `background_color` `#0a0a0f`→`#050505`.
- `AppSidebar.tsx`: grouped 15 flat nav items into Dashboard/Workflows/Tools/Data/Account; fixed stale `/tools/all`→`/tools`.
- Added `NVIDIA_API_KEY` to `.env` (gitignored) — AI assistant cloud path.
- `npx tsc --noEmit` passes (exit 0).
- **Not yet verified visually** — Docker Desktop / Postgres not running locally, so authed pages (where shadcn fix matters) aren't reachable. Start `docker compose up -d postgres` (or Docker Desktop) to enable a live sweep.

### 2026-08-14 — UI/UX sweep round 2 (live-verified against running stack)
- Stood up local stack for verification: Docker `postgis/postgis:15` on 127.0.0.1:5432 + `npm run migrate` + seeded admin (`mohameddosho20@gmail.com` / dev pw) + `next dev`. Docker Desktop must be running for this.
- **Root-caused the `--accent` dual-purpose collision**: `--accent` was used both as a raw hex color (`.btn-primary`, focus rings, `.gradient-text`) AND as `hsl()` components for Tailwind. Decoupled: Tailwind now reads `--shadcn-*` HSL tokens (`tailwind.config.ts`); component CSS keeps `--accent` hex. Removed the colliding "unprefixed shadcn token" blocks from `:root` and light mode. Verified via computed styles: `.btn-primary` = `rgb(209,123,71)`, `hsl(var(--shadcn-primary))` resolves.
- **Fixed font-loading hydration mismatch** (`Prop media did not match`): removed the `media="print"` flipper + inline script; migrated Instrument Serif / JetBrains Mono / Newsreader to `next/font/google`; Geist stays as a plain `<link>` (not in next 14.2's frozen font index).
- **manifest.json**: removed invalid `scope_extensions` (browser warned "type object expected"), fixed `theme_color`→`#D17B47`, `background_color`→`#050505`, `/tools/all`→`/tools` shortcut.
- **Deleted dead `OnboardingModal.tsx`**; made `OnboardingTour` theme-aware (was hardcoded `#0d0d14`/`#FFB84D`).
- **Fixed migration 044**: `044_boundary_monuments.sql` GRANTs to Supabase `authenticated` role → fresh plain-Postgres deploy failed. Added `ensureCompatibilityRoles()` to `scripts/migrate-unified.mjs` (creates `authenticated`/`anon`/`service_role` if missing). Verified: fresh DB applies all 52 migrations cleanly.
- **Verification**: `npx tsc --noEmit` exit 0; `npx jest` 161 suites / 2469 passed; landing + login + dashboard render with 0 console errors.

### 2026-08-14 — Landing imagery implementation
- Landing images were effectively invisible (hero under 95% scrim, feature cards
  at 12% opacity on hover only, blueprint at 18% screen). Made them properly used:
  - Hero: scrim 95%→85% and image brightness 0.75→0.85 so terrain is visible.
  - Feature cards: each of the 6 features now has a relevant always-visible
    background image (0.14 opacity, 0.22 on hover) + gradient for legibility.
  - Features section: theodolite blueprint 0.18→0.4 (screen blend).
  - Workflow section: added fieldbook/survey background at 0.22.
  - All images verified loading 200 via `_next/image`; landing 0 console errors.
- **Could NOT fetch real survey photography** this session: Wikimedia 429
  (IP rate-limited), Pexels 403, Unsplash 401/503, Openverse irrelevant.
  Created `scripts/fetch-landing-photos.mjs` (curated Wikimedia set + licensing)
  and `public/landing/CREDITS.md` for when the rate limit clears. Run the fetch
  script, then point section backgrounds at the new files (see script header).

### 2026-08-14 — Deployed + live verification
- Committed `7d7ff799` and pushed to `main`; GitHub Actions "Deploy to Production"
  succeeded in 7m31s. Live site now runs the fixes.
- **Verified live:** Cloudflare beacon CSP error gone, manifest warnings gone,
  landing images load 200.
- **Remaining live issue:** React #418/#423 hydration errors persist on
  `metardu.space` because **Cloudflare Rocket Loader** is enabled on the zone
  (confirmed via `rocket-loader.min.js` in console + MIME error). Rocket Loader
  rewrites Next.js's inline RSC scripts, breaking hydration even though the
  code-side font-flipper fix is deployed (local dev has 0 errors).
  - **Fix (dashboard, not code):** Cloudflare → metardu.space → Speed →
    Optimization → Content Optimization → **Rocket Loader → Off**. Then reload.
  - **CONFIRMED 2026-08-14:** Loading the live page with `**/cdn-cgi/scripts/**`
    aborted in Playwright removes ALL #418/#423 errors → Rocket Loader is 100%
    the cause. The zone-settings API token was scoped out (10000 on
    `/zones/{id}/settings/rocket_loader`), so the dashboard toggle is required.
  - **FINAL CAUSE (2026-08-14):** After Rocket Loader was switched off, hydration
    errors persisted. Blocking `email-decode.min.js` alone cleared them →
    **Cloudflare Email Address Obfuscation** is the real cause. It rewrites the
    footer `mailto:` links into `/cdn-cgi/l/email-protection#...` in the edge HTML
    and decodes them client-side, which breaks React hydration. Fix: Cloudflare →
    metardu.space → **Email → Email Address Obfuscation → OFF**. Both Rocket Loader
    and Email Obfuscation are known to break Next.js 14 hydration.
  - Code-side (done): `data-cfasync="false"` could be added to critical inline
    scripts as a hardening measure, but disabling Rocket Loader is the correct fix.

### 2026-08-14 — Dashboard navbar + auth-page fixes + mobile-export fix
- **Bug: no navbar on `/dashboard`.** `/dashboard` lived at `src/app/dashboard/`,
  OUTSIDE the `(dashboard)` route group. `AppShell` (L48) hides the top NavBar for
  dashboard routes expecting the group's `layout.tsx` sidebar, so the page had
  neither. Fix: `git mv src/app/dashboard/*` → `src/app/(dashboard)/dashboard/`.
  Verified locally in Playwright: `/dashboard` now renders the AppSidebar.
- **Bug: login/register rendered white-on-white** (invisible) in light/field mode.
  Pages are dark-glass designs with hardcoded white text but use `var(--bg-*)`
  tokens that flip to near-white outside dark mode. Fix: `.auth-page` scope block
  in `globals.css` pins the dark palette (incl. `!important` neutralization of the
  field/outdoor-mode element sweeps) and is applied to login/register page roots
  + the login Suspense fallback spinner.
- Commit `57c5bf75` pushed → Deploy to Production succeeded (run 31833478906).
  Live-verified: `/login` 200 with `auth-page` in SSR markup; `/dashboard` 307 →
  `/login?next=%2Fdashboard` (route resolves).
- **Hydration fix is live:** live home page footer `Contact Support` now carries
  `suppressHydrationWarning` server-side; only `<html>/<body>` carry it on login.
- **CI regression my move caused:** moving the dashboard into the route group
  broke `scripts/mobile-build.mjs` — its stash list still referenced the old
  `src/app/dashboard` path, so the `force-dynamic` dashboard page leaked into the
  Capacitor static export and `next build` failed ("couldn't be exported").
  Fix: stash `(dashboard)/dashboard` instead (`157619c1`). CI run 31836012941 all
  green; local `node scripts/mobile-build.mjs` verified with fresh stash.
- Remaining known infra quirk: Deploy's external "Verify live deployment" always
  logs `HTTP 000000` (runner egress) while the in-VM `/api/public/health` returns
  200 — harmless false-negative.

### 2026-08-15 — Engine correctness batch (ENG-2…ENG-12)
- Shipped the full Engine Workstream from MASTER_PLAN (`d73820a1` + `83ff4407`):
  - ENG-2 `@deprecated` no-datum Cassini exact chain (100–300 m off) w/ explicit warning
  - ENG-3 leveling cross-check now attributes BS/FS to the same setup
  - ENG-4 parser UTM range check is opt-in (`utmZone`) and uses the physical 0–1,000,000 m span
  - ENG-5 mass-haul average distance = ∫|cumulative|·dx ÷ (borrow+waste), not cut+fill
  - ENG-6 Delaunay fallback logs via `logger.warn` (was silent, then `console.warn` — no-console is a zero-baseline ratchet error)
  - ENG-7 removed Supabase side effect from `survey/networkAdjustment.ts` (pure now)
  - ENG-8 `SURVEY_TYPE_TO_RDM_ORDER` cross-reference + `findRDMOrderForRatio`
  - ENG-9 exact per-observation Q_vv diagonal (`sparseQvvDiagonal`, O(m·nnz(L))) for constrained networks via AMD-permuted factor
  - ENG-10 `transformToWGS84ByCountry` auto-datum selection
  - ENG-11 synthetic Cassini provenance suite (4 corners/subsheet, UTM bounds, seamless-lattice seam check)
  - ENG-12 `auditTrail.ts` fails closed on missing SubtleCrypto (no djb2)
- Verification: full Jest 162 suites / 2476 tests + `tsc --noEmit` clean; lint-gate + lint-ratchets clean; CI run 31882730068 green; Deploy 31882730067 success.

### 2026-08-15 — Phase 13 Milestone B (submission package manifest)
- Milestone A was already shipped (submission model, numbering, surveyor profile).
  This session adds Milestone B (package skeleton): `src/lib/submission/manifest.ts`
  with `evaluatePackageCompleteness` + `buildPackageManifest` that map generated
  artifacts onto the 8 benchmark `SUBMISSION_SECTIONS` and report ready/missing
  required/missing optional in benchmark order. `assembleSubmission.ts` embeds the
  report in `manifest.json`. 7 unit tests. CI 31887769687 green, Deploy 31887770226 success.
- **Known schema drift (needs live-DB reconcile, not yet fixed):**
  1. `revisionNumber.ts`/`assembleSubmission.ts`/`api/submission/sequence` write
     `submission_sequences` (plural, migration 007, `current_sequence`), but the
     canonical `numbering.ts` + migration 047 use `submission_sequence` (singular,
     `last_sequence` + `increment_submission_sequence()`). Two competing tables.
  2. `surveyor_profiles` (migration 000) has `isk_number`, but `surveyorProfile.ts`
     queries `registration_number` (+ `seal_url`/`signature_url`) — column mismatch
     that will 500 at runtime until reconciled.

## Related
- [[METARDU Home]]
- [[METARDU Desktop]]
- [[Compute Limits & METARDU Desktop]]
- [[Deployment VM]]
