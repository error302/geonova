# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning so the CI `--max-warnings` ceiling can drop to `0` and each rule flips to `error`.

**Progress:** 14,030 → **0** (measured 2026-08-13, `lint-ratchets --report` on origin/main). **ALL families done** — row-typing (0/538), a11y (0 findings), member-access, explicit-any, argument, assignment, no-unsafe-return, no-unsafe-call, no-non-null-assertion, **no-unused-vars** and **no-restricted-syntax** are **done** (rules flipped to `error`). Whole-repo warning count: **ZERO**.

> **This doc is the canonical checkpoint.** Every grind session starts by reading the
> **STATUS CHECKPOINT** below and ends by updating it. If an agent is rate-limited or
> interrupted mid-batch, the next agent resumes from this file — commit-per-batch means
> nothing is ever lost in the working tree.

---

## 0. STATUS CHECKPOINT — read this first (2026-08-12)

### Live floors vs committed (gate green, `lint-ratchets --report` exit 0)

| Family | Live | Floor (baseline) | Status |
|---|---|---|---|
| `no-unsafe-member-access` | 0 | **0** | ✅ done (rule = error) — 1-warning tail ground (30 → 0) |
| `no-unsafe-assignment` | 0 | **0** | ✅ done (rule = error) — batches 1b/1c + tail drained 281 → 0 (floor 10 → 0), flipped 2026-08-11 |
| `no-explicit-any` | 0 | **0** | ✅ done (rule = error) — 1-warning tail + `db.ts` default ground |
| `no-unsafe-argument` | 0 | **0** | ✅ done (rule = error) |
| row-typing (`db.query` untyped) | 0 / 532 | **0** | ✅ done |
| a11y findings | 0 | **0** | ✅ done |
| **total warnings** | **0** | CI ceiling **0** | ✅ **ZERO — plan complete** |

Other rules (no CI floor, `--max-warnings` ceiling only): `no-unused-vars` **0 → error** · `no-console` 0 · `react-hooks/exhaustive-deps` 0 · `no-unsafe-call` 0 · `no-non-null-assertion` 0 · `no-restricted-syntax` 0 (drained 16 → 0 and flipped to `error` 2026-08-13). (Non-null batch 3 fixed 85 sites in `networkAdjustment.ts`, `helmertRigorous.test`, `cassini.test`, `fr583_4acres_survey.test`, `statutoryGate.test`, `gnssBaseline.test` via a `mustGet()` map guard + the shared `defined()` helper.) (Unused-vars grind started 2026-08-12: batch 1 dropped 34 sites in `mobile/field/page.tsx`, `TopoDrawingComposer.tsx`, `tools/page.tsx` — dead imports/state/props removed, `_`-prefixed callback args, dead `userPlanRank` prop chain deleted; batch 2 dropped 51 sites in `TraverseFieldBook`; batch 3 dropped 82 sites in `develop-full-plan`, `formNo3Renderer`, `RailwayPanel`, `RoadPanel`, `GNSSConnectionPanel`, `ReportTemplateEditor`, `SubdivisionPanel`, `deed-plan/generator`, `international`, `stubs`, `sequentialAdjustment`, `cadastralPlanDXF`, `scheme/page` — dead imports trimmed, unused usePrint/useRouter/state removed, 42-line dead `includeSheetLayout` block deleted; batch 4 dropped 56 sites in `admin/page`, `SurveyReportBuilder`, `traverseEngine`, `generateDocx`, `fileRouter`, `formNo4Renderer`, `spiralAlignment`, `deformationMonitoring` — dead imports trimmed, write-only `currentE/currentN/currentRL` accumulators deleted, `_`-prefixed args; batch 5 dropped 52 sites in `field/page`, `TraverseModal`, `LevellingComputePanel`, `VersionHistory`, `RIMOverlay`, `parseDXF`, `multiSheetPdf`, `surveyReport/index` — dead state/imports/props, 6 write-only affine accumulators in RIMOverlay, dead `toSvgX/toSvgY/offsetX/offsetY/pxPerM` chain, dead `pageFooterOpts`; batch 6 dropped 40 sites in `cogoEngine`, `networkAdjustment`, `planGeometry`, `crossSectionGeometry`, `shapefile`, `computationWorker`, `parseDNA03`, `compute.worker` — dead imports/helpers/accumulators trimmed, `_`-prefixed params, and a real IDW bug fix (`weightSum / weightSum` → `weightedSum / weightSum`) in `compute.worker`; batch 7 dropped 40 sites in `SectionalPlanEditor`, `NotificationBell`, `ParcelCanvas`, `InstrumentStreamBar`, `SystemHealthPanel`, `AddPointModal`, `survey-engine.test`, `process/page` — dead imports/state/props/functions trimmed, 4 bare catch blocks, 3 unused setters, and the one genuinely-dead `flatPts` in ParcelCanvas (the two live copies verified and preserved); batch 8 dropped 104 sites across the whole 4-warning tier (26 files: `community/page`, `CADEditor`, `Step6Outputs`, `MapViewer`, `CommandPalette`, `SolutionRenderer`, `CutFillPanel`, `BuildingPanel`, `DamPanel`, `AdversePossessionCalc`, `DeformationTrackerPanel`, `RealTimeQCPanel`, `community`, `earthworksEngine`, `traverseRunner`, `edm-corrections`, `geometry`, `traverseDXF`, `helmertRigorous`, `gnss`, `offline/sync`, `parsePDF`, `field-to-finish`, `correction-pipeline`, `autoCalculate`) — dead imports/components/state removed, `_`-prefixed args and alias-destructured props, dead accumulators (`prevOrdinate`, `sideWidth`, `col`, `targetRealMeters`, `paramsPlus/Minus`, `f0`) deleted); batch 9 dropped 183 sites across the whole 3-warning tier (61 files) — 684 → 501; batch 10 dropped 240 sites (120 files, 2-warning tier) — 501 → 261; batch 11 drained the 1-warning tail (261 files) — **261 → 0**, rule flipped to `error`, ceiling 350 → 0 2026-08-13). (Non-null grind started 2026-08-12: batch 1 fixed 115 sites in `featureCodes.test`, `mpesa.test`, `networkAdjustment.test`, `unified3dAdjustment.test`, `LongSectionRenderer`, `ProgressMonitorPanel` via a `defined()` guard helper / type-predicate filters / an `id` guard — real narrowing, not suppressions; batch 2 fixed 60 sites; batch 3 fixed 85 sites; batch 4 fixed 33 sites in `sequentialAdjustment.test`, `lsaIterative.test`, `spiralAlignment.test`, `verticalCurveDesigner.test`, `analytics/page.tsx`; batch 5 fixed 54 sites; batch 6 fixed 25 sites in `robustEstimation`, `networkAdjustment`, `dxfSheetLayout`, `digitizingHandlerContract.test`, `unifiedImport.test`; batch 7 fixed 28 sites in `traverse/engine`, `gsiParser`, `beaconLookup`, `levelNetworkAdjust`, `numbering.test`, `subdivision.test`, `cogo.test`; batch 8 fixed 33 sites in `cpd/route`, `process/page`, `LongitudinalSection`, `FieldStationSetup`, `asBuiltSurvey`, `atmosphericDefaults`, `working-diagram/traverse`, `deformationMonitoring.test`, `toolGates.test`, `ntrip-client.test`, `chainage.test` in `loginLimiter`, `offlineStorage`, `entityGraph`, `national_sheets`, `crossSectionPdf`, `AnalysisTab`, `traverseAccuracy.test`, `rinex.test`, `pileGrid.test` via `upstashEnv()`/`requireDb()`/`cassOf()` guards, get-or-guard narrowing, type-predicate filters, and the shared `defined()` helper) in `statutoryWorkbook`, `benchmarks`, `crossSectionGeometry.test`, `least-squares`, `ownership.test`, `traverseLayer.test` via `lastRow(ws)`/`findStation()` guards, captured closure consts, and the `defined()` test helper.) (`no-unsafe-return` ground to 0 and `no-unsafe-call`/`no-console` drained to 0 2026-08-12; both unsafe-return and unsafe-call flipped to `error`.)

### Git / CI state

- **Branch:** `chore/lint-typing-page-batch` (work happens here; pushes go to `origin/main` via fast-forward).
- **HEAD:** batch-11 final commits (no-unused-vars → 0, ceiling → 0) — on `origin/main` after the push; local work continues on `chore/lint-typing-page-batch`.
- **Uncommitted (this batch):** none in flight — tree holds only `.a11y-audit.json` (a11y-sweep regeneration) + `_tmp-*.py` helpers. Floors: all **0** · total **0** (every `@typescript-eslint` family + `react-hooks/exhaustive-deps` + `no-restricted-syntax` + `no-non-null-assertion` + `no-unused-vars` flipped to `error`).
- **Unpushed:** none — `origin/main` is at HEAD (argument batch + CI fix already pushed).
- **Known-red CI (pre-existing, not typing work):**
  - `Deploy to Production` — GCP VM SSH timeout (infra; unrelated to code).
  - `E2E Tests` — **fixed & green** (all four shards pass; standalone-server + OAuth env + seeded-user + spec-alignment fixes landed). Only `Deploy to Production` remains red (GCP SSH — infra).
- **WIP:** none currently. If a concurrent session leaves files uncommitted, re-baseline floors **with them stashed** so floors match committed code — otherwise CI fails with "live > floor" (the premature-baseline trap; see §7 rule 4).
- **Session worktree:** `write_file` lands in `.freebuff/worktrees/d90ebaf2-f825-4569-b94c-966f3d5aa130`; the real checkout is `C:/Users/user/Desktop/METARDU`. **Run `node scripts/sync-mirror.mjs` before editing** — it byte-copies every tracked file that drifted from HEAD into the mirror (EOL-insensitive compare, WIP set skipped), so the mirror never carries an old untyped/syntax-broken copy. Manual `cp` is only needed for the active WIP set (see §7 rule 6). Files are **CRLF** in the worktree, LF in primary — git normalizes; scripts must not assert exact line endings.

### First commands for any new session

```bash
cd C:/Users/user/Desktop/METARDU
node scripts/sync-mirror.mjs             # converge the .freebuff mirror to HEAD (WIP set skipped, see §7 rule 6)
git status --short                     # expect nothing (or the concurrent session’s WIP)
git log --oneline origin/main..HEAD    # confirm what's still unpushed
node scripts/lint-ratchets.mjs --report   # confirm gate green + live floors (exit 0)
node scripts/warn-scan.mjs                 # regenerate the per-file census (next: unused-vars batch 8)
node scripts/rule-census.mjs                # regenerate the per-RULE breakdown (matches the ratchet total)
```

If the gate is red, §7 rule 4 (stash-rebaseline) is the usual cause — read the report, never `--update` a floor to mask a WIP-induced drop.

---

## 1. Remaining work, ordered for completion

**Checklist state (live scan 2026-08-13, origin/main @ `3efadacb` — committed total 848):**

| Family | Live | Rule | Status |
|---|---|---|---|
| `no-unsafe-argument` | 0 | `error` | ✅ done |
| `no-explicit-any` | 0 | `error` | ✅ done |
| `no-unsafe-member-access` | 0 | `error` | ✅ done |
| `no-unsafe-assignment` | 0 | `error` | ✅ done |
| `no-unsafe-return` | 0 | `error` | ✅ done |
| `no-unsafe-call` | 0 | `error` | ✅ done |
| `no-console` | 0 | warn | ✅ drained |
| row-typing (`db.query` untyped) | 0 / 532 | gate | ✅ done |
| a11y findings | 0 | gate | ✅ done |
| `no-unused-vars` | **261** | warn | ⏳ next (batch 11 — 1-warning tail, worklist in §5.2) |
| `no-non-null-assertion` | **0** | `error` | ✅ done |
| `react-hooks/exhaustive-deps` | **0** | **error** | ✅ |
| `no-restricted-syntax` | **0** | **error** | ✅ done — drained 16 → 0 (MapClient memo → SRID constants, nativeProjectionView.test codes → module constants, 4 local `interface SurveyPoint` renamed, canonical file override), flipped 2026-08-13 |
| **total** | **261** | CI ceiling **350** | green |

Order = finish the family closest to zero first (each finish removes a floor + shrinks the ceiling), then mechanical rules, then CI tightening. **All six `no-unsafe-*` families are done** — only the mechanical rules remain. Finish order: **unused-vars (501) → ceiling → 0** (no-restricted-syntax done — drained + flipped to `error` 2026-08-13). (exhaustive-deps **done** — ED-1 17 sites + ED-2 27 sites; flipped to `error`.) (ED-1 2026-08-13: 17 sites across admin/payments, analytics, MapClient, mobile/field, progress-monitor, LongSectionRenderer, FieldBookMobile, WeatherPanel, StakeoutRadar — useCallback-wrapped loaders/fetchWeather hoisted above calling effects to avoid TDZ, mapInstance/editingToolRef captured in the cleanup closure, progress-monitor tolerance wrapped in useMemo, duplicate dep removed.)

### Phase 1 — `no-unsafe-argument` — ✅ **DONE (0 warnings, rule = error)**

All batches drained (`argument-scan --batch 1` → 0 across 0 files); floor locked to 0 in `scripts/argument-baseline.json`; rule flipped to `error` in `.eslintrc`.

### Phase 2 — `no-explicit-any` — ✅ **DONE (0 warnings, rule = error)**

538 → 0 across 227 files (batches 1–5 + the 1-warning tail + `db.ts`'s `= any` default → `= QueryResultRow`); floor 0; rule = `error`.

### Phase 3 — `no-unsafe-member-access` — ✅ **DONE (0 warnings, rule = error)**

1,101 → 0 (batches 1–9 + the 1-warning tail, 30 → 0); floor 0; rule = `error`. Recipe that carried the family: type the *source* once per file — `db.query<Row>` generics, `res.json()` casts, `JSON.parse` assertions, `useRef`/`useState` real types, OL/structural casts at library boundaries.

### Phase 4 — `no-unsafe-assignment` — ✅ **DONE (0 warnings, rule = error)**

829 → 0 (batches 1–2 + 1b/1c + the tail, 281 → 0, floor 10 → 0); rule = `error`. Same type-the-source recipe as Phase 3.

### Phase 5 — mechanical rules (848 combined)

| Rule | Live | Fix class | Next tier |
|---|---|---|---|
| `no-non-null-assertion` | **0** | ✅ done — batches 1–12 drained 113 → 0, suppression sweep removed the last 9 hidden `!` sites; flipped to `error` 2026-08-12 | — |
| `no-unused-vars` | **261** | `_`-prefix unused bindings, drop dead imports/state/props | batches 1–10 drained 879 sites; batch 11 = the whole 1-warning tail (261 files / 261 sites, all remaining work) — worklist pre-computed in §5.2 below |
| `react-hooks/exhaustive-deps` | **0** | `error` — keep deps honest; justified mount-once disables allowed (3 in repo) | ✅ drained (ED-1: 17 sites; ED-2: 27 sites) |
| `no-restricted-syntax` | **0** | project-specific banned patterns — check the rule config | ✅ done — 16 → 0 (drained 2026-08-13) |
| `no-console` | 0 | ✅ drained — routed through `lib/logger.ts` | — |
| `no-unsafe-call` | 0 | ✅ flipped to `error` 2026-08-12 | — |
| `no-unsafe-return` | 0 | ✅ flipped to `error` 2026-08-12 | — |

### Phase 6 — CI tightening + completion

1. Push every batch; watch the ci.yml run — all code gates must stay green.
2. As each family hits 0: drop its floor to 0 (via `--update-<family>`) and flip the rule to `"error"` in the ESLint config so it can never regress. Done for all six `no-unsafe-*` families; the four mechanical rules ride the `--max-warnings` ceiling (no floors).
3. Tighten `--max-warnings`: 20,000 → 10,000 → 5,000 → 3,700 → 3,000 → 2,800 → 2,000 → 1,500 → 1,400 → 1,350 → 1,100 → 1,000 → 700 → 550 → 500 → **350** (now) → **0** as the totals shrink (total is 261). Keep the ceiling documented in the workflow files.
4. E2E is green (all four shards — standalone-server + OAuth env + seeded-user fixes landed). The only known-red job left is **Deploy to Production** (GCP VM SSH — infra, needs credentials/VM work, out of code scope).

## 2. Root causes (why ~80% is the `no-unsafe-*` family)

1. **`db.query()` untyped rows** — **solved repo-wide** (532/532 typed via `api-row-sweep`); residual member/assignment warnings come from *helpers* returning rows or row-shaped objects, not raw queries.
2. **Helper signatures typed `: any`** (`doc: any`, `ctx: any`, `obs: any`, `pt: any`) — replace with real jsPDF / canvas / OL / row types.
3. **`.map((r: any) => …)` / `.forEach((f: any) => …)` callbacks** — usually rows or object props; type the callback param.
4. **`fetch(...).json()` untyped** — `await res.json()` is `any`; cast to declared/added interfaces (or zod-infer shared schemas for client/server-boundary shapes — the `MapExtent` pattern).
5. **`JSON.parse` returns `any`** — assert the stored shape.
6. **OL objects through `any` refs/states** — `useRef<any>`, `useState<any>` (map cluster largely cleared; remaining weight in fieldbook/tools pages and LayerControl).
7. **Test files with `as any` fixtures** — replace with precise literals or `satisfies`.

## 3. The recipe (per file)

Type the *source* once, never widen to `any`:

- `db.query<RowIface>(...)` — row interfaces already exist in most route files
- `doc: any` → `doc: jsPDF`, `ctx: any` → `CanvasRenderingContext2D`
- `const json = (await res.json()) as { data?: Row[]; ... }`
- `const parsed = JSON.parse(x) as Shape`
- `useRef<RealType>` / `useState<RealType>`; drop redundant `: any` annotations
- unused vars: `_`-prefix or remove the import/binding
- `!` → real narrowing; add `if (x === null) throw/return` guards
- new shared boundary schemas go in `src/lib/validation/*.ts` as zod schemas, consumed by both the route (parse) and the client (z.infer)

## 4. Batch roadmap — status

The original B1–B5 roadmap has **landed**: row-typing is 100%, member-access fell 5,066-era → 1,101, assignment 1,715-era → 829, argument 381 → 232, explicit-any 1,014-era → 538, totals 14,030 → 5,291. Remaining work is the phased plan in §1 — each session starts with `--batch 1` on the target family's scanner for a precise per-line worklist.

## 5. Tooling

- `scripts/member-scan.mjs` / `assignment-scan.mjs` / `argument-scan.mjs` — family scanners (`--top N` ranking, `--batch N` per-line worklists, `--out` JSON)
- `scripts/lint-ratchets.mjs` — baseline ratchet + `--report` drift table + decoupled family floors (`--update-member-access` / `--update-assignment` / `--update-explicit-any` / `--update-argument` / `--update-row-typing` / `--update`, all single-flag)
- `scripts/lint-gate.mjs --paths-from-changed <base>` — fast PR changed-files gate (all floors)
- `scripts/api-row-sweep.mjs` — API-route `db.query<T>` census (`--check` CI gate, `--apply`, `--verify`, `--apply-all`, `--no-member-scan`, `--batch-plan`)
- `scripts/warn-scan.mjs` — regenerates the per-file census (`scripts/warn-plan-data.json`)
- `scripts/rule-census.mjs` — per-RULE warning census (one command; total matches the ratchet; writes `scripts/rule-census-data.json`)
- `scripts/e2e-profile.mjs` — per-spec E2E shard profile from the latest ci.yml run via `gh` (per-shard wall + test time, per-spec duration table, retry/flaky accounting; `--run <id>` to target a specific run)
- `scripts/a11y-audit.mjs` — WCAG sweep (0 findings, 1,856 files; `--write-audit` regenerates `.a11y-audit.json`)
- Baselines: `scripts/{member-access,assignment,explicit-any,argument,row-typing,warning,a11y}-baseline.json`

## 6. Rules of engagement (every batch)

1. **Read §0 checkpoint first** — confirm branch, floors, WIP file.
2. `npx tsc --noEmit` clean for touched files before lint.
3. Per-file eslint → target family at **0** for the batch files.
4. **Anti-premature-baseline trap:** if `GNSSRoverConnection.tsx` (or any WIP) is modified, `git stash push -- src/components/survey/GNSSRoverConnection.tsx` before re-baselining, then `git stash pop`. Floors must match *committed* code.
5. `node scripts/lint-ratchets.mjs --update-<family>` for each family that moved (one flag per invocation) + `--update` for the total; then `--report` → gate must be green and floors ≤ previous.
6. **Worktree sync:** start each session with `node scripts/sync-mirror.mjs` to converge the mirror (`node scripts/sync-mirror.mjs --dry-run` to preview). It byte-copies tracked files that drifted from HEAD into `.freebuff/worktrees/d90ebaf2-f825-4569-b94c-966f3d5aa130` (EOL-insensitive compare; the WIP set from `git status` is skipped in both trees), so the mirror can never carry an old untyped/syntax-broken version. For the **active WIP set** (files the concurrent session is mid-edit on, plus untracked `_tmp-*.py` scripts), keep the manual `cp "$WT/..." ...` — sync-mirror deliberately leaves those alone. Edits you make via file tools land in the mirror; copy them to the primary before committing. Files are CRLF in the worktree / LF in primary; `git diff --ignore-space-at-eol` or `cmp -s` after normalization.
7. Run related jest suites for touched libs; fix regressions.
8. Commit per batch (conventional message, floor drops in the body: `refactor(types): … — member-access 1133→1105`). Never commit `GNSSRoverConnection.tsx` as part of a typing batch.
9. Push (fast-forward to `origin/main`), watch the ci.yml run to completion; every code gate must stay green.
10. **Update §0 of this doc** with the new floors/HEAD/unpushed state so the next agent resumes cleanly.

## 7. Rate-limit / handoff continuity

- **Commit per batch** — the working tree is never the source of truth; commits are.
- **This doc is the checkpoint** — a fresh agent runs §0's "first commands" and picks the next batch from §1. If a batch is mid-flight when a session dies, commit what's verified; the WIP (`_tmp-*.py` scripts, partial edits) can be re-derived from §1 worklists.
- **Never `--update` a floor to absorb unrelated growth** — floors only move down after a genuine live drop on committed code.
- **Known-red CI is documented, not blocking** — Deploy (GCP SSH) and E2E (env/timeout) are separate workstreams (§0); typing batches only need the code gates green.

---
## Phase 5 worklists — pre-computed from the live census (2026-08-13, 261 unused-vars total; **batch 11 DONE 2026-08-13 — 261 → 0, all families complete**)

**Batch 9 — 3-warning tier: 61 files, 183 sites — ✅ DONE (2026-08-13, 684 → 501)**
- `src/app/api/engineering/data/route.ts` — NextRequest, EngineeringSubtype, ctx
- `src/app/api/equipment/add/route.ts` — NextRequest, calibrationCertNumber, calibrationLab
- `src/app/api/whatsapp/route.ts` — remaining, from, error
- `src/app/help/page.tsx` — Wrench, Building2, Satellite
- `src/app/marketplace/page.tsx` — deleteListing, createClient, onRefresh
- `src/app/pricing/page.tsx` — SUPPORTED_CURRENCIES, faqs, paypalContainerRef
- `src/app/project/[id]/contours/page.tsx` — ApiError, majorInterval, i
- `src/app/project/[id]/profiles/page.tsx` — profileError, idx, chainagePoints
- `src/app/tools/bearing/page.tsx` — ToolExportButtons, calcError, setCalcError
- `src/app/tools/chainage/page.tsx` — ToolExportButtons, idx
- `src/app/tools/distance/page.tsx` — ToolExportButtons, calcError, setCalcError
- `src/app/tools/earthworks/page.tsx` — useState, useMemo, computeVolumes
- `src/app/tools/grade/page.tsx` — ToolExportButtons, calcError, setCalcError
- `src/app/tools/height-of-object/page.tsx` — ToolExportButtons, calcError, setCalcError
- `src/app/tools/regulatory-checklist/page.tsx` — Map, AlertCircle, CheckCircle2
- `src/app/tools/subdivision-generator/page.tsx` — useMemo, SubdividedPlot, t
- `src/app/tools/survey-regulations/page.tsx` — i
- `src/app/tools/us-survey-reference/page.tsx` — i
- `src/components/ai/SurveyAssistant.tsx` — MessageSquare, X, Cpu
- `src/components/compute/DroneComputePanel.tsx` — GCPResult, setGcps, i
- `src/components/compute/GeodeticComputePanel.tsx` — Save, CheckCircle, projectId
- `src/components/engineering/panels/TunnelPanel.tsx` — projectId, subtype, i
- `src/components/engineering/PileGridPanel.tsx` — formatBearingDMS, i
- `src/components/engineering/VolumesPanel.tsx` — i, tb
- `src/components/field/FieldDataCollector.tsx` — setAudioEnabled, handleStakeout, sessionState
- `src/components/importer/UniversalImporter.tsx` — SupportedFormat, detectFormat, getParser
- `src/components/InstrumentConnectionPanel.tsx` — Wifi, Radio, onPointReceived
- `src/components/landlaw/AIPlanChecker.tsx` — Download, BeaconRecord, addBeacon
- `src/components/map/panels/AttributeTable.tsx` — Plus, CheckCircle2, AlertTriangle
- `src/components/map/SheetLayout.tsx` — containerWidth, containerHeight, viewExtent21037
- `src/components/MobileNav.tsx` — AlertTriangle, Clock, authStatus
- `src/components/NavBar.tsx` — showInstall, hydrated, handleInstall
- `src/components/online/GNSSProcessor.tsx` — MapPin, Download, router
- `src/components/ParcelAreaModal.tsx` — distanceBearing, points, handlePointClick
- `src/components/road-design/SuperelevationCalculator.tsx` — ROAD_CLASSES, TERRAIN_TYPES, i
- `src/components/survey/StakeoutRadar.tsx` — position, err
- `src/components/survey/TopologyGuardrail.tsx` — useCallback, CheckCircle2, MapPin
- `src/components/workspace/EnhancedSplitLayout.tsx` — ChevronUp, ChevronDown, idx
- `src/hooks/useVertexEditing.ts` — SRID_3857, SRID_21037, pixel
- `src/lib/computations/roadDesignEngine.ts` — isSSDCompliant, isPSDCompliant, superelevation
- `src/lib/compute/pythonService.ts` — path, body, opts
- `src/lib/compute/volumeRunner.ts` — endAreaVolume, prismoidalVolume, VolumeSection
- `src/lib/db/optimization.ts` — cursorId, alias, table
- `src/lib/documents/templates/mutation-vector-layout.ts` — PDFDocument, PAPER_SIZES, mmToPt
- `src/lib/engine/curves.ts` — toDegrees, isExternal, delta
- `src/lib/engine/subdivision.ts` — RoadReserveInfo, tCurrent, width
- `src/lib/engineering/drainageDesign.ts` — flowDepth, wettedPerimeter, timeOfConcentration
- `src/lib/export/dxfSheetLayout.ts` — sheetSize, targetRealMeters, footerH
- `src/lib/geo/transformationCalibration.ts` — sigmaZeroSquared, fromFrame, toFrame
- `src/lib/gnss/lambda.ts` — matMul, wj, secondBest
- `src/lib/importers/parsers/gsi.ts` — meanAngle, angleUnit, fullCircle
- `src/lib/map/subdivisionLayer.ts` — Point2D, LineString, strokeColor
- `src/lib/offline/syncQueue.ts` — oldVersion, newVersion, sleep
- `src/lib/parcel/parcelValidation.ts` — distanceBearing, regDist, sDist
- `src/lib/reports/surveyPlan/signedPdfExport.ts` — createHash, PDFDocument, SurveyPlanRenderer
- `src/lib/survey/adapter/index.ts` — applySeaLevelReduction, applyGridScaleFactor, applyAtmosphericCorrection
- `src/lib/survey/digitalLevel/parseDiNi.ts` — filename, lineNo
- `src/lib/survey/digitalLevel/parseTopconDL.ts` — filename, lineNo
- `src/lib/survey/fieldData/gsiParser.ts` — totalDistCount, backsightBearing, bs
- `src/lib/survey/fieldData/topconSDRParser.ts` — SDR33_WIDTHS, errors, totalDistCount
- `src/lib/survey/traverse/engine.ts` — firstFixed, legs, fixedStations

**Batch 10 — 2-warning tier: 120 files, 240 sites — ✅ DONE (501 → 261, 2026-08-13)**
- `src/app/ai-plan-checker/page.tsx` — Upload, FileText
- `src/app/api/admin/health/route.ts` — req, ctx
- `src/app/api/admin/licenses/[licenseId]/seats/route.ts` — NextRequest, ctx
- `src/app/api/admin/licenses/route.ts` — NextRequest, randomUUID
- `src/app/api/ardhisasa/route.ts` — NextRequest, ctx
- `src/app/api/compute/export/traverse-dxf/route.ts` — NextRequest, uniqueKey
- `src/app/api/cpd/route.ts` — NextRequest, generateCPDCertificate
- `src/app/api/engineering/ips/route.ts` — NextRequest, ipName
- `src/app/api/equipment/route.ts` — ctx
- `src/app/api/export/nlims/route.ts` — req, ctx
- `src/app/api/geo/cors/route.ts` — NextRequest, ctx
- `src/app/api/gnss/ntrip/route.ts` — NextResponse, config
- `src/app/api/gnss/process/route.ts` — NextRequest, stationLabels
- `src/app/api/notifications/route.ts` — ctx
- `src/app/api/parcel-vault/route.ts` — NextRequest, db
- `src/app/api/rim-templates/route.ts` — NextRequest, ctx
- `src/app/api/scheme/export/dxf/route.ts` — ctx, key
- `src/app/api/scheme/status/route.ts` — NextRequest, ctx
- `src/app/api/scheme/submission/checklist/route.ts` — NextRequest, ctx
- `src/app/api/scheme/submission/track/route.ts` — NextRequest, ctx
- `src/app/api/survey/audit/route.ts` — AuditEntry, trail
- `src/app/api/workers/process/route.ts` — NextRequest, NextResponse
- `src/app/cpd/page.tsx` — fetchError, totalPoints
- `src/app/guide/[type]/page.tsx` — router, idx
- `src/app/import/page.tsx` — content, loadingProjects
- `src/app/industrial/page.tsx` — copied, setCopied
- `src/app/map/components/CogoToolsPanel.tsx` — distanceBearing, to21037
- `src/app/map/components/IdentifyPanel.tsx` — useEffect, FileText
- `src/app/map/components/MapOverlayManager.tsx` — smEdgeMargin, anchor
- `src/app/map/components/OfflineDownloadButton.tsx` — Loader2, Check
- `src/app/project/[id]/cad-editor/page.tsx` — db, observations
- `src/app/tools/as-built-deviation/page.tsx` — interpolateDesignElevation, t
- `src/app/tools/cassini-utm/useCassiniUtmState.ts` — srcUnit, tgtUnit
- `src/app/tools/civil-export/page.tsx` — useCallback, loading
- `src/app/tools/cogo-reconstruct/page.tsx` — dmsToAzimuth, t
- `src/app/tools/contour-generator/page.tsx` — generateContours, buildTINSurface
- `src/app/tools/control-point-verification/page.tsx` — ShieldCheck, AlertCircle
- `src/app/tools/corridor/page.tsx` — enToChainageOffset, formatChainage
- `src/app/tools/gnss/page.tsx` — ecefToGeodetic, utmToGeodetic
- `src/app/tools/missing-line/page.tsx` — calcError, setCalcError
- `src/app/tools/orthophoto-viewer/page.tsx` — MapPin, mapReady
- `src/app/tools/scale-factor/page.tsx` — useMemo, t
- `src/app/tools/setting-out/page.tsx` — Upload, FileSpreadsheet
- `src/app/tools/topology-check/page.tsx` — EMPTY_ROW, t
- `src/app/tools/two-peg-test/page.tsx` — calcError, setCalcError
- `src/components/admin/charts/AdminCharts.tsx` — Tooltip, ResponsiveContainer
- `src/components/automator/WorkflowCanvas.tsx` — useState, setNodes
- `src/components/beacons/BeaconRegistryPanel.tsx` — Ruler, setLocality
- `src/components/compute/ConstructionComputePanel.tsx` — setSettingOut, updateAsbuilt
- `src/components/compute/NetworkAdjustmentPanel.tsx` — pairFaces, obsRecords
- `src/components/CSVUploadModal.tsx` — err, idx
- `src/components/dashboard/QADashboard.tsx` — Download, projectId
- `src/components/drawing/CrossSection.tsx` — selectedStation, hScale
- `src/components/drawing/FormNo4Preview.tsx` — formatBearingDMS, formatDistanceM
- `src/components/engineering/DrainageDesignPanel.tsx` — roadLength, hasAnyError
- `src/components/engineering/panels/BridgePanel.tsx` — projectId, subtype
- `src/components/engineering/panels/PipelinePanel.tsx` — projectId, subtype
- `src/components/engineering/PavementDesignPanel.tsx` — roadClass, i
- `src/components/engineering/RoadCompletionCertificatePanel.tsx` — generateDefectSchedule, i
- `src/components/engineering/SlopeAnalysisPanel.tsx` — x, y
- `src/components/equipment/EquipmentManager.tsx` — setNotes
- `src/components/fieldbook/FieldBookMobile.tsx` — surveyType, surveyorId
- `src/components/gnss/GNSSObservationLogBuilder.tsx` — Upload, ANT_METHODS
- `src/components/registry/EquipmentTracker.tsx` — CalibrationRecord, ApiError
- `src/components/RegistryIndexMap.tsx` — t, setSubLocation
- `src/components/road-design/HorizontalCurveCalculator.tsx` — i, T
- `src/components/road-design/SightDistanceChecker.tsx` — getFrictionFactor, i
- `src/components/scheme/TraverseComputePanel.tsx` — useCallback, i
- `src/components/setting-out/ChainageOffsetTable.tsx` — cutFill, mode
- `src/components/shared/HotkeyHelpOverlay.tsx` — useEffect, useCallback
- `src/components/survey/ControlPointRegistry.tsx` — useMemo, KENCORS_STATIONS
- `src/components/survey/GCPOptimizerPanel.tsx` — Plus, GCPPoint
- `src/components/SurveyReport.tsx` — getAreaRule, rimData
- `src/components/ui/grid-feature-cards.tsx` — setPattern, index
- `src/components/ui/multi-type-ripple-buttons.tsx` — index
- `src/components/working-diagram/SubAreaPanel.tsx` — FILL_COLORS, idx
- `src/components/workspace/AutomationPanel.tsx` — useEffect, AutomationStep
- `src/components/workspace/SplitWorkspaceLayout.tsx` — Crosshair, idx
- `src/components/workspace/WorkspaceMap.tsx` — useProjectStore, activeTool
- `src/hooks/useHotkeys.ts` — ctrlMatch, metaMatch
- `src/hooks/useInstrumentConnection.ts` — setBytesReceived, setErrorCount
- `src/hooks/useWorkspaceBridge.tsx` — useProjectStore, uiSetSelectedFeatureId
- `src/lib/api-client/community.ts` — JobReview, PeerReviewer
- `src/lib/api/handler.ts` — NotFoundError, ConflictError
- `src/lib/computations/clothoidTransition.ts` — RAD, interval
- `src/lib/computations/settingOutEngine.ts` — angleDiff, VA
- `src/lib/compute/beaconDescriptionPdf.ts` — BLACK, tableH
- `src/lib/compute/beaconSymbols.ts` — isSet, regulation
- `src/lib/compute/deedPlanRenderer.ts` — utmZone, hemisphere
- `src/lib/compute/subdivisionGenerator.ts` — totalWidth, key
- `src/lib/engine/__tests__/knownAnswer.test.ts` — bearingToString, decimalToDMS
- `src/lib/engine/__tests__/sequentialAdjustment.test.ts` — removeObservations, result
- `src/lib/engine/__tests__/sparseMatrix.test.ts` — sparseForwardSolve, sparseBackwardSolve
- `src/lib/engineering/__tests__/progressMonitor.test.ts` — today, futureDate
- `src/lib/engineering/compute.ts` — e, minK
- `src/lib/engineering/exifPhoto.ts` — segLength, WGS84_B
- `src/lib/engineering/stakingTable.ts` — curveRad, perpRad
- `src/lib/generators/deedPlanGeometry.ts` — computeUTMPointScaleFactor, LineScaleFactorResult
- `src/lib/geo/geoidHeight.ts` — filePath, interpolateEGM2008
- `src/lib/importers/universalImporter.ts` — ParseResult, SupportedFormat
- `src/lib/integrations/webOdm.ts` — randomUUID, options
- `src/lib/map/cadastralEditing.ts` — cumulativeDistance, source
- `src/lib/map/gridOverlay.ts` — VectorSource, labelStyle
- `src/lib/marketplace/cpdCertificates.ts` — userId, certificateNumber
- `src/lib/monitoring/metrics.ts` — duration
- `src/lib/navigation.ts` — ClipboardCheck, Waves
- `src/lib/online/gnssBaseline.ts` — RINEX_CONSTANTS, format
- `src/lib/parsers/totalStation.ts` — pointCount, header
- `src/lib/pdf/generatePdf.ts` — orientation, index
- `src/lib/print/deedPlanPrint.ts` — i
- `src/lib/realtime/zustand-yjs-sync.ts` — Y, prevProject
- `src/lib/reports/coordinateConverter.ts` — err
- `src/lib/survey/__tests__/phase2StakeoutLoop.test.ts` — stakeoutPoints, linePoints
- `src/lib/survey/adapter/atmosphericDefaults.ts` — KENYA_CONDITIONS, KENYA_GEOID_UNDULATION
- `src/lib/survey/corrections/sea-level-reduction.ts` — WGS84_A, WGS84_E2
- `src/lib/survey/digitalLevel/benchmarkSheet.ts` — LevelObservation, orderInfo
- `src/lib/survey/instrumentWriters.ts` — SettingOutRow, i
- `src/lib/topo/breaklineTINRefinement.ts` — TIN, triangleVertexIndices
- `src/stores/uiStore.ts` — s
- `src/workers/WorkerBridge.ts` — WorkerResponseType, id

**Batch 11 — 1-warning tier: 261 files / 261 sites (the final no-unused-vars grind; all remaining work).**
Sub-batches by cluster (each is a reviewable commit; re-baseline `--update` after each):

- **11a — API routes (64 files):** mostly dead `req`/`ctx` handler args (`_`-prefix) and unused `NextRequest`/`NextResponse` imports; a few dead locals (e.g. `error`/`err` catch bindings → bare `catch {`).
- **11b — app pages + map components + hooks (53 files):** tool-page clusters (point-cloud-import, gcp-validation, contour-generator), unused lucide/react imports, dead locals/state.
- **11c — components (50 files):** shared/ui/workspace/engineering panels — dead imports, unused destructured props (`_`-alias), map-callback args.
- **11d — libs (94 files):** engine/parsers/compute/map/survey libs — dead imports, functions, consts, accumulators; type-only imports → `import type`.

Full 261-file worklist with per-site lines (regenerated live 2026-08-13, 501 → 261 after batch 10):
```
=== 1-warning tier: 261 files / 261 sites ===
src/app/account/billing/page.tsx
  L67 'user' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/account/page.tsx
  L27 'dbClient' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/admin/layout.tsx
  L4 'X' is defined but never used. Allowed unused vars must match /^_/u.
src/app/admin/payments/page.tsx
  L126 'session' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/analytics/page.tsx
  L182 'recentProjects' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/activity/route.ts
  L33 'ctx' is defined but never used. Allowed unused args must match /^_/u.
src/app/api/admin/audit/export/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/admin/audit/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/admin/licenses/[licenseId]/route.ts
  L9 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/admin/optimize/route.ts
  L8 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/admin/users/[userId]/role/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/analytics/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/audit-log/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/audit/[projectId]/route.ts
  L26 'NextResponse' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/auth/register-complete/route.ts
  L15 'req' is defined but never used. Allowed unused args must match /^_/u.
src/app/api/beacons/route.ts
  L66 'ctx' is defined but never used. Allowed unused args must match /^_/u.
src/app/api/boundary-monuments/route.ts
  L188 'geomSql' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/cleaned-datasets/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/compliance/route.ts
  L4 'ComplianceInput' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/compute/export/shapefile/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/compute/level-network/route.ts
  L12 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/compute/raster-analysis/route.ts
  L10 'session' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/compute/tin/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/coordinates/batch/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/coordinates/transform/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/db/migrations/route.ts
  L50 'appliedVersions' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/db/route.ts
  L17 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/deed-plan/generate/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/deformation/compare-epochs/route.ts
  L4 'DeformationTolerance' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/engineering/compute/earthworks/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/engineering/compute/horizontal-curve/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/engineering/compute/vertical-curve/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/engineering/vips/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/equipment/calibration/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/field-records/route.ts
  L62 'ctx' is defined but never used. Allowed unused args must match /^_/u.
src/app/api/fieldbook/audit/route.ts
  L4 'ValidationError' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/marketplace/inquiries/route.ts
  L8 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/marketplace/listings/[id]/route.ts
  L9 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/marketplace/listings/route.ts
  L8 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/nlims/lookup/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/payments/mpesa/initiate/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/payments/peer-review/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/payments/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/project/[id]/fieldbook/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/project/[id]/network-adjustment/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/projects/[id]/parcels/batch/route.ts
  L137 'parcelId' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/public/metrics/route.ts
  L24 'activeUsers' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/realtime/poll/route.ts
  L13 'ctx' is defined but never used. Allowed unused args must match /^_/u.
src/app/api/rim/overlap-check/route.ts
  L20 'NextResponse' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/rim/route.ts
  L11 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/__tests__/blocks.test.ts
  L143 'data' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/__tests__/parcels.test.ts
  L136 'data' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/assign/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/blocks/[id]/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/blocks/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/parcels/[id]/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/scheme/parcels/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/signature/sign-pdf/route.ts
  L14 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/storage/route.ts
  L12 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/submission/assemble/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/submission/form-c22/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/sync/route.ts
  L204 'error' is defined but never used.
src/app/api/topo/export/dxf/route.ts
  L68 'error' is defined but never used.
src/app/api/versions/route.ts
  L15 'VersionedEntityType' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/weather/edm-correction/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/white-label/route.ts
  L1 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/workers/[jobId]/route.ts
  L15 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/workers/job/route.ts
  L3 'NextRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/app/api/workspaces/route.ts
  L18 'WorkspaceId' is defined but never used. Allowed unused vars must match /^_/u.
src/app/beacons/page.tsx
  L78 'importMsg' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/digital-signature/page.tsx
  L15 'validationMsg' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/drone/page.tsx
  L6 'Download' is defined but never used. Allowed unused vars must match /^_/u.
src/app/enterprise/page.tsx
  L1 'Link' is defined but never used. Allowed unused vars must match /^_/u.
src/app/field/map/page.tsx
  L21 'Layers' is defined but never used. Allowed unused vars must match /^_/u.
src/app/fieldbook/useFieldbookComputations.ts
  L10 'ControlSetup' is defined but never used. Allowed unused vars must match /^_/u.
src/app/map/components/CogoInfoPanel.tsx
  L20 'X' is defined but never used. Allowed unused vars must match /^_/u.
src/app/map/components/NorthArrowOverlay.tsx
  L3 'useRef' is defined but never used. Allowed unused vars must match /^_/u.
src/app/map/components/SchemeLayerPanel.tsx
  L50 'showTraverseWorkflow' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/map/components/SnappingOptions.tsx
  L32 'SNAP_MODE_LABELS' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/online/page.tsx
  L9 'CoordinateTransformer' is defined but never used. Allowed unused vars must match /^_/u.
src/app/profile/page.tsx
  L36 'router' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/project/[id]/engineering/steps/DrainageStep3Outputs.tsx
  L42 'i' is defined but never used. Allowed unused args must match /^_/u.
src/app/project/[id]/engineering/steps/Step1Setup.tsx
  L17 'project' is defined but never used. Allowed unused args must match /^_/u.
src/app/project/[id]/ProjectWorkspaceClient.tsx
  L51 'workflowLoading' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/project/[id]/scheme/map/page.tsx
  L28 'Feature' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/contour-generator/generators.ts
  L12 'bounds' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/contour-generator/ImportTab.tsx
  L158 'i' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/deformation/page.tsx
  L2 'ToolExportButtons' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/drone/page.tsx
  L388 'idx' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/gcp-export/page.tsx
  L3 'useCallback' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/gcp-validation/helpers.ts
  L131 'utmZone' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/gcp-validation/page.tsx
  L29 'setKnownGCPs' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/gcp-validation/ReportTab.tsx
  L77 'i' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/gcp-validation/ResultsTab.tsx
  L148 'i' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/gnss-rinex/page.tsx
  L4 'Upload' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/lsa/page.tsx
  L40 't' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/orthometric-height/page.tsx
  L24 't' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/point-cloud-import/helpers.ts
  L109 'firstDataRowIdx' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/point-cloud-import/page.tsx
  L172 'firstDataRowIdx' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/point-cloud-import/StatisticsTab.tsx
  L29 'sortCol' is defined but never used. Allowed unused args must match /^_/u.
src/app/tools/point-cloud-import/VolumeTab.tsx
  L19 'tinToTinVolume' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/portfolio/page.tsx
  L41 'inputCls' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/road-design/page.tsx
  L3 'ToolExportButtons' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/rtk-corrections/page.tsx
  L12 'Zap' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/site-calibration/page.tsx
  L33 't' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/staking-table/page.tsx
  L4 'ToolExportButtons' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/superelevation/page.tsx
  L24 'setRoadClass' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/survey-report-builder/page.tsx
  L158 't' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/tacheometry/page.tsx
  L26 'setCalcError' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/tools/topographic-survey/page.tsx
  L4 'Mountain' is defined but never used. Allowed unused vars must match /^_/u.
src/app/tools/volume-comparison/page.tsx
  L22 'toSurfacePoints' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/app/topographic-workflow/page.tsx
  L26 'Loader2' is defined but never used. Allowed unused vars must match /^_/u.
src/app/working-diagram/page.tsx
  L2 'cookies' is defined but never used. Allowed unused vars must match /^_/u.
src/components/cogo/COGOCalculator.tsx
  L46 'i' is defined but never used. Allowed unused args must match /^_/u.
src/components/ComplianceChecklistModal.tsx
  L3 'useState' is defined but never used. Allowed unused vars must match /^_/u.
src/components/compute/MonitoringComputePanel.tsx
  L64 'setEpochs' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/earthworks/CrossSectionInput.tsx
  L4 'GroundShot' is defined but never used. Allowed unused vars must match /^_/u.
src/components/earthworks/MassHaulDiagram.tsx
  L64 'tickStep' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/engineering/AsBuiltSurveyPanel.tsx
  L21 'roadClass' is defined but never used. Allowed unused args must match /^_/u.
src/components/engineering/CrossSectionRenderer.tsx
  L316 'formationPolyline' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/engineering/HorizontalCurvePanel.tsx
  L93 'tb' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/engineering/RoadReservePanel.tsx
  L363 'compliancePercent' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/engineering/SuperelevationPanel.tsx
  L99 'tb' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/FeedbackWidget.tsx
  L10 'drainStoredErrors' is defined but never used. Allowed unused vars must match /^_/u.
src/components/field/FieldConnectionBar.tsx
  L17 'Battery' is defined but never used. Allowed unused vars must match /^_/u.
src/components/fieldbook/InstantClosureFeedback.tsx
  L48 't' is defined but never used. Allowed unused args must match /^_/u.
src/components/fieldbook/MobileFieldbookShell.tsx
  L23 'useHaptics' is defined but never used. Allowed unused vars must match /^_/u.
src/components/fieldbook/WeatherPanel.tsx
  L34 't' is defined but never used. Allowed unused args must match /^_/u.
src/components/geo/CoordinateTransformer.tsx
  L114 'i' is defined but never used. Allowed unused args must match /^_/u.
src/components/landlaw/DisputeGuide.tsx
  L6 'DisputeProcedure' is defined but never used. Allowed unused vars must match /^_/u.
src/components/layout/AppSidebar.tsx
  L9 'Activity' is defined but never used. Allowed unused vars must match /^_/u.
src/components/LevelBook.tsx
  L12 'projectId' is defined but never used. Allowed unused args must match /^_/u.
src/components/map/MeasurementTool.tsx
  L22 'hoverTool' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/map/PremiumIcons.tsx
  L176 'fill' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/map/StakeoutPanel.tsx
  L24 'gpsPos21037' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/metardu/Header.tsx
  L19 'scrolled' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/MetarduLogo.tsx
  L1 'Link' is defined but never used. Allowed unused vars must match /^_/u.
src/components/onboarding/NewSurveyorGuide.tsx
  L18 'FileText' is defined but never used. Allowed unused vars must match /^_/u.
src/components/onboarding/OnboardingTour.tsx
  L118 'handleClose' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/ParcelBuilderModal.tsx
  L42 'onDraftBoundaryChange' is defined but never used. Allowed unused args must match /^_/u.
src/components/parcels/BatchParcelImport.tsx
  L14 'processWithProgress' is defined but never used. Allowed unused vars must match /^_/u.
src/components/realtime/CollaborationPanel.tsx
  L17 'X' is defined but never used. Allowed unused vars must match /^_/u.
src/components/scheme/CsvImportPanel.tsx
  L5 'X' is defined but never used. Allowed unused vars must match /^_/u.
src/components/setting-out/SettingOutTable.tsx
  L59 'i' is defined but never used. Allowed unused args must match /^_/u.
src/components/shared/Accessibility.tsx
  L16 'useCallback' is defined but never used. Allowed unused vars must match /^_/u.
src/components/shared/ConnectivityIndicator.tsx
  L4 'WifiOff' is defined but never used. Allowed unused vars must match /^_/u.
src/components/shared/ParcelNumberInput.tsx
  L11 'RegistrationSection' is defined but never used. Allowed unused vars must match /^_/u.
src/components/shared/VirtualizedTable.tsx
  L199 'rowKey' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/submission/NLIMSExportPanel.tsx
  L27 'projectId' is defined but never used. Allowed unused args must match /^_/u.
src/components/SurveyPlanViewer.tsx
  L9 'Globe' is defined but never used. Allowed unused vars must match /^_/u.
src/components/tools/ProcessingToolbox.tsx
  L21 'Waves' is defined but never used. Allowed unused vars must match /^_/u.
src/components/tools/SpiralAlignmentTab.tsx
  L16 'PageHeader' is defined but never used. Allowed unused vars must match /^_/u.
src/components/topo/OrthophotoOverlay.tsx
  L19 'useCallback' is defined but never used. Allowed unused vars must match /^_/u.
src/components/ui/MotionComponents.tsx
  L14 'staggerContainer' is defined but never used. Allowed unused vars must match /^_/u.
src/components/ui/slider.tsx
  L52 'index' is defined but never used. Allowed unused args must match /^_/u.
src/components/UploadZone.tsx
  L107 'getFileIcon' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/version/VersionDiffViewer.tsx
  L169 'i' is defined but never used. Allowed unused args must match /^_/u.
src/components/visualization/TIN3DViewer.tsx
  L83 'rangeZ' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/workspace/CadastralComputeIntegration.tsx
  L12 'rows' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/components/workspace/ComputationLog.tsx
  L8 'Activity' is defined but never used. Allowed unused vars must match /^_/u.
src/components/workspace/DynamicFieldBook.tsx
  L3 'useEffect' is defined but never used. Allowed unused vars must match /^_/u.
src/components/workspace/LongitudinalSection.tsx
  L16 'projectId' is defined but never used. Allowed unused args must match /^_/u.
src/components/workspace/WorkflowStepPanel.tsx
  L10 'getActiveSurveyorProfile' is defined but never used. Allowed unused vars must match /^_/u.
src/hooks/api/fetcher.ts
  L25 'url' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/hooks/use-toast.ts
  L21 'actionTypes' is assigned a value but only used as a type. Allowed unused vars must match /^_/u.
src/hooks/useMeasurement.ts
  L88 'type' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/hooks/useUndoRedo.ts
  L24 'useRef' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/ai/smartAiService.ts
  L10 'LocalChatOptions' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/api-client/safetyIncidents.ts
  L2 'SafetyReport' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/api/__tests__/client.selfcheck.ts
  L13 'Project' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/api/ai-client.ts
  L78 'errorText' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/audit/__tests__/auditLog.test.ts
  L20 'canonicalJSON' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/auth.ts
  L1 'NextAuth' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/cache/redis.ts
  L34 'error' is defined but never used.
src/lib/compute/crossSectionPdf.ts
  L355 'contHeaderY' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/compute/edmCorrection.ts
  L10 'wavelength' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/compute/reportCompleteness.ts
  L11 'sections' is defined but never used. Allowed unused args must match /^_/u.
src/lib/compute/surveyReportSections.ts
  L344 'input' is defined but never used. Allowed unused args must match /^_/u.
src/lib/compute/workflowEngine.ts
  L1 'ReportRequest' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/country/standards.ts
  L328 'KETRACO_STD' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/data/disputeProcedures.ts
  L1 'DisputeStage' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/documents/deed-plan/symbology.ts
  L187 'angle' is assigned a value but never used. Allowed unused args must match /^_/u.
src/lib/documents/sokStandards.ts
  L199 'quadrant' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/documents/templates/deed-plan.ts
  L333 'mmToPt' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/email-templates/projectShared.ts
  L11 'RichParagraph' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/engine/__tests__/leastSquares3d.test.ts
  L1 'Observation' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/engine/cogo.ts
  L12 'toDegrees' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/engine/deformationTracker.ts
  L369 'alpha' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engine/leveling-standards.ts
  L273 'country' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engine/parser.ts
  L19 'hasHeader' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engine/solution/wrappers/coordinates.ts
  L134 'decimal' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engineering/__tests__/asBuiltSurvey.test.ts
  L60 'n' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engineering/__tests__/pileGrid.test.ts
  L129 'pile' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engineering/curves.ts
  L71 'arc' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/engineering/p2Modules.ts
  L44 'roadWidth' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/enterprise/governmentLicensing.ts
  L229 'seatId' is defined but never used. Allowed unused args must match /^_/u.
src/lib/export/machineControl.ts
  L22 'SpotHeight' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/export/topoDXF.ts
  L14 'DXF_LAYERS' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/field/export.ts
  L1 'FieldExportOptions' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/field/fieldSession.ts
  L11 'checkTolerance' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/generators/boundaryShapefile.ts
  L23 'i' is defined but never used. Allowed unused args must match /^_/u.
src/lib/generators/formC22.ts
  L187 'input' is defined but never used. Allowed unused args must match /^_/u.
src/lib/geo/cassini/projection.ts
  L220 'R1' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/geo/national_sheets.ts
  L19 'estimateSheetAccuracy' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/geodesy/coordinates.ts
  L15 'DMS' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/geodesy/geodesicArea.ts
  L20 'Geometry' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/geodesy/scaleFactor.ts
  L30 'EARTH_RADIUS_M' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/gnss/__tests__/ntrip-client.test.ts
  L134 'key' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/gnss/capacitor-ble.ts
  L22 'GNSSDevice' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/graph/__tests__/entityGraph.test.ts
  L17 'EntityGraph' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/import/totalStation/__tests__/parseTopcon.test.ts
  L7 'TopconRecord' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/import/totalStation/__tests__/unifiedImport.test.ts
  L84 'UNKNOWN_CSV_SAMPLE' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/import/totalStation/parseGSI.ts
  L362 'collimation' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/import/totalStation/parseJobXML.ts
  L60 'err' is defined but never used.
src/lib/importers/parsers/las.ts
  L115 'intensity' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/importers/parsers/south.ts
  L37 'coordLineMatch' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/integrations/digitalSignature.ts
  L8 'dec' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/legal/claForms/claForm2.ts
  L349 'wColWidths' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/map/__tests__/vectorTileFactory.test.ts
  L162 'tileSize1' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/map/editingTools.ts
  L17 'MultiPolygon' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/map/enhancedStyles.ts
  L21 'Icon' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/map/schemeLayer.ts
  L663 'layer' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/marketplace/apiClient.ts
  L8 'Currency' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/monitoring/logger.ts
  L127 'userId' is defined but never used. Allowed unused args must match /^_/u.
src/lib/monitoring/middleware-tracker.ts
  L111 'index' is defined but never used. Allowed unused args must match /^_/u.
src/lib/monitoring/tracing.ts
  L221 'setUser' is defined but never used. Allowed unused args must match /^_/u.
src/lib/offline/db.ts
  L139 'newVersion' is defined but never used. Allowed unused args must match /^_/u.
src/lib/offline/sync-manager.ts
  L51 'BASE_RETRY_DELAY_MS' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/offline/tileCache.ts
  L18 'TILE_SIZE' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/online/weather.ts
  L87 'tempK' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/parsers/csvSurveyInterpreter.ts
  L72 'err' is defined but never used.
src/lib/parsers/parse3D.ts
  L1 'ExtractedAnnotation' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/parsers/surveyDetector.ts
  L5 'rows' is defined but never used. Allowed unused args must match /^_/u.
src/lib/plan/contourRenderer.ts
  L17 'ContourLine' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/plan/topographicPlanRenderer.ts
  L24 'SurveySymbol' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/print/earthworksBoQ.ts
  L288 'i' is defined but never used. Allowed unused args must match /^_/u.
src/lib/print/gnssObservationLog.ts
  L124 'fmtDate' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/reports/__tests__/traverseAccuracy.test.ts
  L1 'getAccuracyBadgeLabel' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/reports/documentPackage.ts
  L545 'today' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/submission/assembleSubmission.ts
  L377 'i' is defined but never used. Allowed unused args must match /^_/u.
src/lib/submission/generators/formNo4PDF.ts
  L3 'PlanGeometry' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/submission/generators/mutationForm.ts
  L106 'i' is defined but never used. Allowed unused args must match /^_/u.
src/lib/submission/pre-submit-check.ts
  L308 'points' is defined but never used. Allowed unused args must match /^_/u.
src/lib/submission/validateSubmission.ts
  L10 'LEVELLING_TOLERANCE' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/survey/__tests__/liveToleranceChecker.test.ts
  L39 'misclosureMm' is assigned a value but never used. Allowed unused args must match /^_/u.
src/lib/survey/asBuiltComparison.ts
  L292 'naColor' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/survey/corrections/atmospheric.ts
  L240 'vaporPressure' is defined but never used. Allowed unused args must match /^_/u.
src/lib/survey/corrections/grid-scale-factor.ts
  L371 'R' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/survey/curves/circular.ts
  L119 'pcDeflection' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/survey/liveToleranceChecker.ts
  L56 'RDM_LEVELING_ACCURACY' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/survey/realTimeQC.ts
  L23 'Point2D' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/survey/robustEstimation.ts
  L346 'numComponents' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/survey/totalLeastSquares.ts
  L213 'i' is defined but never used. Allowed unused args must match /^_/u.
src/lib/survey/traverse/least-squares.ts
  L572 'confidence' is assigned a value but never used. Allowed unused args must match /^_/u.
src/lib/topo/crossSectionFromDTM.ts
  L21 'TINSurface' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/topo/featureCodeAutomation.ts
  L34 'FeatureCategory' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/topo/idwEngine.ts
  L58 'onProgress' is defined but never used. Allowed unused args must match /^_/u.
src/lib/topo/realTimeContours.ts
  L24 'generateTINWithBreaklines' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/validation/__tests__/surveySchema.test.ts
  L1 'SurveyPlanDataSchema' is defined but never used. Allowed unused vars must match /^_/u.
src/lib/validation/apiSchemas.ts
  L13 'UTM_ZONES' is assigned a value but never used. Allowed unused vars must match /^_/u.
src/lib/validation/toleranceEngine.ts
  L132 'linearPrecision' is assigned a value but never used. Allowed unused vars must match /^_/u.
```
