<!--
METARDU PR checklist — every item below traces to a real, previously-shipped
finding in this repo (IDs in brackets reference the 2026-08 security audit and
docs/AUDIT.md). Tick the boxes that apply; N/A items may be left unticked but
reviewers may ask why. A PR touching /api/** or /lib/security/** with unticked
security boxes cannot be merged — see docs/SECURITY_ROUTINE.md.
-->

## What & why

<!-- One or two sentences: what this changes and why. Link the issue/audit ID. -->

Audit/issue ref:

## Change surface

- [ ] Touches API routes (`src/app/api/**`)
- [ ] Touches DB schema (new migration under `src/lib/db/migrations/`)
- [ ] Touches payments (M-Pesa / PayPal / subscription entitlement)
- [ ] Touches auth, sessions, or RBAC
- [ ] Touches cadastral data paths (parcels, deed plans, beacons, traverses)
- [ ] Adds a new tool page under `src/tools/**` or `src/app/tools/**`
- [ ] Touches CI workflows or gate scripts
- [ ] None of the above

## Security checklist — REQUIRED for any `/api/**`, `/lib/security/**`, or migration change

<!-- These map one-to-one to findings we have actually shipped and fixed.
     Skip only the boxes that are genuinely unreachable for this change. -->

- [ ] **Auth**: every new/changed route uses `apiHandler` with an explicit
      `auth` decision (default is authenticated; public is opt-in and justified
      in a comment). [audit C-02, H-06 — inverted permission checks shipped once]
- [ ] **Authorization / IDOR**: every route that reads or writes by id
      (`project_id`, `job_id`, `submission_id`, …) checks ownership via
      `projectAccess.ts` or an equivalent scoped query — including for admin
      roles. [H-05 — six IDOR routes shipped once]
- [ ] **No secrets**: no credentials, tokens, hostnames, or passwords in code,
      config, docs, or comments — secrets come from env vars / Secrets.
      Ran `gitleaks protect --staged` locally. [C-01 — leaked twice, incl. a
      regression in a docs file]
- [ ] **SQL**: parameterized queries only; any queryBuilder update/delete has a
      WHERE clause (the builder must refuse otherwise); no string-concatenated
      SQL. [C-02]
- [ ] **Input validation**: request bodies/params validated via
      `src/lib/validation/apiSchemas.ts` schemas, not hand-rolled checks.
- [ ] **Rate limiting**: new public or expensive endpoints get a limiter;
      keying uses the rightmost XFF hop / CF-Connecting-IP, and the limiter
      fails CLOSED in prod. [H-08]
- [ ] **Payments (if touched)**: amounts verified server-side against the
      payment intent (fail-closed), plan derived from intent not client,
      credits are transactional + idempotent (test for double-delivery).
      [C-03, C-05, H-01, H-02, H-03]
- [ ] **RLS (if new table)**: migration enables RLS + policies consistent with
      existing tenant scoping; checked `docs/DB_SCHEMA_AUDIT.md` conventions.
      [audit H2 history]
- [ ] **Audit chain (if cadastral data mutated)**: route wires the
      `auditChain` option so mutations land in `audit_chain`. [audit C3]
- [ ] **Admin routes**: role check reads the role from DB (cached ≤60s), not
      from a client-supplied token claim; suspension re-checked. [H-07]

## Correctness & quality

- [ ] `tsc --noEmit` clean; `eslint` clean on changed files
- [ ] Tests added or updated for the behavior change (not just line coverage)
- [ ] Geodetic/math changes (anything under `src/lib/geo/**`, `src/lib/topo/**`):
      include a known-value test — a coordinate round-trip or a golden value
      from an authoritative source (proj4/pyproj, EPSG dataset, Survey of
      Kenya sheet). Zero-tolerance: wrong math here is a legal liability.
- [ ] New tool pages: keyboard-operable, labelled controls (axe-core runs in
      CI; do not introduce new violations)
- [ ] If this PR intentionally changes tool gating (`TOOL_GATES` registry),
      tests in `src/lib/subscription/__tests__/toolGates.test.ts` updated

## Migrations (delete if none)

- [ ] File numbered sequentially after the current highest migration
- [ ] Tested against a copy of production-shaped data, not just empty tables
      (054 once referenced nonexistent columns and silently blocked 055–057)
- [ ] Includes down-path or is explicitly documented as irreversible

## Merge hygiene

- [ ] PR is ≤ ~400 changed lines of intent-bearing code, or is split into a
      stack (see docs/SECURITY_ROUTINE.md — the 89-file remediation commit is
      the cautionary tale: it shipped a C-01 regression nobody could review)
- [ ] No merge-commit noise; rebased onto main

## Reviewer notes

<!-- What should a reviewer look at hardest? Where are you least confident? -->
