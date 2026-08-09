# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning so the CI `--max-warnings` ceiling can drop to `0` and each rule flips to `error`.

**Progress:** 14,030 → **5,291** (measured 2026-08-09, `lint-ratchets --report`). Row-typing (0/532) and a11y (0 findings) are **done**; four unsafe-families + seven mechanical rules remain.

> **This doc is the canonical checkpoint.** Every grind session starts by reading the
> **STATUS CHECKPOINT** below and ends by updating it. If an agent is rate-limited or
> interrupted mid-batch, the next agent resumes from this file — commit-per-batch means
> nothing is ever lost in the working tree.

---

## 0. STATUS CHECKPOINT — read this first (2026-08-09)

### Live floors vs committed (gate green, `lint-ratchets --report` exit 0)

| Family | Live | Floor (baseline) | Status |
|---|---|---|---|
| `no-unsafe-member-access` | 925 | **925** | active |
| `no-unsafe-assignment` | 755 | **755** | active |
| `no-explicit-any` | 464 | **464** | active |
| `no-unsafe-argument` | 125 | **125** | active — closest to zero, grind first |
| row-typing (`db.query` untyped) | 0 / 532 | **0** | ✅ done |
| a11y findings | 0 (1,857 files) | **0** | ✅ done |
| **total warnings** | **4,742** | CI ceiling **10,000** | green |

Other rules (no CI floor, `--max-warnings` ceiling only): `no-unused-vars` ~1,155 · `no-console` 341 · `react-hooks/exhaustive-deps` 44 · `no-unsafe-call` ~205 · `no-non-null-assertion` ~568 · `no-unsafe-return` ~171 · `no-restricted-syntax` 16.

### Git / CI state

- **Branch:** `chore/lint-typing-page-batch` (work happens here; pushes go to `origin/main` via fast-forward).
- **HEAD:** `625a476c` (non-browser cast typing + floors 165/478/973).
- **Uncommitted (this batch):** argument grind batch 2 — 20 files (automator, guide/[type], schedule, beacon-reference, gnss-rinex, survey-report-builder, WorkingDiagramClient, BeaconRegistryPanel, BoundaryUploader, DrawingExportToolbar, MassHaulDiagram, UniversalImporter, NotificationBell, CoordinateTransformer, CsvImportPanel, DocumentCard, FieldRecordVault, UTMZonePicker, FieldToFinishButton, workflowEngine) — fetch/JSON.parse reads typed at read time, `: any` map annotations removed, `executeWorkflow` boundary cast narrowed to WorkflowNode/WorkflowEdge, schedule form input typed (`ScheduleFormInput` with optional status, `createSchedule` defaults `'upcoming'`). Floors 125/447/923/744, total 4,772.
- **Unpushed:** none — `origin/main` is at HEAD (argument batch + CI fix already pushed).
- **Known-red CI (pre-existing, not typing work):**
  - `Deploy to Production` — GCP VM SSH timeout (infra; unrelated to code).
  - `E2E Tests` — `0183c82d` switched the E2E webServer to the standalone server (the `output: 'standalone'` + `next start` combo silently bypassed middleware — root cause of the protected-route failures), injected the OAuth env the specs need, aligned stale spec copy to the current UI, and raised the timeout. Shards were running clean at the last check; verify the next CI run's E2E verdict.
- **⚠ WIP file — never commit as part of a typing batch:**
  `src/components/survey/GNSSRoverConnection.tsx` is the concurrent session's mid-edit file (has tsc errors, and it *reduces* warning counts while uncommitted). Re-baseline floors **with this file stashed** so floors match committed code — otherwise CI fails with "live > floor" (the premature-baseline trap; see §7 rule 4).
- **Session worktree:** `write_file` lands in `.freebuff/worktrees/d90ebaf2-f825-4569-b94c-966f3d5aa130`; the real checkout is `C:/Users/user/Desktop/METARDU`. Sync edits across with `cp` (see §7 rule 6). Files are **CRLF** in the worktree, LF in primary — git normalizes; scripts must not assert exact line endings.

### First commands for any new session

```bash
cd C:/Users/user/Desktop/METARDU
git status --short                     # expect ONLY GNSSRoverConnection.tsx (WIP) or nothing
git log --oneline origin/main..HEAD    # confirm what's still unpushed
node scripts/lint-ratchets.mjs --report   # confirm gate green + live floors (exit 0)
node scripts/argument-scan.mjs --batch 1  # next per-line worklist (or member/assignment)
```

If the gate is red, §7 rule 4 (stash-rebaseline) is the usual cause — read the report, never `--update` a floor to mask a WIP-induced drop.

---

## 1. Remaining work, ordered for completion

Order = **finish the family closest to zero first** (each finish removes a floor + shrinks the ceiling), then the next, then mechanical rules. Argument → explicit-any → member-access → assignment → mechanical → CI tightening.

### Phase 1 — `no-unsafe-argument` (122 → 0, ~103 files) — batches 1+2 done (39 files, floor 224→125)

Highest-leverage: every warning is a typed-call-site passing an `any` value. Recipe: type the *argument's* value at its source (fetch/JSON.parse/`useRef<any>`/`useState<any>`), or narrow the callee param. Ranked (regen: `node scripts/argument-scan.mjs --top 20`):

| W | File |
|---|---|
| 4 | `src/lib/engine/__tests__/topographic.test.ts` |
| 3 | `src/app/cpd/page.tsx` · `src/app/process/page.tsx` · `src/components/realtime/ProjectPresencePanel.tsx` · `src/components/search/CommandPalette.tsx` · `src/components/TraverseModal.tsx` · `src/components/UploadZone.tsx` · `src/components/version/VersionDiffViewer.tsx` · `src/components/workspace/LongitudinalSection.tsx` · `src/lib/compute/deedPlanRenderer.ts` · `src/lib/db/optimization.ts` · `src/lib/engine/networkAdjustment.ts` · `src/lib/engine/parser.ts` · `src/lib/gnss/__tests__/ntrip-client.test.ts` · `src/lib/mobile/offlineStorage.ts` (props) · `src/lib/parsers/parseBOQ.ts` · `src/lib/payments/paypal.ts` · `src/lib/realtime/useCollaboration.ts` (refs) · `src/lib/survey/traverse/least-squares.ts` |
| 2 | `src/app/api/scheme/__tests__/security.test.ts` + tail |

Batches of ~10 files per commit; finish with `--update-argument` (floor → 0) and flip the rule to `error` in `.eslintrc` when live = 0 (see §6).

### Phase 2 — `no-explicit-any` (538 → 0, 227 files)

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
| `no-unused-vars` | 1,163 | `_`-prefix unused bindings, drop dead imports/params | `mobile/field/page.tsx` 13 · `TopoDrawingComposer.tsx` 11 · `tools/page.tsx` 10 · `cadastralPlanDXF.ts` 10 · `project/[id]/scheme/page.tsx` 9 |
| `no-non-null-assertion` | 570 | replace `!` with real narrowing/guards (tests: `expect(...).toBeDefined()` + assert) | `networkAdjustment.test.ts` 23 · `ProgressMonitorPanel.tsx` 21 · `LongSectionRenderer.tsx` 19 · `unified3dAdjustment.test.ts` 18 · `mpesa.test.ts` 17 · `statutoryWorkbook.ts` 16 |
| `no-console` | 393 | `lib/logger.ts` structured logging or remove debug (keep `console.error` in server bootstrap per existing convention) | `api/webhooks/paypal/route.ts` 13 · `lib/auth.ts` 11 · `networkAdjustment.ts` 11 |
| `no-unsafe-call` | 208 | calling members on `any` — same root sources as the unsafe families; drain after Phases 1–4 | `LayerControl.tsx` 11 · `totalStationSerial.ts` 9 · `contourGenerator.ts` 8 · `SettingOutTable/StakeOutSheet` 7 |
| `no-unsafe-return` | 171 | return `any` → typed return (engine math libs mostly) | `sparseMatrix.ts` 7 · `geodesy/gnss.ts` 7 · `levelNetworkAdjustment.ts` 6 · `totalLeastSquares.ts` 6 |
| `react-hooks/exhaustive-deps` | 70 | careful per-effect dep fixes; use `eslint-disable-next-line` only with a justification (repo convention: 32 existing) | `useMapInteractions.ts` 16 · `useSubdivision.ts` 6 · `MobileMeasurementCapture.tsx` 4 |
| `no-restricted-syntax` | 16 | project-specific banned patterns (e.g. `for..of` over `Object.keys`) — check the rule config | `nativeProjectionView.test.ts` 9 · `MapClient.tsx` 2 |

### Phase 6 — CI tightening + completion

1. Push every batch; watch the ci.yml run — all code gates must stay green.
2. As each family hits 0: drop its floor to 0 (via `--update-<family>`) and flip the rule to `"error"` in the ESLint config so it can never regress.
3. Tighten `--max-warnings`: 10,000 → 5,000 (now) → 2,000 → 500 → **0** as the totals shrink. Keep the ceiling documented in the workflow files (see the earlier 10k tightening for the pattern).
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
6. **Worktree sync:** edits made via file tools land in `.freebuff/worktrees/d90ebaf2-f825-4569-b94c-966f3d5aa130` — copy them to the primary (`cp "$WT/... " ...`) so the commit (made in the primary) includes them. Files are CRLF in the worktree / LF in primary; `git diff --ignore-space-at-eol` or `cmp -s` after normalization.
7. Run related jest suites for touched libs; fix regressions.
8. Commit per batch (conventional message, floor drops in the body: `refactor(types): … — member-access 1133→1105`). Never commit `GNSSRoverConnection.tsx` as part of a typing batch.
9. Push (fast-forward to `origin/main`), watch the ci.yml run to completion; every code gate must stay green.
10. **Update §0 of this doc** with the new floors/HEAD/unpushed state so the next agent resumes cleanly.

## 7. Rate-limit / handoff continuity

- **Commit per batch** — the working tree is never the source of truth; commits are.
- **This doc is the checkpoint** — a fresh agent runs §0's "first commands" and picks the next batch from §1. If a batch is mid-flight when a session dies, commit what's verified; the WIP (`_tmp-*.py` scripts, partial edits) can be re-derived from §1 worklists.
- **Never `--update` a floor to absorb unrelated growth** — floors only move down after a genuine live drop on committed code.
- **Known-red CI is documented, not blocking** — Deploy (GCP SSH) and E2E (env/timeout) are separate workstreams (§0); typing batches only need the code gates green.
