# A11Y Remediation Plan — `jsx-a11y/label-has-associated-control`

**Last updated:** 2026-08-03
**Rule:** `jsx-a11y/label-has-associated-control` — `error` in `.eslintrc.json`, now with `controlComponents: ["RadioGroupItem"]` (Radix radio cards); `.eslintrc.a11y-tmp.json` kept for isolated sweeps

## ✅ DONE — 0 violations codebase-wide (Batch 5 completed 2026-08-03)

Batch 5 cleared the final 25 changed-file violations + the 2 remaining tree-wide stragglers (`SubSheetInspector`, `GNSSRoverConnection`). Full-repo sweep: **0 `label-has-associated-control` errors**. The rule stays `error` — the CI lint gate (`scripts/lint-gate.mjs` ratchet) enforces no-new-warnings on changed files.

## Progress so far

| Phase | Scope | Violations cleared |
|---|---|---|
| Batch 1 | Auth/onboarding pages (login, register, reset-password, project/new, marketplace, schedule, online, field, beacons, kencors, digital-signature, profile, account, checkout, import, drone, parcel, process, cpd, admin/users) | ~127 |
| Batch 2 | Project workflow pages (settings, documents, scheme/blocks, engineering steps, survey observations) | ~95 |
| Batch 3 | Shared components (SurveyReportBuilder, DeedPlanGenerator, MutationPlanGenerator, TraverseFieldBook, GNSS/fieldbook components) | ~141 |
| Codemod + manual sweep | Remaining long tail across the tree | 611 of 639 |
| src/components/ui | UTMZonePicker + sweep of all 58 ui primitives | 1 |
| Batch 4 | Reusable field primitives / shared form shells — cleared the systemic literal `aria-label=\"{label}\"` bug class (12 files: PrintMetaPanel, BillableDocumentsBuilder, CompanySection, SidePanel, COGOCalculator, BeaconCertificateBuilder, SettingOutCalculator, CrossSectionInput, FormC22Generator, CogoToolsPanel, control-marks-register, LongitudinalSection) | 1 lint-visible (BeaconCertificateBuilder Condition) + 12 files of literal-bug fixes |
| Batch 5 | Tools pages + shared components + tail — group labels → `<div>`, `htmlFor`/`id` wiring (GenerateReportModal, cassini InputForm), Radix `controlComponents` + `aria-label` (PlanPromotionPanel), junk placeholder-as-name fix (TraverseModal) | 25 changed-file violations + 2 tree-wide stragglers |

**Total cleared:** 959 → 0 remaining (2026-08-03, Batch 5 complete). Full-repo eslint sweep: 0 `label-has-associated-control` errors. Also 0 literal `aria-label=\"{label}\"`/`\"{column}\"`/`\"{h}\"`/value-as-name bugs tree-wide (grep-verified).

## Current state — 0 violations remaining (Batch 5 complete, 2026-08-03)

All tiers cleared. Files fixed in Batch 5 (group label → `<div>` unless noted):

- Tools: `height-of-object`, `tacheometry` (×2 each), `leveling`, `sectional-properties`, `volume-comparison` (AnalysisTab + page), `contour-generator/SettingsTab`, `encumbrance`, `cassini-utm/InputForm` (htmlFor/id wiring), `cassini-utm/SubSheetInspector`
- Shared: `TraverseModal` (div + junk aria-label fix), `PlanPromotionPanel` (Radix controlComponents + aria-label), `EngineeringComputePanel`, `BridgePanel`, `AIPlanChecker`, `AdversePossessionCalc`, `ImageryViewer`, `SuperelevationCalculator`, `VerticalCurveCalculator`, `TraverseComputePanel`, `GCPOptimizerPanel`, `GNSSRoverConnection`, `NeighborConsensusForm`, `GenerateReportModal` (useId htmlFor/id)
- Workflow: `equipment/page.tsx`

## Established fix pattern (consistent across all batches)

- **Real form control** → wire `htmlFor` + `id` pair; visible label becomes the accessible name; drop redundant placeholder-style `aria-label`s.
- **Group/composite label** (labels a button group, custom widget, or text readout, not a control) → convert `<label>` to `<div>`.
- **Repeated rows in maps** → unique per-row ids (`obs-${i}-*`, `mp-road-width-${i}`, etc.).
- Custom `Input`/`Select` primitives forward `...props`, so `id` passes through.

## Remaining work

✅ All done — 0 violations codebase-wide. The permanent gate is the CI lint ratchet (`scripts/lint-gate.mjs` in `ci.yml`), which blocks new warnings on changed files. The rule stays `error`.

## Aria-label gate (2026-08-03) — bans placeholder-like / junk accessible names

`scripts/aria-label-gate.mjs` (wired into `ci.yml` + `pr-checks.yml` as a blocking step)
scans every `aria-label` in `src/` and fails on 5 junk classes so tables/forms can't
regress generic or placeholder-copy names:

| Class | Example | Fix applied |
|---|---|---|
| `empty` | `aria-label=""` | real description or remove |
| `punctuation` | `aria-label="—"` | real description |
| `generic` | `"Field value"`, `"Text input"`, `"Cell value"` | visible-label wiring (`htmlFor`/`id`), `col.label`, or removal |
| `crunched` | `"Surveyorname"`, `"Pointid"`, `"Instrumentheight"`, `"Labelrowsas"` | spaced names (`"Surveyor name"`, `"Point ID"`) or drop redundant aria-label where a visible label exists |
| `placeholder-equals-name` | `aria-label="0.000" placeholder="0.000"` (96 instances) | real description in aria-label, placeholder kept as sample value (`e.g. 250.00`) or aria-label removed where `<label htmlFor>` exists |

Day-one sweep cleared **102 violations across 31 files** (96 placeholder-equals-name,
3 crunched, 3 generic). The crunched check is single-token-only so dynamic labels
(`'Measure point ${pointId}'`) and units (`'Design Pressure (kPa)'`) aren't false-flagged.
`jsx-a11y/aria-proptypes` also flipped to `error` (was already 0 violations tree-wide).

## GNSS grid cleanup + axe-core WCAG sweep (2026-08-03)

### Header-derived accessible names in the editable grids

Replaced placeholder-as-name and junk `aria-label`s across the data-grid components
with real, column-header-derived accessible names so every grid cell has a
meaningful name (and no colliding duplicate `id`s):

- `TraverseBook.tsx` — HCL/HCR/VA sub-columns now named by group+sub-column
  (`"HCL (Face Left) — Deg"`, `"HCR (Face Right) — Min"`, `"VA (DMS) — Sec"`, …);
  placeholder-as-name `"100.000"` → `"SD (m)"`; `"Ih"`/`"Th"` → `"IH (m)"`/`"TH (m)"`
- `TraverseModal.tsx` — radial observations: every row previously rendered duplicate
  `id="point"/"deg"/"min"/"sec"` (invalid colliding HTML) AND junk `aria-label`s
  (`"P1"`, `"000"`, `"00"`) that overrode the visible labels; now unique per-row ids
  (`rad-point-${idx}`…) wired to the `htmlFor`s, junk labels removed so the visible
  label names the field. Traverse legs table: `"TP01"` → `"Station"`, `"Distance"` →
  `"Distance (m)"`, `"D"/"M"/"S"` → `"Bearing (DMS) — Deg/Min/Sec"`
- `QuickAddModal.tsx` / `UniversalMobileObservationForm.tsx` — audited, already clean
  (0 aria-labels; all `htmlFor`/`id` pairs matched)

### Multi-page axe-core WCAG sweep (`scripts/axe-gnss-scan.mjs`, extended 2026-08-04)

The scanner is now a **full multi-page sweep** — not just the two GNSS pages.
It discovers every route from the filesystem (`src/app/tools/**/page.tsx` → 90
tool pages) plus the protected routes (`/fieldbook`, `/admin`, `/admin/payments`,
`/admin/users`), scans them with axe-core (WCAG 2.x tag set) through a shared
browser context, and prints a per-page violation table:

```bash
node scripts/axe-gnss-scan.mjs                     # all routes, text table
node scripts/axe-gnss-scan.mjs --paths gnss        # substring-filtered subset
node scripts/axe-gnss-scan.mjs --json              # machine-readable stdout
node scripts/axe-gnss-scan.mjs --report out/axe.md # markdown report (default axe-sweep-report.md)
node scripts/axe-gnss-scan.mjs --login             # authenticate (auto-on for protected routes)
```

**CI ratchet mode** (exit 1 on any regression):

```bash
node scripts/axe-gnss-scan.mjs --write-baseline .axe-baseline.json   # snapshot current state
node scripts/axe-gnss-scan.mjs --ci --fail-on serious --baseline .axe-baseline.json
```

- `--ci` fails on any violation at/above `--fail-on` (default `serious`) **and**
  on any per-rule node-count increase vs. the baseline (ratchet: new rules or
  more nodes on an existing rule both fail the build).
- `--paths`/`--exclude` substring filters, `--concurrency N` (default 4) pool.
- Login runs once in the shared context so the session cookie persists across
  all scanned pages (creds via `AXE_USER`/`AXE_PASS`, defaults match the e2e
  test user).
- Route hydration is generic (body text + interactive controls) with explicit
  hints for the two heavy GNSS pages; unhydratable routes are reported as
  `hydrate-failed` (exit 2 in CI) instead of silently producing a blank scan.
- Report/baseline artifacts (`axe-sweep-report.md`, `.axe-baseline.json`) are
  gitignored.

Uses the `AXE_SCAN_PORT` env var (NOT `PORT` — the Freebuff desktop shell sets
`PORT=53757`, which silently redirected the scan to the shell server;
root-caused and fixed).

| Violation | Count | Root cause | Fix |
|---|---|---|---|
| `button-name` [critical] | 2 (1 per page) | QuickCompute panel close button is icon-only with no accessible name (shared component, so it flagged every page) | `aria-label="Close Quick Compute panel"` in `src/components/layout/QuickCompute.tsx` |
| `color-contrast` [serious] | 71 | `--text-muted: #666666` fails 4.5:1 on the dark surfaces (#050505/#080808/#111111) — labels, table headers, footer citations, stat text | `--text-muted` → `#8A8A8A` in `globals.css` dark theme (5.85:1 on #050505, 5.47:1 on #111111; still dimmer than `--text-secondary` #A0A0A0). Light + field modes untouched |

Also verified on both pages: the amber/red fix-type text passed (no contrast nodes),
table `th`/row-header semantics passed (no axe violations), and focus order in the
editable grids is clean DOM order (44 focusables on the observation log). Re-scan
after the fixes: **0 axe violations on both pages** (verified after a dev-server
restart cleared a stale SSR bundle that was masking the QuickCompute fix).

### Gate re-verification (unchanged by this sweep)

The GNSS sweep touched only `aria-label`s and a CSS color token — it did not touch any
label↔control association, so the `jsx-a11y/label-has-associated-control` count is
unchanged. Re-run of every gate on 2026-08-03:

- Whole-repo eslint (exact CI command `npx eslint middleware.ts src/ --ext .ts,.tsx`):
  **0 errors** across 1846 files; **0 `label-has-associated-control` errors**
- `next lint`: 0 errors; 0 `label-has-associated-control`
- `node scripts/aria-label-gate.mjs`: OK — 0 junk aria-labels
- Only remaining jsx-a11y signal tree-wide: 1 pre-existing warning
  (`jsx-a11y/alt-text`, warn-level)

### ESLint-level enforcement (2026-08-04): `metardu/no-placeholder-as-aria-label`

New committed local plugin `eslint-plugin-metardu/` (a `file:` devDependency so
it resolves in editor, `next lint`, the lint ratchet, and CI). Its rule is an
AST version of the junk-aria-label classification — registered as an **error**
in `.eslintrc.json` (`metardu/no-placeholder-as-aria-label`). It fires on any
new empty/punctuation/generic/crunched/placeholder-equals-name `aria-label` in
the editor and in the changed-files lint ratchet (`lint-gate.mjs`), so this bug
class can't return.

Same day, the rule caught **39 real regressions** the regex gate had missed —
root cause was a scanner bug (FIND #2): a `<` from a plain-JS comparison
(`d < 0`) started a bogus "tag" and the scanner silently walked to EOF, dropping
all later tags. The gate now (a) skips `<` not followed by a JSX-tag-start char
and (b) bails gracefully at EOF, and both consumers share ONE classification
module (`eslint-plugin-metardu/shared/junk-classification.cjs`) so they can
never drift. The 39 regressions were fixed across 8 files (labels/ids wired,
placeholder-as-name labels removed or given header-derived names), and four
orphan labels surfaced by the audit were wired to their controls.

Tests: `tests/eslint-rules/no-placeholder-as-aria-label.test.ts` (RuleTester, 22
cases) + `tests/aria-label-gate.test.ts` (scanner regression + parity, 8 cases).

### CI wiring (2026-08-04): axe sweep in `ci.yml` + `pr-checks.yml`

A dedicated `axe-sweep` job runs in both workflows (parallel job, 20-min
timeout). It boots a headless Next dev server (`npx next dev -p 3100` on
`AXE_SCAN_PORT`) with a readiness poll, installs Playwright's bundled
chromium (`npx playwright install --with-deps chromium` — the script prefers
`channel:'chrome'` and falls back to bundled chromium with `--no-sandbox`),
then runs the **hard gate**:

```bash
node scripts/axe-gnss-scan.mjs --ci --fail-on minor --no-baseline \
  --exclude fieldbook,admin --concurrency 6
```

- `--fail-on minor` = **fails on ANY violation** (not just serious+).
- `--no-baseline` = pure threshold gate (no `.axe-baseline.json` needed; the
  ratchet would otherwise demand a baseline file).
- `--exclude fieldbook,admin` = protected routes are skipped because this job
  has no seeded Postgres + login; including them would mark them `auth-failed`
  and fail every run. A DB-backed job for protected routes is future work.
- `axe-sweep-report.md` is uploaded as an artifact (`if: always()`), and the
  dev server is killed in a teardown step (`if: always()`).

## Verification command

```bash
npx eslint middleware.ts src/ --ext .ts,.tsx --max-warnings 0   # whole-repo gate → 0 errors
node scripts/aria-label-gate.mjs                                 # → OK — 0 junk aria-labels
npx jest tests/eslint-rules tests/aria-label-gate.test.ts --coverage=false   # rule + gate regression tests
node scripts/axe-gnss-scan.mjs --paths gnss --ci --fail-on serious   # → targeted sweep: CI PASSED
node scripts/axe-gnss-scan.mjs --ci --fail-on minor --no-baseline --exclude fieldbook,admin  # CI gate command
```
