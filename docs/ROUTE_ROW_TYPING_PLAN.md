# Route Row-Typing Plan (api-row-sweep)

Ranked batch plan for the remaining API-route typing work, generated from
`node scripts/api-row-sweep.mjs --json` (live ESLint member-access counts +
query extraction). Scope: every `src/**/route.ts` (tests excluded).

**Status snapshot (generated 2026-08-06):**

| Metric | Value |
|---|---|
| Route files total | 253 |
| db.query/client.query calls | 532 (139 typed, **393 untyped**) |
| Files with ≥1 untyped query | 122 |
| Route files with member-access warnings | 60 |
| **Remaining route-tier member-access** | **159** |

The route/API tier is the *most-cleared* area of the member-access grind — the
159 remaining warnings are all single-digit-per-file (down from ~250 a few
batches ago). The real remaining route work is **untyped queries (393)**:
member-access on an untyped `db.query` row shows up only when the route reads
`rows[0].x`; routes that pass rows through unread don't warn, so `--check`
(the CI row-typing gate) is the correct regression guard and `--apply` is the
tool that fixes them fast.

---

## Plan A — member-access density (159 warnings · 1 batch at ~400)

The whole route tier fits in ONE batch under the ~400-warning target. Order =
member-access count desc (typing these rows clears the warnings directly):

```
 9  src/app/api/corridor-networks/route.ts
 9  src/app/api/projects/[id]/approve/route.ts
 9  src/app/api/health/route.ts
 7  src/app/api/documents/logo/route.ts
 6  src/app/api/fieldbook/audit/route.ts
 6  src/app/api/signature/sign/route.ts
 5  src/app/api/auth/register/route.ts
 5  src/app/api/admin/health/route.ts
 4  src/app/api/payments/route.ts
 4  src/app/api/survey-points/route.ts
 4  src/app/api/versions/[id]/restore/route.ts
 4  src/app/api/sync/route.ts
 4  src/app/api/user/onboarding/route.ts
 4  src/app/api/render/submit/route.ts
 4  src/app/api/topo/export/shapefile/route.ts
 3  src/app/api/notifications/route.ts
 3  src/app/api/submissions/create/route.ts
 3  src/app/api/auth/register-complete/route.ts
 3  src/app/api/signature/sign-pdf/route.ts
 3  src/app/api/public/metrics/route.ts
 3  src/app/api/topo/export/dxf/route.ts
 3  src/app/api/weather/route.ts
 2  src/app/api/import/commit/route.ts
 2  src/app/api/marketplace/listings/[id]/route.ts
 2  src/app/api/projects/[id]/parcels/batch/route.ts
 2  src/app/api/projects/[id]/route.ts
 2  src/app/api/versions/route.ts
 2  src/app/api/admin/users/[userId]/suspend/route.ts
 2  src/app/api/equipment/calibration/route.ts
 2  src/app/api/activity/route.ts
 2  src/app/api/ai/chat/route.ts
 2  src/app/api/auth/update-password/route.ts
 2  src/app/api/feedback/route.ts
 2  src/app/api/gnss/process/route.ts
 2  src/app/api/professional-memberships/[id]/verify/route.ts
 2  src/app/api/subscription/project-count/route.ts
 2  src/app/api/geo/transform/route.ts
 2  src/app/api/deed-plan/generate/route.ts
 1  (22 more files at 1 warning each — rim, mpesa, engineering/ips, equipment,
     marketplace, projects, storage, submission, admin/users, fieldbook/sync,
     workers/job, payments/paypal, python/* exports, …)
```

Recipe per file: `node scripts/api-row-sweep.mjs --apply <route>` → review the
generated interface (types, `| null`, `RETURNING *` columns) → remove redundant
`rows[0] as Record<string, unknown>` casts → tsc → re-baseline.

---

## Plan B — untyped-query density (393 untyped · 122 files)

Order = untyped-query count desc (the `--apply` grind metric). Highest files:

```
 13  src/app/api/payments/route.ts
 12  src/app/api/webhooks/stripe/route.ts
 10  src/app/api/rim/route.ts
  9  src/app/api/payments/mpesa/callback/route.ts
  9  src/app/api/scheme/traverse/route.ts
  8  src/app/api/engineering/ips/route.ts
  7  src/app/api/auth/register/route.ts
  7  src/app/api/webhooks/paypal/route.ts
  7  src/app/api/auth/reset-password/route.ts
  7  src/app/api/scheme/submission/route.ts
  6  src/app/api/corridor-networks/route.ts
  6  src/app/api/survey-points/route.ts
  6  src/app/api/notifications/route.ts
  6  src/app/api/drone/process/route.ts
  6  src/app/api/scheme/parcels/route.ts
  5  (projects/[id]/approve, import/commit, marketplace/listings/[id],
      projects/[id]/parcels/batch, projects/[id], versions, equipment/[id]/calibration,
      equipment, engineering/earthworks, engineering/stations, survey-plan/export/dxf)
  4  (versions/[id]/restore, admin/users/[userId]/suspend, marketplace/inquiries,
      projects, storage, engineering/alignment, project/[id]/export/ifc,
      scheme/assign, scheme/blocks, workers/process, admin/users/[userId],
      compute/export/traverse-dxf, engineering/vips, profile/settings,
      scheme/activity, scheme/import, submission/generate, subscription)
  3  (documents/logo, admin/health, submissions/create, equipment/calibration,
      payments/mpesa/initiate, submission/form-c22, scheme/blocks/[id],
      scheme/parcels/[id], admin/users/[userId]/verify-isk, …)
  2  (import/share-target, …)
  1  (project-count, geo/transform, cleaned-datasets, health, …)
```

Because both totals are below the ~400-warning target, **one commit clears each
plan**; for smaller reviewable PRs split Plan B at ~130 untyped queries
(files 13→7, then 6→4, then 3→1).

---

## Recommended order

1. **Plan A first** (159 member-access) — typing the rows clears live warnings
   and the floors re-baseline down immediately. Use `--apply` + review.
2. **Plan B** (393 untyped) — this is what makes the `--check` CI gate fully
   green on any PR touching these files. `--apply` per file + review, then
   `--check` re-runs to confirm.

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
node scripts/api-row-sweep.mjs --json > scripts/_api-rows.json
node scripts/_tmp-batch-plan.mjs 400   # Plan A + Plan B tables
```
