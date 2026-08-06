# Route Row-Typing Plan (api-row-sweep)

Ranked batch plan for the remaining API-route typing work, generated live from
`node scripts/api-row-sweep.mjs` (member-access counts + query extraction).
Scope: every `src/**/route.ts` (tests excluded).

**Status snapshot (regenerated 2026-08-06):**

| Metric | Value |
|---|---|
| Route files total | 253 |
| db.query/client.query calls | 532 (325 typed, **207 untyped**) |
| Files with ≥1 untyped query | 84 |
| Route files with member-access warnings | 46 |
| **Remaining route-tier member-access** | **92** |

The route/API tier is the most-cleared area of the member-access grind — the
92 remaining warnings are all single-digit-per-file (down from 159 last plan
regeneration and ~250 before the Plan A/B route batches). The real remaining
route work is **untyped queries (207)**: member-access on an untyped
`db.query` row shows up only when the route reads `rows[0].x`; routes that
pass rows through unread don't warn, so `--check` (the CI row-typing gate) is
the correct regression guard and `--apply` is the tool that fixes them fast.

---

## Batch worklists — `--batch N`

The ranked worklist prints directly from the tool now (no JSON scratch step):

```bash
node scripts/api-row-sweep.mjs --batch N                 # per-line worklist for batch N
node scripts/api-row-sweep.mjs --batch N --batch-size S  # chunk size (default 30 untyped queries)
node scripts/api-row-sweep.mjs --batch 1 --untyped-only  # only the UN-TYPED lines in the batch
node scripts/api-row-sweep.mjs --batch 1 --no-member-scan  # same worklist, faster (no eslint pass)
```

Files are chunked into batches by **cumulative untyped-query count** in the
same order the Plan B ranking below produces (most untyped first); a file is
never split. Chunking by untyped queries (not member-access warnings) keeps
batches **identical under `--no-member-scan`** — untyped counts don't depend
on eslint, so the fast path prints the same deterministic worklist as a full
scan. Each worklist entry lists the file's declared row interfaces plus every
query line (line number, typed/untyped, table, suggested interface) so a
grind session starts from an exact per-line list. **Batch numbers are
computed live from the current scan and may differ between runs.**

With 207 untyped queries and the default `--batch-size 30`, the tier is
currently **8 batches** (30 / 30 / 30 / 30 / 30 / 30 / 30 / 1). Use a smaller
`--batch-size` for tighter PRs or a larger one to merge batches.

---

## Plan A — member-access density (92 warnings · 46 files)

Order = member-access count desc (typing these rows clears the warnings
directly). All 46 files:

```
 5  src/app/api/admin/health/route.ts
 4  src/app/api/render/submit/route.ts
 4  src/app/api/sync/route.ts
 4  src/app/api/topo/export/shapefile/route.ts
 4  src/app/api/user/onboarding/route.ts
 4  src/app/api/versions/[id]/restore/route.ts
 3  src/app/api/auth/register-complete/route.ts
 3  src/app/api/public/metrics/route.ts
 3  src/app/api/signature/sign-pdf/route.ts
 3  src/app/api/submissions/create/route.ts
 3  src/app/api/topo/export/dxf/route.ts
 3  src/app/api/weather/route.ts
 2  src/app/api/activity/route.ts
 2  src/app/api/admin/users/[userId]/suspend/route.ts
 2  src/app/api/ai/chat/route.ts
 2  src/app/api/auth/update-password/route.ts
 2  src/app/api/deed-plan/generate/route.ts
 2  src/app/api/equipment/calibration/route.ts
 2  src/app/api/feedback/route.ts
 2  src/app/api/geo/transform/route.ts
 2  src/app/api/gnss/process/route.ts
 2  src/app/api/import/commit/route.ts
 2  src/app/api/marketplace/listings/[id]/route.ts
 2  src/app/api/professional-memberships/[id]/verify/route.ts
 2  src/app/api/projects/[id]/parcels/batch/route.ts
 2  src/app/api/projects/[id]/route.ts
 2  src/app/api/subscription/project-count/route.ts
 1  (19 more files at 1 warning each — admin/users/[userId]/role,
     admin/users/override-plan, equipment/[id]/calibration, equipment,
     fieldbook/sync, marketplace/inquiries, payments/mpesa/initiate,
     payments/paypal/*, projects, python/export/*, python/raster,
     python/terrain, storage, submission/form-c22, form-no-4, sequence,
     workers/job)
```

Recipe per file: `node scripts/api-row-sweep.mjs --apply <route> --verify` →
review the generated interface (types, `| null`, `RETURNING *` columns) →
remove redundant `rows[0] as Record<string, unknown>` casts → tsc →
re-baseline (`--update-member-access`).

---

## Plan B — untyped-query density (207 untyped · 84 files)

Order = untyped-query count desc (the `--apply` grind metric). Distribution:
**5 untyped × 7 files, 4 × 13, 3 × 14, 2 × 28, 1 × 22** (169 files fully
typed). Grouped for reviewable commits:

```
5 untyped (7 files):
  src/app/api/import/commit/route.ts
  src/app/api/marketplace/listings/[id]/route.ts
  src/app/api/projects/[id]/parcels/batch/route.ts
  src/app/api/projects/[id]/route.ts
  src/app/api/equipment/[id]/calibration/route.ts
  src/app/api/equipment/route.ts
  src/app/api/survey-plan/export/dxf/route.ts

4 untyped (13 files):
  versions/[id]/restore, admin/users/[userId]/suspend, marketplace/inquiries,
  projects, storage, admin/users/[userId], compute/export/traverse-dxf,
  engineering/vips, profile/settings, scheme/activity, scheme/import,
  submission/generate, subscription

3 untyped (14 files):
  admin/health, submissions/create, equipment/calibration,
  payments/mpesa/initiate, submission/form-c22, admin/users/[userId]/verify-isk,
  audit-log, auth/forgot-password, beacon-description, beacons, field-records,
  professional-memberships, topo/import, white-label

2 untyped (28 files):
  sync, user/onboarding, auth/register-complete, signature/sign-pdf, activity,
  ai/chat, auth/update-password, feedback, gnss/process,
  professional-memberships/[id]/verify, subscription/project-count,
  admin/users/override-plan, fieldbook/sync, workers/job, ai/cadastra-validate,
  ai/clean-data, benchmarks/nearby, boundary-monuments,
  compute/export/shapefile, control-points/verifications, engineering/data,
  marketplace/listings, portfolio, project/[id]/network-adjustment,
  project/[id]/workflow, scheme/export/dxf, scheme/team, survey-points/[id]

1 untyped (22 files):
  render/submit, geo/transform, admin/users/[userId]/role, submission/form-no-4,
  submission/sequence, admin/announcements, admin/dashboard, admin/performance,
  analytics, cleaned-datasets, community/surveyors, drone/tasks, equipment/add,
  equipment/list, equipment/overdue-count, project/[id]/cross-sections,
  project/[id]/deed-plans, project/[id]/fieldbook, public/health,
  realtime/poll, scheme/traverse/history, import/share-target
```

Because both totals are small, **one `--batch 1` sweep clears the route tier**;
for smaller reviewable PRs split by untyped density (5→4→3→2→1).

---

## Recommended order

1. **Plan B first (207 untyped)** — this is what makes the `--check` CI gate
   fully green on any PR touching these files. Work through `--batch 1`…`8`:
   `--apply` per file + review, then `--check` re-runs to confirm.
2. **Plan A (92 member-access)** — typing the rows clears the last live
   warnings and the member-access floor re-baselines down. Mostly overlapping
   with Plan B (rows are untyped because the queries are).

## Per-batch verification (established recipe)

```bash
node scripts/api-row-sweep.mjs --check HEAD~10     # offender count → 0
npx tsc --noEmit                                    # type-safe after review
node scripts/lint-ratchets.mjs --update-member-access
node scripts/lint-ratchets.mjs --report             # floor must fall
npx jest <touched area>                             # routes touching libs
```

## Regenerating this plan

```bash
node scripts/api-row-sweep.mjs --batch 1            # live per-line worklist
node scripts/api-row-sweep.mjs --json               # machine-readable for the tables above
```
