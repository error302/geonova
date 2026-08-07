# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning in the repo so the CI `--max-warnings` ceiling can drop to `0` (and then rules flip to `error`).

**Progress:** 14,030 → **7,435** (measured 2026-08-07, `lint-ratchets --report` + family scans).

## Current state (2026-08-07)

Live counts from `scripts/warning-baseline.json` (re-baselined to the working tree on the latest grind batches). The **CI floor** column is the decoupled per-family ceiling enforced by `lint-ratchets.mjs` — it only moves via its own `--update-<family>` flag, so whole-repo re-baselining can't absorb growth in those families.

| Rule | Live | CI floor | Fix class |
|---|---|---|---|
| `no-unsafe-member-access` | 2,115 | **2,328** | db rows / helpers / fetch |
| `no-unsafe-assignment` | 1,178 | **1,327** | same roots as above |
| `no-unused-vars` | 1,167 | — | mechanical (`_`-prefix, drop imports) |
| `no-explicit-any` | 818 | **1,014** | `: any` → `unknown`+narrow / precise type |
| `no-unsafe-call` | 497 | — | constructing/calling `any` |
| `no-console` | 393 | — | structured logging / remove debug |
| `no-unsafe-argument` | 381 | — | typed callers of `any` params |
| `no-non-null-assertion` | 572 | — | replace `!` with real narrowing |
| `no-unsafe-return` | 224 | — | return `any` → typed |
| `react-hooks/exhaustive-deps` | 74 | — | per-file careful dep fixes |
| `no-restricted-syntax` | 16 | — | project-specific banned patterns |
| **Total** | **7,435** | | |

**Distribution (live):** 386 files carry member-access, 417 assignment, 208 argument, 295 explicit-any, 137 unsafe-call, 529 unused-vars, 103 unsafe-return.

## CI-enforced floors (decoupled)

| Family | Floor | Baseline file | Re-baseline history (most recent last) |
|---|---|---|---|
| `no-unsafe-member-access` | **2,328** | `scripts/member-access-baseline.json` | 2786 → 2733 → 2725 → 2714 → 2625 → **2328** |
| `no-unsafe-assignment` | **1,327** | `scripts/assignment-baseline.json` | 1715 → 1519 → 1511 → 1452 → 1445 → **1327** |
| `no-explicit-any` | **1,014** | `scripts/explicit-any-baseline.json` | — |

Each floor is a **ceiling**: CI fails if the live count exceeds it, so it must always stay ≥ live after a grind. Move a floor down *only* when the live count drops below it, via `node scripts/lint-ratchets.mjs --update-member-access` / `--update-assignment` / `--update-explicit-any` (or the combined `--update`). The changed-files gate (`scripts/lint-gate.mjs --paths-from-changed <base>`) enforces all three floors on PRs too, so a PR that *adds* these warnings fails fast (~30s) before the whole-repo ratchet runs.

## Remaining per-family ranked file lists (2026-08-07)

Regenerated with a single whole-repo ESLint pass (same scope as `lint-ratchets.mjs`: `middleware.ts + src/**`). `scripts/member-scan.mjs`, `scripts/assignment-scan.mjs`, `scripts/argument-scan.mjs` reproduce these on demand (add `--top N` / `--batch N` for a per-line worklist).

### `no-unsafe-member-access` — 2,115 across 386 files (top 25)

| Count | File |
|---|---|
| 36 | `src/components/fieldbook/FieldbookQuickActions.tsx` |
| 32 | `src/components/fieldbook/MobileFieldbookShell.tsx` |
| 28 | `src/lib/importers/parsers/rinex.ts` |
| 25 | `src/lib/export/generateShapefile.ts` |
| 24 | `src/lib/marketplace/index.ts` |
| 23 | `src/components/ProjectCard.tsx` |
| 23 | `src/components/surveyreport/SurveyReportBuilder.tsx` |
| 23 | `src/lib/compute/surveyReportSections.ts` |
| 22 | `src/lib/export/civilHandoff.ts` |
| 20 | `src/components/setting-out/SettingOutCalculator.tsx` |
| 19 | `src/app/field/map/page.tsx` |
| 19 | `src/lib/parsers/parseDXF.ts` |
| 18 | `src/app/project/[id]/cad-editor/page.tsx` |
| 18 | `src/lib/marketplace/jobMarketplace.ts` |
| 18 | `src/lib/print/levelBookPrint.ts` |
| 17 | `src/app/process/page.tsx` |
| 17 | `src/components/ParcelBuilderModal.tsx` |
| 16 | `src/app/import/page.tsx` · `src/app/project/[id]/scheme/page.tsx` · `src/app/tools/topographic-survey/page.tsx` · `src/components/traverse/TraverseDiagram.tsx` · `src/components/workspace/CadastralComputeIntegration.tsx` · `src/lib/instruments/gnssBleConnection.ts` · `src/lib/marketplace/cpdCertificates.ts` · `src/lib/online/benchmarks.ts` |
| 15 | `src/app/tools/gcp-validation/useGCPValidation.ts` · `src/app/tools/staking-table/page.tsx` · `src/components/LevelBook.tsx` · `src/lib/integrations/nigeria.ts` · `src/lib/integrations/southAfrica.ts` |

### `no-unsafe-assignment` — 1,178 across 417 files (top 20)

| Count | File |
|---|---|
| 13 | `src/lib/export/generateShapefile.ts` |
| 12 | `src/app/project/[id]/cad-editor/page.tsx` |
| 11 | `src/app/import/page.tsx` · `src/components/survey/GNSSRoverConnection.tsx` · `src/lib/map/__tests__/deedPlanExport.test.ts` |
| 10 | `src/lib/api-client/parcelVault.ts` |
| 9 | `src/app/api/scheme/__tests__/blocks.test.ts` · `src/components/fieldbook/MobileFieldbookShell.tsx` · `src/components/traverse/TraverseDiagram.tsx` · `src/lib/field/fieldSession.ts` · `src/lib/parsers/parsePDF.ts` · `src/lib/payments/paypal.ts` |
| 8 | `src/app/analytics/page.tsx` · `src/app/field/map/page.tsx` · `src/app/profile/page.tsx` · `src/app/tools/gcp-validation/useGCPValidation.ts` · `src/components/CSVUploadModal.tsx` · `src/components/ProjectCard.tsx` · `src/components/tools/ProcessingToolbox.tsx` · `src/components/workspace/CadastralComputeIntegration.tsx` · `src/hooks/useFieldBook.ts` · `src/lib/engine/sparseMatrix.ts` · `src/lib/instruments/gnssBleConnection.ts` · `src/lib/map/__tests__/vectorTileFactory.test.ts` |
| 7 | `src/app/api/coordinates/transform/route.ts` · `src/app/api/scheme/__tests__/parcels.test.ts` · `src/app/pricing/page.tsx` · `src/app/process/page.tsx` · `src/app/project/[id]/profiles/page.tsx` · `src/app/tools/topographic-survey/page.tsx` |

### `no-unsafe-argument` — 381 across 208 files (top 15)

| Count | File |
|---|---|
| 5 | `src/app/fieldbook/page.tsx` |
| 4 | `src/app/community/page.tsx` · `src/app/profile/page.tsx` · `src/app/project/[id]/cad-editor/page.tsx` · `src/app/tools/chainage/page.tsx` · `src/components/documents/LogoUpload.tsx` · `src/components/equipment/EquipmentManager.tsx` · `src/components/map/SurveyMap.tsx` · `src/components/shared/VersionHistoryPanel.tsx` · `src/components/submission/NLIMSExportPanel.tsx` · `src/components/surveyreport/SurveyReportBuilder.tsx` · `src/components/workspace/DynamicFieldBook.tsx` · `src/lib/community.ts` · `src/lib/engine/levelNetworkAdjust.ts` · `src/lib/engine/__tests__/topographic.test.ts` · `src/lib/export/generateDXF.ts` · `src/lib/geo/epochManager.ts` · `src/lib/integrations/kencors.ts` · `src/lib/parsers/csvSurveyInterpreter.ts` · `src/lib/plan/topographicPlanRenderer.ts` · `src/lib/rim/overlapDetection.ts` |
| 3 | `src/app/api/ardhisasa/route.ts` · `src/app/api/public/metrics/route.ts` · `src/app/cpd/page.tsx` · `src/app/field/map/page.tsx` · `src/app/import/page.tsx` · `src/app/pricing/page.tsx` · `src/app/process/page.tsx` · `src/components/ProjectCard.tsx` · `src/components/realtime/ProjectPresencePanel.tsx` |

### `no-explicit-any` — 818 across 295 files (top 15)

| Count | File |
|---|---|
| 19 | `src/lib/map/__tests__/vectorTileFactory.test.ts` |
| 17 | `src/lib/map/__tests__/deedPlanExport.test.ts` |
| 12 | `src/components/surveyreport/SurveyReportBuilder.tsx` · `src/lib/marketplace/jobMarketplace.ts` |
| 11 | `src/components/map/LayerControl.tsx` · `src/lib/api-client/parcelVault.ts` · `src/lib/marketplace/index.ts` |
| 10 | `src/components/ParcelBuilderModal.tsx` · `src/lib/parcel/parcelValidation.ts` |
| 9 | `src/components/fieldbook/MobileFieldbookShell.tsx` · `src/lib/compute/surveyReportSections.ts` · `src/lib/engine/leveling-standards.ts` · `src/lib/enterprise/governmentLicensing.ts` |
| 8 | `src/app/import/page.tsx` · `src/lib/map/vectorTileFactory.ts` · `src/lib/online/benchmarks.ts` · `src/lib/serial/InstrumentSerialConnection.ts` |

### `no-unsafe-call` — 497 across 137 files (top 15)

| Count | File |
|---|---|
| 19 | `src/lib/marketplace/index.ts` |
| 14 | `src/lib/integrations/nigeria.ts` · `src/lib/integrations/southAfrica.ts` |
| 13 | `src/lib/instruments/gnssBleConnection.ts` |
| 12 | `src/components/setting-out/SettingOutCalculator.tsx` · `src/lib/export/civilHandoff.ts` · `src/lib/integrations/ghana.ts` · `src/lib/marketplace/cpdCertificates.ts` |
| 11 | `src/components/map/LayerControl.tsx` |
| 10 | `src/app/tools/staking-table/page.tsx` |
| 9 | `src/app/(dashboard)/survey/[id]/compute/page.tsx` · `src/lib/import/totalStation/parseJobXML.ts` · `src/lib/instruments/totalStationSerial.ts` · `src/lib/marketplace/jobMarketplace.ts` · `src/lib/security/errors.ts` |

### `no-unused-vars` — 1,167 across 529 files (top 15)

| Count | File |
|---|---|
| 18 | `src/components/TraverseFieldBook.tsx` |
| 14 | `src/lib/engine/sequentialAdjustment.ts` |
| 13 | `src/app/mobile/field/page.tsx` |
| 11 | `src/components/topo/TopoDrawingComposer.tsx` |
| 10 | `src/app/tools/page.tsx` · `src/lib/export/cadastralPlanDXF.ts` |
| 9 | `src/app/project/[id]/scheme/page.tsx` · `src/lib/orchestrator/develop-full-plan.ts` · `src/lib/reports/surveyPlan/formNo3Renderer.ts` |
| 8 | `src/components/engineering/panels/RailwayPanel.tsx` · `src/components/engineering/panels/RoadPanel.tsx` · `src/components/gnss/GNSSConnectionPanel.tsx` · `src/components/report-editor/ReportTemplateEditor.tsx` · `src/components/subdivision/SubdivisionPanel.tsx` · `src/lib/documents/deed-plan/generator.ts` · `src/lib/integrations/international.ts` · `src/lib/parsers/stubs.ts` |

### `no-unsafe-return` — 224 across 103 files (top 15)

| Count | File |
|---|---|
| 9 | `src/lib/engine/levelNetworkAdjust.ts` |
| 7 | `src/components/fieldbook/MobileFieldbookShell.tsx` · `src/lib/engine/sparseMatrix.ts` · `src/lib/geodesy/gnss.ts` |
| 6 | `src/lib/survey/digitalLevel/levelNetworkAdjustment.ts` · `src/lib/survey/totalLeastSquares.ts` |
| 5 | `src/lib/db/optimization.ts` · `src/lib/db/queries/projects.ts` · `src/lib/survey/covariancePropagation.ts` |
| 4 | `src/lib/integrations/kencors.ts` · `src/lib/marketplace/jobMarketplace.ts` · `src/lib/offline/fieldBookDB.ts` · `src/lib/plan/topographicPlanRenderer.ts` · `src/lib/reports/solutionToPdf.ts` · `src/lib/schedule/schedule.ts` · `src/lib/survey/networkAdjustment.ts` |

## Root causes (why ~80% of the remainder is the `no-unsafe-*` family)

1. **`db.query()` returns `QueryResult<any>`** — `src/lib/db.ts`. Typed with the generic `query<T>()` + per-file row interfaces across the API routes (Option-B recipe); remaining sites are the lower-priority routes and lib/db helpers.
2. **Helper signatures typed `: any`** (`doc: any`, `ctx: any`, `obs: any`, `pt: any`) — proven recipe: real jsPDF / canvas / OL / row types.
3. **`.map((r: any) => …)` / `.forEach((f: any) => …)` callbacks** — usually the same rows as (1) or object props.
4. **`fetch(...).json()` untyped** — `await res.json()` is `any`; cast to declared/added interfaces.
5. **`JSON.parse` returns `any`** — assert the stored shape.
6. **OL objects through `any` refs/states** — `useRef<any>`, `useState<any>` (largely cleared in the map cluster; the remaining OL weight is in fieldbook/tools pages).

## The recipe (per file)

Type the *source* once, never widen to `any`:

- `db.query<RowIface>(...)` — row interfaces already exist in most route files
- `doc: any` → `doc: jsPDF`, `ctx: any` → `CanvasRenderingContext2D`, etc.
- `const json = (await res.json()) as { data?: Row[]; ... }`
- `const parsed = JSON.parse(x) as Shape`
- `useRef<RealType>` / `useState<RealType>`; drop redundant `: any` annotations
- unused vars: `_`-prefix or remove the import/binding

## Batch roadmap — status

The original B1–B5 roadmap (generic `db.query<T>()`, engine libs, mobile/sync, map+fieldbook, tools+project pages) has **largely landed**: totals dropped 14,030 → 7,435 and the member floor fell 5,066-era → 2,328. Remaining work is tracked by the per-family ranked lists above — run `member-scan` / `assignment-scan` / `argument-scan` `--batch N` at the start of each session for a precise per-line worklist.

## Rules of engagement (every batch)

1. tsc `--noEmit` clean before lint.
2. Per-file eslint → target rules at 0 for the batch files.
3. `lint-ratchets --update-member-access` / `--update-assignment` / `--update-explicit-any` (whichever family moved) + `--update`; gate green.
4. Run related jest suites (paths touched); fix regressions.
5. Commit per batch with the floor drop in the message (floor + total).
6. `--report` after each commit to confirm only intended families moved.

## Tooling

- `scripts/member-scan.mjs` — member-access family scanner (`--top` / `--out` / `--batch N` per-line worklists)
- `scripts/assignment-scan.mjs` — assignment family scanner (same interface)
- `scripts/argument-scan.mjs` — argument family scanner (same interface)
- `scripts/warn-scan.mjs` — regenerates the per-file census (`scripts/warn-plan-data.json`)
- `scripts/lint-ratchets.mjs` — baseline ratchet + `--report` drift table + decoupled family floors
- `scripts/lint-gate.mjs --paths-from-changed` — fast PR changed-files gate (all three floors)
- `scripts/api-row-sweep.mjs` — API-route db.query<T> census (`--check` CI gate, `--apply` codegen, `--verify` tsc loop)
