# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning so the CI `--max-warnings` ceiling can drop to `0` and each rule flips to `error`.

**Progress:** 14,030 → **1,080** (measured 2026-08-12, `lint-ratchets --report` on origin/main). Row-typing (0/538), a11y (0 findings), member-access, explicit-any, argument, **assignment**, no-unsafe-return and no-unsafe-call are **done** (rules flipped to `error`); `no-unused-vars`/`no-non-null-assertion` + the mechanical rules remain.

> **This doc is the canonical checkpoint.** Every grind session starts by reading the
> **STATUS CHECKPOINT** below and ends by updating it. If an agent is rate-limited or
> interrupted mid-batch, the next agent resumes from this file — commit-per-batch means
> nothing is ever lost in the working tree.

---

## 0. STATUS CHECKPOINT — read this first (2026-08-09)

### Live floors vs committed (gate green, `lint-ratchets --report` exit 0)

| Family | Live | Floor (baseline) | Status |
|---|---|---|---|
| `no-unsafe-member-access` | 0 | **0** | ✅ done (rule = error) — 1-warning tail ground (30 → 0) |
| `no-unsafe-assignment` | 0 | **0** | ✅ done (rule = error) — batches 1b/1c + tail drained 281 → 0 (floor 10 → 0), flipped 2026-08-11 |
| `no-explicit-any` | 0 | **0** | ✅ done (rule = error) — 1-warning tail + `db.ts` default ground |
| `no-unsafe-argument` | 0 | **0** | ✅ done (rule = error) |
| row-typing (`db.query` untyped) | 0 / 532 | **0** | ✅ done |
| a11y findings | 0 | **0** | ✅ done |
| **total warnings** | **1,080** | CI ceiling **1,350** | green |

Other rules (no CI floor, `--max-warnings` ceiling only): `no-unused-vars` 973 · `no-console` 0 · `react-hooks/exhaustive-deps` 44 · `no-unsafe-call` 0 · `no-non-null-assertion` 47 · `no-restricted-syntax` 16. (Non-null batch 3 fixed 85 sites in `networkAdjustment.ts`, `helmertRigorous.test`, `cassini.test`, `fr583_4acres_survey.test`, `statutoryGate.test`, `gnssBaseline.test` via a `mustGet()` map guard + the shared `defined()` helper.) (Unused-vars grind started 2026-08-12: batch 1 dropped 34 sites in `mobile/field/page.tsx`, `TopoDrawingComposer.tsx`, `tools/page.tsx` — dead imports/state/props removed, `_`-prefixed callback args, dead `userPlanRank` prop chain deleted; batch 2 dropped 51 sites in `TraverseFieldBook`; batch 3 dropped 82 sites in `develop-full-plan`, `formNo3Renderer`, `RailwayPanel`, `RoadPanel`, `GNSSConnectionPanel`, `ReportTemplateEditor`, `SubdivisionPanel`, `deed-plan/generator`, `international`, `stubs`, `sequentialAdjustment`, `cadastralPlanDXF`, `scheme/page` — dead imports trimmed, unused usePrint/useRouter/state removed, 42-line dead `includeSheetLayout` block deleted.) (Non-null grind started 2026-08-12: batch 1 fixed 115 sites in `featureCodes.test`, `mpesa.test`, `networkAdjustment.test`, `unified3dAdjustment.test`, `LongSectionRenderer`, `ProgressMonitorPanel` via a `defined()` guard helper / type-predicate filters / an `id` guard — real narrowing, not suppressions; batch 2 fixed 60 sites; batch 3 fixed 85 sites; batch 4 fixed 33 sites in `sequentialAdjustment.test`, `lsaIterative.test`, `spiralAlignment.test`, `verticalCurveDesigner.test`, `analytics/page.tsx`; batch 5 fixed 54 sites; batch 6 fixed 25 sites in `robustEstimation`, `networkAdjustment`, `dxfSheetLayout`, `digitizingHandlerContract.test`, `unifiedImport.test`; batch 7 fixed 28 sites in `traverse/engine`, `gsiParser`, `beaconLookup`, `levelNetworkAdjust`, `numbering.test`, `subdivision.test`, `cogo.test`; batch 8 fixed 33 sites in `cpd/route`, `process/page`, `LongitudinalSection`, `FieldStationSetup`, `asBuiltSurvey`, `atmosphericDefaults`, `working-diagram/traverse`, `deformationMonitoring.test`, `toolGates.test`, `ntrip-client.test`, `chainage.test` in `loginLimiter`, `offlineStorage`, `entityGraph`, `national_sheets`, `crossSectionPdf`, `AnalysisTab`, `traverseAccuracy.test`, `rinex.test`, `pileGrid.test` via `upstashEnv()`/`requireDb()`/`cassOf()` guards, get-or-guard narrowing, type-predicate filters, and the shared `defined()` helper) in `statutoryWorkbook`, `benchmarks`, `crossSectionGeometry.test`, `least-squares`, `ownership.test`, `traverseLayer.test` via `lastRow(ws)`/`findStation()` guards, captured closure consts, and the `defined()` test helper.) (`no-unsafe-return` ground to 0 and `no-unsafe-call`/`no-console` drained to 0 2026-08-12; both unsafe-return and unsafe-call flipped to `error`.)

### Git / CI state

- **Branch:** `chore/lint-typing-page-batch` (work happens here; pushes go to `origin/main` via fast-forward).
- **HEAD:** `d41231d8` (explicit-any batch 4) — on `origin/main`; local work continues on `chore/lint-typing-page-batch`.
- **Uncommitted (this batch):** explicit-any grind batch 5 — the full 1-warning tail, 62 files / 62 explicit-any → 0, plus `db.ts`'s `= any` default → `= QueryResultRow` (the last explicit-any in the repo). Setters `value: any` → `T[keyof T]`; `useState<any>` → typed (`BrowserSession['user']`, `unknown`); `Record<string, any>` → `LucideIcon`/`unknown`; dropped `: any` in map callbacks (element type flows); OL casts (`ol/ol.css` unquoted, TileSource, `setStyle` structural); `WorkerMessage<T = unknown>`, `lazy()` generic, i18n `unknown` walk, claForms `(data: never)` registry, zustand `getMap<unknown>`, `raw` union, instrumented-pool `Function` overload; fallout fixes for the `QueryResultRow` default across auditLog/rbac/parcelVault/generators/settings-profile. Floors member-access **30**, assignment **281**, explicit-any **0** (rule = error), argument 0, total **2,412**.
- **Unpushed:** none — `origin/main` is at HEAD (argument batch + CI fix already pushed).
- **Known-red CI (pre-existing, not typing work):**
  - `Deploy to Production` — GCP VM SSH timeout (infra; unrelated to code).
  - `E2E Tests` — `0183c82d` switched the E2E webServer to the standalone server (the `output: 'standalone'` + `next start` combo silently bypassed middleware — root cause of the protected-route failures), injected the OAuth env the specs need, aligned stale spec copy to the current UI, and raised the timeout. Shards were running clean at the last check; verify the next CI run's E2E verdict.
- **⚠ WIP file — never commit as part of a typing batch:**
  `src/components/survey/GNSSRoverConnection.tsx` is the concurrent session's mid-edit file (has tsc errors, and it *reduces* warning counts while uncommitted). Re-baseline floors **with this file stashed** so floors match committed code — otherwise CI fails with "live > floor" (the premature-baseline trap; see §7 rule 4).
- **Session worktree:** `write_file` lands in `.freebuff/worktrees/d90ebaf2-f825-4569-b94c-966f3d5aa130`; the real checkout is `C:/Users/user/Desktop/METARDU`. **Run `node scripts/sync-mirror.mjs` before editing** — it byte-copies every tracked file that drifted from HEAD into the mirror (EOL-insensitive compare, WIP set skipped), so the mirror never carries an old untyped/syntax-broken copy. Manual `cp` is only needed for the active WIP set (see §7 rule 6). Files are **CRLF** in the worktree, LF in primary — git normalizes; scripts must not assert exact line endings.

### First commands for any new session

```bash
cd C:/Users/user/Desktop/METARDU
node scripts/sync-mirror.mjs             # converge the .freebuff mirror to HEAD (WIP set skipped, see §7 rule 6)
git status --short                     # expect ONLY GNSSRoverConnection.tsx (WIP) or nothing
git log --oneline origin/main..HEAD    # confirm what's still unpushed
node scripts/lint-ratchets.mjs --report   # confirm gate green + live floors (exit 0)
node scripts/argument-scan.mjs --batch 1  # next per-line worklist (or member/assignment)
```

If the gate is red, §7 rule 4 (stash-rebaseline) is the usual cause — read the report, never `--update` a floor to mask a WIP-induced drop.

---

## 1. Remaining work, ordered for completion

Order = **finish the family closest to zero first** (each finish removes a floor + shrinks the ceiling), then the next, then mechanical rules. Argument → explicit-any → member-access → assignment → mechanical → CI tightening.

### Phase 1 — `no-unsafe-argument` — ✅ **DONE (0 warnings, floor → 0)**

Batch 3 drained every remaining 1-warning file in `argument-scan --batch 1` (73 files, type-the-source recipe); the last 3 warnings lived in concurrent-WIP files (`deedPlanExport.test.ts`, `GNSSRoverConnection.tsx`) — the Phase 2 batch-1 typed the former and the concurrent session's `d16f0f47` fixed the latter. `argument-scan --batch 1` now reports **0 warnings across 0 files**; floor locked to 0 in `scripts/argument-baseline.json`. Next per §6: flip the rule to `error` in the ESLint config (no more floor needed).

Highest-leverage: every warning is a typed-call-site passing an `any` value. Recipe: type the *argument's* value at its source (fetch/JSON.parse/`useRef<any>`/`useState<any>`), or narrow the callee param. Ranked (regen: `node scripts/argument-scan.mjs --top 20`):

| W | File |
|---|---|
| 4 | `src/lib/engine/__tests__/topographic.test.ts` |
| 3 | `src/app/cpd/page.tsx` · `src/app/process/page.tsx` · `src/components/realtime/ProjectPresencePanel.tsx` · `src/components/search/CommandPalette.tsx` · `src/components/TraverseModal.tsx` · `src/components/UploadZone.tsx` · `src/components/version/VersionDiffViewer.tsx` · `src/components/workspace/LongitudinalSection.tsx` · `src/lib/compute/deedPlanRenderer.ts` · `src/lib/db/optimization.ts` · `src/lib/engine/networkAdjustment.ts` · `src/lib/engine/parser.ts` · `src/lib/gnss/__tests__/ntrip-client.test.ts` · `src/lib/mobile/offlineStorage.ts` (props) · `src/lib/parsers/parseBOQ.ts` · `src/lib/payments/paypal.ts` · `src/lib/realtime/useCollaboration.ts` (refs) · `src/lib/survey/traverse/least-squares.ts` |
| 2 | `src/app/api/scheme/__tests__/security.test.ts` + tail |

Batches of ~10 files per commit; finish with `--update-argument` (floor → 0) and flip the rule to `error` in `.eslintrc` when live = 0 (see §6).

### Phase 2 — `no-explicit-any` (538 → 0, 227 files) — **batches 1–3 done (floor 348 → 156)**

Batch 1 (earlier session) ground the top-density cluster — `vectorTileFactory.ts` + its two test files, `deedPlanExport.test.ts`, `leveling-standards.ts`, `governmentLicensing.ts`, `CrossSectionInput.tsx` — 68 explicit-any → 0. Batch 2 (prior session) took the next 10-file cluster to zero (`dataCleaner`, `leveling.test`, `engineering/compute`, `ntrip-client.test`, `useCollaboration`, `MotionComponents`, `templates/index`, `computationWorker`, `profileSvg`, `WorkerBridge` — 45 more). Batch 3 (this session) ground the 3-warning tier — 11 files, 33 explicit-any → 0, including the `useFieldBook` row-typing recipe (`FieldBookEntryRow` interface so the supabase-style `data: any` becomes typed, clearing ~10 unsafe warnings too) and the PerformanceMonitor `PerformanceEventTiming` casts. Recipe: typed-array callbacks (drop `: any` — element type flows), `unknown` for dead compatibility callbacks, real DOM/yjs types, structural casts where the DOM lib lacks the type (`LayoutShift` → `{ hadRecentInput, value }`). Floor explicit-any **156** (member-access batch 6 later took it to 151 via the `: any` params it removed). Next: regen the ranking — the 2-warning tier (~20 files) and the 1-warning tail remain.

Ranked (regen: run a one-off eslint aggregation — `ESLint.lintFiles(['middleware.ts','src/**/*.{ts,tsx}'])` filtered to the rule id):

| W | File |
|---|---|
| 19 | `src/lib/map/__tests__/vectorTileFactory.test.ts` |
| 17 | `src/lib/map/__tests__/deedPlanExport.test.ts` |
| 11 | `src/components/map/LayerControl.tsx` · `src/lib/api-client/parcelVault.ts` |
| 9 | `src/lib/engine/leveling-standards.ts` · `src/lib/enterprise/governmentLicensing.ts` |
| 8 | `src/lib/map/vectorTileFactory.ts` · `src/lib/serial/InstrumentSerialConnection.ts` |
| 7 | `src/lib/integrations/equipment.ts` · `src/lib/mobile/offlineStorage.ts` |
| 6 | `src/components/earthworks/CrossSectionInput.tsx` · `src/lib/compute/planChecker.ts` · `src/lib/realtime/useCollaboration.ts` |
| 5 | `CleanedExport.tsx` · `ParcelNumberInput.tsx` · `StakeoutRadar.tsx` · `dataCleaner.ts` · `leveling.test.ts` · `engineering/compute.ts` · `ntrip-client.test.ts` · `traverse-csv.ts` · `aiPlanChecker.ts` · `fieldbooks.ts` · `solutionToPdf.ts` · `rimPdfGenerator.ts` |

Recipe: `: any` → `unknown` + narrow, or the real type (row interface / OL type / zod-inferred). Tests with `(x as any)` casts: replace with precise literals or `satisfies`. **No new `any`** — this family's ratchet fails PRs that add them.

### Phase 3 — `no-unsafe-member-access` (1,101 → 0, ~350 files)

Batches 1–9 done (floor 1,220 → **43**): member-access 1,101 → 43 across the API-route tiers, the page tiers, the map/OL clusters, and now the 2-warning tier (batch 9: fetch payload casts, `db.query<Row>` generics, `splitTextToSize` → `string[]`, idb/dompurify/html2canvas library-boundary typings). Next: the 1-warning tail (~43 files) — then the rule flips to error.

Top 22 (regen: `node scripts/member-scan.mjs --top 22`; per-line worklist: `--batch N`):

| W | dom% | File |
|---|---|---|
| 12 | other | `src/app/cpd/page.tsx` · `src/components/field/FieldDataCollector.tsx` · `src/components/fieldguard/CleanedExport.tsx` · `src/lib/map/__tests__/vectorTileFactory.test.ts` |
| 11 | fetch | `src/app/project/[id]/ProjectWorkspaceClient.tsx` |
| 11 | other | `src/app/tools/survey-regulations/page.tsx` · `src/components/map/LayerControl.tsx` · `src/lib/subscription/subscriptionEngine.ts` · `src/lib/__tests__/tier1SecurityHelpers.test.ts` |
| 11 | db | `src/components/setting-out/SettingOutTable.tsx` · `src/components/setting-out/StakeOutSheet.tsx` |
| 10 | other | `src/app/analytics/page.tsx` · `src/app/project/new/page.tsx` · `src/app/project/[id]/engineering/steps/Step6Outputs.tsx` · `src/components/search/CommandPalette.tsx` · `src/lib/parsers/parse3D.ts` |
| 10 | props | `src/app/project/[id]/scheme/map/page.tsx` |
| 9 | other | `src/app/tools/contour-generator/page.tsx` · `src/components/cadastra/ValidationReport.tsx` · `src/components/shared/ParcelNumberInput.tsx` · `src/lib/api-client/parcelVault.ts` · `src/lib/compute/planChecker.ts` |

Dominant any-sources (from scan): `db` 90 · `other-object` 47 · `events` 30 · `props` 10 · `ol` 9 · `builders` 7 · `refs` 2. Type the *source* once per file — the whole file collapses.

### Phase 4 — `no-unsafe-assignment` (829 → 0, ~350 files)

Batches 1–2 done (floor 925 → **326**).

Top 20 (regen: `node scripts/assignment-scan.mjs --top 20`):

| W | File |
|---|---|
| 11 | `src/lib/map/__tests__/deedPlanExport.test.ts` |
| 10 | `src/lib/api-client/parcelVault.ts` |
| 9 | `src/lib/parsers/parsePDF.ts` · `src/lib/payments/paypal.ts` |
| 8 | `src/app/analytics/page.tsx` · `src/components/CSVUploadModal.tsx` · `src/components/survey/GNSSRoverConnection.tsx` ⚠WIP · `src/components/tools/ProcessingToolbox.tsx` · `src/hooks/useFieldBook.ts` · `src/lib/engine/sparseMatrix.ts` · `src/lib/map/__tests__/vectorTileFactory.test.ts` |
| 7 | `src/app/profile/page.tsx` · `src/app/project/[id]/profiles/page.tsx` · `src/lib/engine/leastSquaresAdjustment.ts` · `src/lib/map/vectorTileFactory.ts` · `src/lib/survey/fetchSurveyorProfile.ts` |
| 6 | `src/app/api/osm/context-geojson/route.ts` · `src/app/project/[id]/ProjectWorkspaceClient.tsx` · `src/app/project/[id]/topo/page.tsx` · `src/app/schedule/page.tsx` |

### Phase 5 — mechanical rules (2,591 combined)

| Rule | Count | Fix class | Top files |
|---|---|---|---|
| `no-unused-vars` | 1,106 | `_`-prefix unused bindings, drop dead imports/params | next tier per live scan (batch 1 done: mobile/field 13 · TopoDrawingComposer 11 · tools/page 10; cadastralPlanDXF 10 · scheme/page 9 up next) |
| `no-non-null-assertion` | 161 | replace `!` with real narrowing/guards (tests: `defined()` helper + assert; prod: type-predicate filters / destructure guards) | next tier per live scan (batch 11 done: final 2-warning tier + 1-warning start (8 files); 47 live) |
| `no-console` | 8 → 0 (done) | ✅ drained 2026-08-12 — routed through `lib/logger.ts` (chat/route 3, handler 2, africasTalking 2, fieldbook 1) | — |
| `no-unsafe-call` | 0 (done) | ✅ flipped to `error` 2026-08-12 — committed tree drained 1 → 0 (`auth-v5.ts` req.headers cast); rule now errors | — |
| `no-unsafe-return` | 171 | return `any` → typed return (engine math libs mostly) | `sparseMatrix.ts` 7 · `geodesy/gnss.ts` 7 · `levelNetworkAdjustment.ts` 6 · `totalLeastSquares.ts` 6 |
| `react-hooks/exhaustive-deps` | 70 | careful per-effect dep fixes; use `eslint-disable-next-line` only with a justification (repo convention: 32 existing) | `useMapInteractions.ts` 16 · `useSubdivision.ts` 6 · `MobileMeasurementCapture.tsx` 4 |
| `no-restricted-syntax` | 16 | project-specific banned patterns (e.g. `for..of` over `Object.keys`) — check the rule config | `nativeProjectionView.test.ts` 9 · `MapClient.tsx` 2 |

### Phase 6 — CI tightening + completion

1. Push every batch; watch the ci.yml run — all code gates must stay green.
2. As each family hits 0: drop its floor to 0 (via `--update-<family>`) and flip the rule to `"error"` in the ESLint config so it can never regress.
3. Tighten `--max-warnings`: 20,000 → 10,000 → 5,000 → 3,700 → 3,000 → 2,800 → 2,000 → 1,500 → 1,400 → **1,350 (now)** → 500 → **0** as the totals shrink. Keep the ceiling documented in the workflow files (see the earlier 10k tightening for the pattern).
4. Fix the two known-red CI jobs (§0): E2E (env + timeout/sharding) and Deploy (GCP SSH — infra, needs credentials/VM work, out of code scope).

---

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
