# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning so the CI `--max-warnings` ceiling can drop to `0` and each rule flips to `error`.

**Progress:** 14,030 → **1,080** (measured 2026-08-12, `lint-ratchets --report` on origin/main). Row-typing (0/538), a11y (0 findings), member-access, explicit-any, argument, **assignment**, no-unsafe-return and no-unsafe-call are **done** (rules flipped to `error`); `no-unused-vars`/`no-non-null-assertion` + the mechanical rules remain.

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
| **total warnings** | **1,080** | CI ceiling **1,350** | green |

Other rules (no CI floor, `--max-warnings` ceiling only): `no-unused-vars` 973 · `no-console` 0 · `react-hooks/exhaustive-deps` 44 · `no-unsafe-call` 0 · `no-non-null-assertion` 47 · `no-restricted-syntax` 16. (Non-null batch 3 fixed 85 sites in `networkAdjustment.ts`, `helmertRigorous.test`, `cassini.test`, `fr583_4acres_survey.test`, `statutoryGate.test`, `gnssBaseline.test` via a `mustGet()` map guard + the shared `defined()` helper.) (Unused-vars grind started 2026-08-12: batch 1 dropped 34 sites in `mobile/field/page.tsx`, `TopoDrawingComposer.tsx`, `tools/page.tsx` — dead imports/state/props removed, `_`-prefixed callback args, dead `userPlanRank` prop chain deleted; batch 2 dropped 51 sites in `TraverseFieldBook`; batch 3 dropped 82 sites in `develop-full-plan`, `formNo3Renderer`, `RailwayPanel`, `RoadPanel`, `GNSSConnectionPanel`, `ReportTemplateEditor`, `SubdivisionPanel`, `deed-plan/generator`, `international`, `stubs`, `sequentialAdjustment`, `cadastralPlanDXF`, `scheme/page` — dead imports trimmed, unused usePrint/useRouter/state removed, 42-line dead `includeSheetLayout` block deleted.) (Non-null grind started 2026-08-12: batch 1 fixed 115 sites in `featureCodes.test`, `mpesa.test`, `networkAdjustment.test`, `unified3dAdjustment.test`, `LongSectionRenderer`, `ProgressMonitorPanel` via a `defined()` guard helper / type-predicate filters / an `id` guard — real narrowing, not suppressions; batch 2 fixed 60 sites; batch 3 fixed 85 sites; batch 4 fixed 33 sites in `sequentialAdjustment.test`, `lsaIterative.test`, `spiralAlignment.test`, `verticalCurveDesigner.test`, `analytics/page.tsx`; batch 5 fixed 54 sites; batch 6 fixed 25 sites in `robustEstimation`, `networkAdjustment`, `dxfSheetLayout`, `digitizingHandlerContract.test`, `unifiedImport.test`; batch 7 fixed 28 sites in `traverse/engine`, `gsiParser`, `beaconLookup`, `levelNetworkAdjust`, `numbering.test`, `subdivision.test`, `cogo.test`; batch 8 fixed 33 sites in `cpd/route`, `process/page`, `LongitudinalSection`, `FieldStationSetup`, `asBuiltSurvey`, `atmosphericDefaults`, `working-diagram/traverse`, `deformationMonitoring.test`, `toolGates.test`, `ntrip-client.test`, `chainage.test` in `loginLimiter`, `offlineStorage`, `entityGraph`, `national_sheets`, `crossSectionPdf`, `AnalysisTab`, `traverseAccuracy.test`, `rinex.test`, `pileGrid.test` via `upstashEnv()`/`requireDb()`/`cassOf()` guards, get-or-guard narrowing, type-predicate filters, and the shared `defined()` helper) in `statutoryWorkbook`, `benchmarks`, `crossSectionGeometry.test`, `least-squares`, `ownership.test`, `traverseLayer.test` via `lastRow(ws)`/`findStation()` guards, captured closure consts, and the `defined()` test helper.) (`no-unsafe-return` ground to 0 and `no-unsafe-call`/`no-console` drained to 0 2026-08-12; both unsafe-return and unsafe-call flipped to `error`.)

### Git / CI state

- **Branch:** `chore/lint-typing-page-batch` (work happens here; pushes go to `origin/main` via fast-forward).
- **HEAD:** `c010eb58` (docs checkpoint after non-null batch 11) — on `origin/main`; local work continues on `chore/lint-typing-page-batch`.
- **Uncommitted (this batch):** none in flight — tree holds only `.a11y-audit.json` (a11y-sweep regeneration) + untracked `docs/Metardu_Repowise_Intelligence.md`, `scripts/sync-mirror.mjs`, `_tmp-*.py` helpers. Floors: member-access 0 · assignment 0 · explicit-any 0 · argument 0 · total **1,080** (all six `no-unsafe-*` rules flipped to `error`).
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
node scripts/warn-scan.mjs                 # regenerate the per-file census (next: non-null batch 12)
```

If the gate is red, §7 rule 4 (stash-rebaseline) is the usual cause — read the report, never `--update` a floor to mask a WIP-induced drop.

---

## 1. Remaining work, ordered for completion

**Checklist state (live scan 2026-08-12, origin/main @ `c010eb58` — committed total 1,080):**

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
| `no-unused-vars` | **973** | warn | ⏳ next |
| `no-non-null-assertion` | **47** | warn | ⏳ |
| `react-hooks/exhaustive-deps` | **44** | warn | ⏳ |
| `no-restricted-syntax` | **16** | warn | ⏳ |
| **total** | **1,080** | CI ceiling **1,350** | green |

Order = finish the family closest to zero first (each finish removes a floor + shrinks the ceiling), then mechanical rules, then CI tightening. **All six `no-unsafe-*` families are done** — only the mechanical rules remain. Finish order: **non-null (47) → unused-vars (973) → exhaustive-deps (44) → no-restricted-syntax (16) → ceiling → 0**.

### Phase 1 — `no-unsafe-argument` — ✅ **DONE (0 warnings, rule = error)**

All batches drained (`argument-scan --batch 1` → 0 across 0 files); floor locked to 0 in `scripts/argument-baseline.json`; rule flipped to `error` in `.eslintrc`.

### Phase 2 — `no-explicit-any` — ✅ **DONE (0 warnings, rule = error)**

538 → 0 across 227 files (batches 1–5 + the 1-warning tail + `db.ts`'s `= any` default → `= QueryResultRow`); floor 0; rule = `error`.

### Phase 3 — `no-unsafe-member-access` — ✅ **DONE (0 warnings, rule = error)**

1,101 → 0 (batches 1–9 + the 1-warning tail, 30 → 0); floor 0; rule = `error`. Recipe that carried the family: type the *source* once per file — `db.query<Row>` generics, `res.json()` casts, `JSON.parse` assertions, `useRef`/`useState` real types, OL/structural casts at library boundaries.

### Phase 4 — `no-unsafe-assignment` — ✅ **DONE (0 warnings, rule = error)**

829 → 0 (batches 1–2 + 1b/1c + the tail, 281 → 0, floor 10 → 0); rule = `error`. Same type-the-source recipe as Phase 3.

### Phase 5 — mechanical rules (1,080 combined)

| Rule | Live | Fix class | Next tier |
|---|---|---|---|
| `no-non-null-assertion` | **47** | replace `!` with real narrowing/guards (tests: shared `defined()` helper + assert; prod: type-predicate filters / destructure guards / get-or-throw) | 1-warning tail, 47 files — batch 12 takes this to 0 (batches 1–11 drained 113 → 47) |
| `no-unused-vars` | **973** | `_`-prefix unused bindings, drop dead imports/state/props | batches 1–3 drained 167 sites; next: 7-warning tier — `admin/page` · `SurveyReportBuilder` · `traverseEngine` · `generateDocx` · `fileRouter` · `formNo4Renderer` · `spiralAlignment` · `deformationMonitoring` |
| `react-hooks/exhaustive-deps` | **44** | careful per-effect dep fixes; `eslint-disable-next-line` only with a justification (repo convention) | `useMapInteractions` 16 · `useSubdivision` 6 · `MobileMeasurementCapture` 4 |
| `no-restricted-syntax` | **16** | project-specific banned patterns — check the rule config | `nativeProjectionView.test.ts` 9 · `MapClient.tsx` 2 |
| `no-console` | 0 | ✅ drained — routed through `lib/logger.ts` | — |
| `no-unsafe-call` | 0 | ✅ flipped to `error` 2026-08-12 | — |
| `no-unsafe-return` | 0 | ✅ flipped to `error` 2026-08-12 | — |

### Phase 6 — CI tightening + completion

1. Push every batch; watch the ci.yml run — all code gates must stay green.
2. As each family hits 0: drop its floor to 0 (via `--update-<family>`) and flip the rule to `"error"` in the ESLint config so it can never regress. Done for all six `no-unsafe-*` families; the four mechanical rules ride the `--max-warnings` ceiling (no floors).
3. Tighten `--max-warnings`: 20,000 → 10,000 → 5,000 → 3,700 → 3,000 → 2,800 → 2,000 → 1,500 → 1,400 → 1,350 (now) → **500** → **0** as the totals shrink (total is 1,080). Keep the ceiling documented in the workflow files.
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
