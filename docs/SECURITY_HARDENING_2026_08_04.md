# Security Hardening — XSS-Class & SQL-Injection Inventory (2026-08-04)

Companion to `docs/AUDIT.md` and `scripts/sql-injection-proof.ts`. This documents the
remaining-sink sweep: every user-controlled value interpolated into HTML/SVG strings
and every string-interpolated SQL identifier in the query builder, with the fix or
the reason it is safe.

---

## 1. SQL injection — queryBuilder.ts (VULN-001 + upsert hardening)

**Fixed in this pass:** `src/lib/db/queryBuilder.ts`

| Path | Before | After |
|------|--------|-------|
| `table` in `from()`/`table()` | interpolated raw | `validateIdentifier()` (letters/digits/underscore + optional schema dot) |
| `select` columns + `selectRaw` | interpolated raw | `buildSelectColumns()` → `validateIdentifier()` per column; raw fragments regex-constrained |
| filter column keys (where/having) | interpolated raw | `validateIdentifier()` |
| `order` column | interpolated raw | `validateIdentifier()` |
| upsert `onConflict` / payload column keys | interpolated raw | `validateIdentifier()` |
| `or()`/`parseOrFilter` column | interpolated raw | regex `^(\w+)\.(\w+)\.(.+)$` + `validateIdentifier()` on the column (defense-in-depth; regex already excludes quotes/spaces) |
| `returningColumns` | interpolated raw at execution | `buildReturningColumns()` validates the list at execution time (`returningColumns` is private, always `'*'`, never settable — documented in code) |
| `limit`/`offset` | string-injected into SQL | integer coercion (`Number()` + `Number.isInteger`) |

**Evidence:** `scripts/sql-injection-proof.ts` → **ALL 9 ATTACKS BLOCKED** (drop, UNION,
comment breakout, multi-row upsert key injection, etc.). Regression tests in
`tests/queryBuilder.test.ts` (31 tests pass) cover the `or()`/`parseOrFilter` and
`returningColumns` paths, including the two documented behaviors: a fragment that
matches the regex but fails the allowlist is blocked with an `Invalid column` error,
and quote/space breakout fragments are dropped so the payload never reaches SQL.

**Caller audit:** `src/app/api/db/route.ts` maps incoming JSON to the builder; the
route passes only whitelisted operation + table names, and filter/order/upsert params
flow exclusively through the validated builder paths above. No other interpolated
identifiers remain.

---

## 2. Map popups — textContent rendering (VULN-002)

Confirmed fixed (all render user-entered point/parcel/station/LR names via
`textContent`, never `innerHTML`):

- `src/app/map/hooks/useMapInteractions.ts`
- `src/components/workspace/WorkspaceMap.tsx`
- `src/app/beacons/page.tsx`
- `src/app/project/[id]/scheme/page.tsx`
- `src/app/project/[id]/scheme/map/page.tsx`
- `src/components/fieldguard/AnomalyHeatmap.tsx`
- `src/lib/map/schemeLayer.ts` — `renderSchemePopup()` (the reference pattern) +
  the header `label` `<span>` converted from `innerHTML` to a `createElement`+`textContent` pair

---

## 3. Print / export HTML & SVG sinks — escaped in this pass

| File | Sink | Fix |
|------|------|-----|
| `src/components/RegistryIndexMap.tsx` | `${sheetId}` interpolated into `<title>` (RCDATA breakout) | `escapeXml(sheetId)` + clone content node instead of `innerHTML` re-parse |
| `src/components/SurveyPlanExport.tsx` | `sigData.signerName`/`iskNumber` into SVG string → `container.innerHTML` | `escapeXml()` both |
| `src/components/mutationplan/MutationPlanGenerator.tsx` | `projectInfo.name` into print `<title>` | `escapeXml()` |
| `src/components/TraverseFieldBook.tsx` | print `document.write(html)` | values already `esc()`-ed; verified |
| `src/lib/reports/documentPackage.ts` | 7 point-name interpolations in coordinate/beacon tables | wrapped in the existing `esc()` helper |
| `src/components/engineering/RoadCompletionCertificatePanel.tsx` | print HTML with certificate/defect/signature fields | `escapeHtml()` on all interpolated fields |
| `src/lib/engineering/progressMonitor.ts` | report HTML with project/section values | `escapeHtml()` |

**Verified-safe (no user data, or already escaped):**
- `src/app/map/MapClient.tsx` `renderPopup` — innerHTML only for static label spans; all user values via `textContent`
- `src/components/visualization/TIN3DViewer.tsx` — `innerHTML = ''` clears container; fallback string is a static literal
- `src/lib/print/buildPrintDocument.ts` — every interpolated field goes through `esc()` (11 call sites)
- `src/components/cad-editor/CADEditor.tsx` — SVG export via `XMLSerializer` (DOM-sourced, not string-interpolated)
- `src/lib/reports/surveyPlan/renderer.ts`, `formNo3Renderer.ts`, `deedPlanRenderer.ts` — all user text wrapped in `escapeXml()`
- `src/app/project/[id]/documents/page.tsx` — print via `buildPrintDocument` (escaped above)

---

## 4. Validation evidence (fresh, 2026-08-04)

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Jest | `npx jest` | 144 suites, 2269 passed, 1 skipped |
| SQL-injection proof | `npx tsx scripts/sql-injection-proof.ts` | **ALL 9 ATTACKS BLOCKED** |
| Changed-files lint gate (CI ratchet) | `node scripts/lint-gate.mjs origin/main <252 files>` | **OK** — 4260 warnings vs base 4395 (net −135), 0 errors |
| a11y label gate (whole repo) | `eslint src/ middleware.ts --quiet \| grep -c label-has-associated-control` | **0** |
| Junk aria-label gate | `node scripts/aria-label-gate.mjs` | **OK — 0 junk across 687 files** |
