# Security as Routine — How Changes Get Into METARDU

**Status:** active policy
**Audience:** everyone who merges to `main`
**Why this doc exists:** the 2026-08 security remediation landed as a single
89-file, +2.5k/−27k-line commit. Nobody could review it, and it shipped a
C-01 regression (re-leaked secrets in a docs file) that went undetected until
a second cleanup pass. Execution isn't our gap — reviewability is. This doc
makes reviewability a process, not a hope.

---

## 1. Stack your PRs instead of growing one

Large changes ship as **stacked PRs**, each reviewable in one sitting.

**Rule of thumb:** ≤ ~400 intent-bearing changed lines per PR. ("Intent-bearing"
excludes lockfiles, generated files, and pure renames.) Not a hard limit — a
600-line test fixture addition is fine; a 600-line mixed refactor+feature is
not.

**Pattern for a multi-part change:**

```
main
 └─ #401 feat(db): migration 058 — boundary_monument_conditions   [schema only]
     └─ #402 feat(security): projectAccess checks for monuments    [uses 058]
         └─ #403 feat(api): monument condition endpoints            [uses both]
             └─ #404 feat(tools): monument condition UI             [uses #403]
```

Each PR merges only after its parent. GitHub's "merge queue + stacked
branches" or `ghstack` both work; plain `main`-rebased branches are fine for
small stacks.

**What this buys us:** a revert is one small PR, not a forensics project; a
reviewer can actually verify a security fix instead of trusting it; CI failure
pinpoints one change.

**The one exception:** mechanical codemods applied by tooling (rename, import
path migration) may be one big PR — but it must contain *zero* semantic edits,
and the PR description must say which tool produced it.

## 2. The PR checklist is load-bearing

`.github/pull_request_template.md` renders a checklist on every PR. The
security section is **blocking** for any PR that touches:

- `src/app/api/**` (any route)
- `src/lib/security/**`, `src/lib/auth.ts`, `src/lib/apiHandler.ts`
- `src/lib/db/migrations/**`
- `src/lib/payments/**` or any payments/subscription route
- `src/middleware.ts`

Reviewers **must not** approve a blocking PR with unticked security boxes
unless the ticked items genuinely don't apply — and the PR author states why
in the PR description ("N/A: route adds no new id-based access" is enough).

Every checklist item cites the historical finding it prevents. When a NEW
class of vulnerability is found (in this repo or in the wild), it gets a new
checkbox here first, then lands in code.

## 3. Secrets policy

1. **Source of truth:** environment variables on the VM, injected via
   deployment secrets. Never in code, config, docs, or comments.
2. **Local:** `gitleaks protect --staged` before every commit (pre-push hook
   also scans pushed commits — see `.gite/hooks/pre-push`); `npm run
   security:gitleaks-local` scans the working tree.
3. **CI:** `.github/workflows/gitleaks.yml` scans every push and PR against
   the pinned gitleaks v8.24.3 ruleset, failing on any leak NOT in
   `.gitleaks-baseline.json`.
4. **If a secret lands in git history anyway:** rotate it FIRST (a leaked
   credential that isn't rotated isn't remediated, whatever else you do),
   then decide baseline vs. history rewrite. Never allowlist the value.
   **Open item:** the baseline contains one real `POSTGRES_PASSWORD` from
   commit 8c433880 (notes/Admin Users.md) — rotated-pending; rotate the VM
   postgres password and this entry becomes moot.
5. **.env.example** documents variable names with empty or obviously-fake
   placeholder values only.
6. **Upgrading gitleaks:** re-fetch the matching default ruleset and re-run
   `python3 scripts/merge-gitleaks.py` (see the script header). A custom
   config with no `[[rules]]` scans with ZERO rules — the silent no-op
   failure mode caught while setting this gate up.

## 4. When a security fix ships

Fixes for audit findings get their own PR per finding (or tightly-related
finding group), containing:

- the fix,
- a regression test that fails on the pre-fix code,
- a `docs/AUDIT.md` / audit-table status update.

If a fix can't be tested without prod infra (e.g. IP allowlist behaviour),
the PR must include the manual verification runbook used instead.

## 5. Quarterly rhythm (not more, not less)

- Re-run the full-repo gitleaks scan with an EMPTY baseline (temporary), diff
  against the committed baseline — anything new is either a leak or needs a
  documented allowlist.
- Review the allowlists in `.gitleaks.toml`: delete entries that no longer
  match anything.
- Re-check `docs/AUDIT.md` open items (C5, C7, C9, H5, H9 remain open as of
  2026-08) and either schedule them or explicitly de-scope with a written
  rationale.
- Verify the deploy environment still matches `.env.example` — any drift is
  documented or eliminated.
