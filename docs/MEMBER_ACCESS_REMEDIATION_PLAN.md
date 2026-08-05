# Member-Access Remediation Plan

Ranked plan for driving `@typescript-eslint/no-unsafe-member-access` toward zero.
Baseline: **5,066 warnings across 541 files** (whole-repo, ESLint Node API, `middleware.ts + src/**` — same scope as `lint-ratchets.mjs`). Dedicated floor gate: `scripts/member-access-baseline.json`, re-baselined only via `node scripts/lint-ratchets.mjs --update-member-access`.

The fast changed-files gate (`scripts/lint-gate.mjs`) now also fails PRs that *add* member-access in touched files, so this grind is regression-protected on every push.

---

## 1. Dominant any-sources (whole family)

| Source pattern | Warnings | Share | Typical shape | Fix recipe |
|---|---|---|---|---|
| `.map((r: any) => …)` / `.map((x: any) …)` callbacks | 1,923 | 38% | `result.rows.map((r: any) => r.name)` | Type the callback param with the row interface (often already declared nearby), or type the source array. |
| Untyped db query results | ~1,000 (in "other") | ~20% | `project.name`, `row.name`, `rows[0].x` from `db.query()` | Cast rows to the declared row interface (Batch-1 recipe: `projectRows[0] as ProjectRow`, `rows as SurveyPointRow[]`). |
| `: any` params / `as any` casts | 262 | 5% | `function obsLabel(obs: any)`, `const pt: any = {…}` | Replace with the real type or a structural interface. |
| Fetch/axios/JSON bodies | 286 | 6% | `res.data.x`, `json.items` | `z.infer` on the response schema, or a response interface. |
| Event handlers | 140 | 3% | `e.target.x`, `evt.value` | `React.ChangeEvent<…>` / `MouseEvent<…>` typing. |
| OpenLayers objects | 96 | 2% | `feature.get…`, `layer.x`, `source.y` | OL 10 real types (`Feature<Geometry>`, `VectorLayer<VectorSource>`). |
| React refs | 46 | 1% | `ref.current.x` | `useRef<Type>(null)` / `MutableRefObject<Type>`. |
| Mixed/other (object literals, `data.`, `value.`) | ~1,300 (in "other") | ~25% | `data.coords`, `item.props` | Per-file: type the literal or narrow with a guard. |

> The single highest-leverage change: **type the `db.query()` result rows** (either via the Batch-1 per-file-interface recipe, or the generic `query<T>()` in `lib/db.ts` proposed in the Supabase investigation). That alone collapses the two biggest buckets (any-callback + db rows ≈ 60%).

## 2. Ranked batches (~500 warnings each, by density)

Order = warning count, then shared-recipe grouping. Each batch ends with
`node scripts/lint-ratchets.mjs --update-member-access` + `--update`, then `--report` to confirm the floor dropped.

### Batch 1 — 539 warnings, 9 files (engine + exports + high-traffic tools)
| File | W | Dominant source |
|---|---|---|
| `src/lib/engine/leastSquares.ts` | 76 | `pt: any`, `obs: any` params → structural point/observation interfaces |
| `src/app/api/sign-plan/route.ts` | 75 | `project.` from untyped `db.query` rows → `ProjectRow` cast |
| `src/app/tools/leveling/page.tsx` | 63 | `readings.map((r: any))` → `LevelReading` interface |
| `src/lib/mobile/syncService.ts` | 60 | fetch/queue payloads → `SyncPayload` types |
| `src/components/working-diagram/WorkingDiagramClient.tsx` | 57 | `.map((r: any))` → diagram row type |
| `src/app/project/[id]/documents/page.tsx` | 55 | `.map((r: any))` + rows → document row types |
| `src/lib/submission/assembleDocument.ts` | 54 | `.map((r: any))` → submission row type |
| `src/app/tools/gis-export/page.tsx` | 50 | `.map((r: any))` → point/feature row type |
| `src/lib/export/exportProject.ts` | 49 | `.map((r: any))` → project export rows |

### Batch 2 — 504 warnings, 12 files (map utils, auth, engine, integrations)
`turfHelpers.ts` 48 · `project/[id]/engineering/page.tsx` 47 · `cadastralStyles.test.ts` 47 · `lib/db/admin.ts` 44 · `tools/gnss/page.tsx` 43 · `map/utils/coordSearch.ts` 41 · `lib/auth.ts` 41 · `engine/traverseToLSQ.ts` 40 · `integrations/ardhisasaClient.ts` 39 (fetch) · `api/scheme/forms/route.ts` 38 · `tools/portfolio/page.tsx` 38 · `workspace/WorkspaceMap.tsx` 38 (ol)

### Batch 3 — 484 warnings, 14 files (webhooks, compute, field, registry)
`api/webhooks/stripe/route.ts` 37 (fetch) · `api/scheme/export/geojson/route.ts` 36 · `tools/orthophoto-viewer/page.tsx` 36 · `tools/regulatory-checklist/page.tsx` 36 · `fieldbook/FieldbookQuickActions.tsx` 36 · `tools/civil-export/page.tsx` 35 · `RegistryIndexMap.tsx` 35 · `api/survey-report/generate/route.ts` 34 · `field/MapViewer.tsx` 34 (ol) · `parcels/BatchParcelImport.tsx` 34 · `api/admin/dashboard/route.ts` 33 (db) · `api/search/route.ts` 33 · `submission/assembleSubmission.ts` 33 · `tools/drone/page.tsx` 32

### Batch 4 — 401 warnings, 14 files (fieldbook, scheme, generators)
`fieldbook/MobileFieldbookShell.tsx` 32 · `api/project/[id]/workflow/route.ts` 30 (db) · `api/scheme/submission/readiness/route.ts` 30 · `api/scheme/team/route.ts` 30 · `api/webhooks/paypal/route.ts` 30 (fetch) · `tools/gcp-export/page.tsx` 30 · `api/scheme/map/route.ts` 29 (db) · `api/submission/preview/route.ts` 29 · `lib/generators/deedPlan.ts` 28 (doc) · `importers/parsers/rinex.ts` 28 · `map/components/OsmBuildingsLayer.tsx` 27 (ol) · `api/compute/export/geojson/route.ts` 26 · `api/scheme/batch/route.ts` 26 · `lib/marketplace/peerReview.ts` 26

### Batch 5 — 320 warnings, 14 files (tools, exports, marketplace)
`tools/control-point-verification/page.tsx` 25 · `lib/export/generateShapefile.ts` 25 · `project/[id]/contours/page.tsx` 24 · `lib/marketplace/index.ts` 24 · `lib/print/droneReportPrint.ts` 24 (doc) · `ProjectCard.tsx` 23 · `surveyreport/SurveyReportBuilder.tsx` 23 (doc) · `lib/compute/surveyReportSections.ts` 23 · `project/[id]/map/page.tsx` 22 · `lib/export/civilHandoff.ts` 22 · `lib/payments/stripe.ts` 22 (fetch) · `project/[id]/settings/page.tsx` 21 · `rim/useRimState.ts` 21 · `TraverseFieldBook.tsx` 21

### Batch 6 — 263 warnings, 14 files (api routes, fieldbook, hooks)
`api/spatial-index/route.ts` 20 (db) · `setting-out/SettingOutCalculator.tsx` 20 · `traverseLayer.test.ts` 20 · `api/drone/process/route.ts` 19 · `api/scheme/forms/form-no-4/route.ts` 19 · `api/scheme/rim/route.ts` 19 · `field/map/page.tsx` 19 · `lib/parsers/parseDXF.ts` 19 (events) · `api/scheme/deed-plan/route.ts` 18 · `project/[id]/cad-editor/page.tsx` 18 · `hooks/useInstrumentConnection.ts` 18 (refs) · `hooks/useMapHistory.ts` 18 · `lib/marketplace/jobMarketplace.ts` 18 · `lib/print/levelBookPrint.ts` 18 (doc)

### Batch 7 — 232 warnings, 14 files
`api/nlims/lookup/route.ts` 17 · `map/hooks/useMapBasemaps.ts` 17 (ol) · `notifications/page.tsx` 17 · `process/page.tsx` 17 · `ParcelBuilderModal.tsx` 17 · `lib/computations/traverseEngine.ts` 17 · `lib/cpd.ts` 17 · `lib/legal/dpa2019.ts` 17 · `import/page.tsx` 16 · `project/[id]/scheme/page.tsx` 16 · `tools/topographic-survey/page.tsx` 16 · `traverse/TraverseDiagram.tsx` 16 · `workspace/CadastralComputeIntegration.tsx` 16 · `lib/instruments/gnssBleConnection.ts` 16 (refs)

### Batch 8 — 212 warnings, 14 files
`lib/marketplace/cpdCertificates.ts` 16 · `lib/online/benchmarks.ts` 16 · `lib/survey/topologyChecker.ts` 16 · `api/scheme/traverse/summary/route.ts` 15 · `tools/gcp-validation/useGCPValidation.ts` 15 · `tools/staking-table/page.tsx` 15 · `verify/[token]/page.tsx` 15 · `cogo/COGOCalculator.tsx` 15 · `fieldguard/DataCleaner.tsx` 15 · `LevelBook.tsx` 15 · `integrations/nigeria.ts` 15 · `integrations/southAfrica.ts` 15 · `lib/payments/mpesa.ts` 15 (fetch) · `(dashboard)/survey/[id]/compute/page.tsx` 14

### Batch 9 — 194 warnings, 14 files
`api/admin/payments/route.ts` 14 (db) · `api/admin/users/route.ts` 14 · `api/compute/traverse/route.ts` 14 · `parcel/page.tsx` 14 · `pricing/page.tsx` 14 (fetch) · `online/CoordinateTransformer.tsx` 14 · `lib/api-client/client.ts` 14 (fetch) · `lib/export/gcpExport.ts` 14 · `lib/map/layers.ts` 14 (ol) · `lib/parcel/parcelValidation.ts` 14 · `lib/reports/coordinateConverter.ts` 14 · `lib/submission/surveyorProfile.ts` 14 (db) · `api/admin/licenses/[licenseId]/route.ts` 13 · `api/engineering/export/profile-dxf/route.ts` 13

### Batch 10 — 178 warnings, 14 files
`api/scheme/__tests__/blocks.test.ts` 13 · `api/signature/verify/route.ts` 13 · `fieldbook/LevelingBook.tsx` 13 · `lib/ai/nvidiaService.ts` 13 (fetch) · `lib/field/fieldSession.ts` 13 · `lib/geodesy/__tests__/datums.test.ts` 13 · `lib/import/totalStation/parseJobXML.ts` 13 · `integrations/ghana.ts` 13 · `lib/reports/surveyPlan/geometry.ts` 13 · `lib/workflows/workflowEngine.ts` 13 · `api/coordinates/batch/route.ts` 12 · `api/survey/audit/route.ts` 12 (fetch) · `api/workers/process/route.ts` 12 · `cpd/page.tsx` 12

### Batches 11–17 (tail) — ~160 → ~90 warnings each, remaining ~1,200 warnings
Files 15+ down to 7 warnings: field/map components, importer parsers, instrument bridges, map OL components, generators, workers, remaining api routes. Full machine-readable list in `scripts/member-plan-data.json`.

---

## 3. Rules of engagement (from prior batches)

1. **One recipe per sub-batch** — start with files sharing the same any-source (all `db-rows`, then all `any-callback`, then `ol`, …). Type the shared source once and the whole file collapses.
2. **`db.query` rows first** — the Batch-1 route pattern (`rows[0] as RowInterface`, `.map((row: RowInterface) => …)`) is proven and safe: 368 warnings eliminated in 7 files, tsc clean, gate green.
3. **Never widen to `any`** — use `unknown` + narrowing, structural interfaces, or `z.infer`. New `: any` fails the no-explicit-any ratchet.
4. **Verify per batch**: `npx tsc --noEmit` → per-file eslint 0 member-access → `lint-ratchets --update-member-access` + `--update` → `lint-ratchets --report` (floor must fall) → jest for touched libs.
5. **Commit per batch** so the floor ratchet records the drop.

## 4. Verification command

```bash
node scripts/member-scan.mjs --top 25        # regenerates the ranking + JSON
node scripts/lint-ratchets.mjs --report      # drift table; floor must trend down
node scripts/lint-gate.mjs --paths-from-changed HEAD   # PR gate self-check
```
