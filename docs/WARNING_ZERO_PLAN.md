# Warning Zero Plan — 14,030 → 0

**Goal:** clear every `@typescript-eslint` / JS warning in the repo so the CI `--max-warnings` ceiling can drop to `0` (and then rules flip to `error`).

**Current state (measured 2026-08-05, `lint-ratchets --report` + `warn-scan.mjs`):**

| Rule | Count | Fix class |
|---|---|---|
| `no-unsafe-member-access` | 5,043 | db rows / helpers / fetch |
| `no-unsafe-assignment` | 2,882 | same roots as above |
| `no-unused-vars` | 1,302 | mechanical (`_`-prefix, drop imports) |
| `no-explicit-any` | 1,286 | `: any` → `unknown`+narrow / precise type |
| `no-unsafe-argument` | 1,023 | typed callers of `any` params |
| `no-unsafe-call` | 967 | constructing/calling `any` |
| `no-non-null-assertion` | 665 | replace `!` with real narrowing |
| `no-console` | 405 | structured logging / remove debug |
| `no-unsafe-return` | 365 | return `any` → typed |
| `react-hooks/exhaustive-deps` | 76 | per-file careful dep fixes |
| `no-restricted-syntax` | 16 | project-specific banned patterns |
| **Total** | **14,030** | |

**Distribution:** 1,108 files — Tier A ≥100 (13 files ≈ 1,570), Tier B 50–99 (43 ≈ 2,900), Tier C 20–49 (154 ≈ 4,800), Tier D 10–19 (168 ≈ 2,300), Tier E 5–9 (200 ≈ 1,350), Tier F 1–4 (530 ≈ 1,000).

## Root causes (why 74% is the `no-unsafe-*` family)

1. **`db.query()` returns `QueryResult<any>`** — `src/lib/db.ts:185`. 703 call sites / 206 files. Every `rows[i].field` is unsafe by construction. **Single highest-leverage fix.**
2. **Helper signatures typed `: any`** (`doc: any`, `ctx: any`, `obs: any`, `pt: any`) — proven recipe: real jsPDF / canvas / OL / row types.
3. **`.map((r: any) => …)` / `.forEach((f: any) => …)` callbacks** — usually the same rows as (1) or object props.
4. **`fetch(...).json()` untyped** — `await res.json()` is `any`; cast to declared/added interfaces.
5. **`JSON.parse` returns `any`** — assert the stored shape.
6. **OL objects through `any` refs/states** — `useRef<any>`, `useState<any>`.

## The recipe (per file)

Type the *source* once, never widen to `any`:

- `db.query<RowIface>(...)` — row interfaces already exist in most route files
- `doc: any` → `doc: jsPDF`, `ctx: any` → `CanvasRenderingContext2D`, etc.
- `const json = (await res.json()) as { data?: Row[]; ... }`
- `const parsed = JSON.parse(x) as Shape`
- `useRef<RealType>` / `useState<RealType>`; drop redundant `: any` annotations
- unused vars: `_`-prefix or remove the import/binding

## Batch roadmap (by leverage, ~700–900 warnings each)

| Batch | Scope | Files (top) | Expect |
|---|---|---|---|
| **B1** | **Generic `db.query<T>()`** + typed rows in top API routes | `db.ts`, sign-plan (126), admin/dashboard (71), scheme exports (70/65/53), survey-report/generate (67), webhooks paypal/stripe (75/72), search (56), compute/traverse (56), submission/preview (56), project workflow (57), scheme forms/team | **~4,000** (member+assign+arg from rows) |
| **B2** | Engine lib — helper + row typing, non-null narrowing | leastSquares (159), turfHelpers (120), lsaIterative (98), traverseToLSQ (52), topologyChecker (57), traverseEngine (47) | ~1,000 |
| **B3** | Mobile / sync / submission | syncService (135), assembleDocument (121), exportProject (115), assembleSubmission (57), ardhiasasaClient (72), payments/stripe (54) | ~900 |
| **B4** | Map + fieldbook components | WorkingDiagramClient (119), WorkspaceMap (104), MapViewer (103), coordSearch (93), OsmBuildingsLayer (79), RegistryIndexMap (74), TraverseFieldBook (74), SurveyReportBuilder (54), MobileFieldbookShell (66), FieldbookQuickActions (50), BatchParcelImport (64) | ~1,100 |
| **B5** | Tools + project pages | leveling (122), gis-export (101), gnss (91), orthophoto-viewer (91), civil-export (69), contours (68), regulatory-checklist (66), gcp-export (64), drone (60), portfolio (53), engineering (70), documents (118) | ~1,300 |
| **B6** | Lib / auth / db / importers | auth (86), db/admin (98), ifcParser (74), marketplace (57/56), imports | ~700 |
| **B7** | Mechanical sweep — `no-unused-vars` (1,302) | all files, by directory | ~1,300 |
| **B8** | Mechanical sweep — `no-explicit-any` (1,286) | remaining `: any`, top files first | ~1,300 |
| **B9** | Sweeps — `no-console` (405) + `no-restricted-syntax` (16) | routes → structured logging | ~420 |
| **B10** | Sweep — `no-non-null-assertion` (665) | lsaIterative (72) + rest | ~665 |
| **B11** | `react-hooks/exhaustive-deps` (76) | per-file, behavior-sensitive | 76 |
| **B12** | Tail — Tier F (530 files ≈ 1,000) | per-directory rule sweeps | ~1,000 |
| **B13** | Zero gate | baselines → 0, rules → `error`, CI `--max-warnings 0` | — |

## Rules of engagement (every batch)

1. tsc `--noEmit` clean before lint.
2. Per-file eslint → target rules at 0 for the batch files.
3. `lint-ratchets --update-member-access` (if member floor moved) + `--update`; gate green.
4. Run related jest suites (paths touched); fix regressions.
5. Commit per batch with the floor drop in the message (member floor + total).
6. `--report` after each commit to confirm only intended families moved.

## Tooling

- `scripts/warn-scan.mjs` — regenerates the per-file census (`scripts/warn-plan-data.json`)
- `scripts/member-scan.mjs` — member-access family scanner
- `scripts/lint-ratchets.mjs` — baseline ratchet + `--report` drift table
- `scripts/lint-gate.mjs --paths-from-changed` — fast PR member-access check
