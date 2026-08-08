# Whole-Repo ESLint Warning Zero Remediation Plan

## Current Status (August 2026)

- **Total Whole-Repo Warnings**: `6,355` (down from initial 20,000 ceiling, and 7,283 floor baseline).
- **CI Ceiling (`--max-warnings`)**: `10,000` (tightened in `.github/workflows/ci.yml` and `pr-checks.yml`).
- **A11y Audit Scope**: 1,855 files (0 findings committed).
- **API Row Typing**: 532 / 532 queries typed across 253 route files (0 untyped).

## Decoupled Family Floors

| Family / Rule | Floor Baseline |
| :--- | :--- |
| `@typescript-eslint/no-unsafe-member-access` | **1,588** |
| `@typescript-eslint/no-unsafe-assignment` | **974** |
| `@typescript-eslint/no-explicit-any` | **676** |
| `@typescript-eslint/no-unsafe-argument` | **334** |
| `db.query untyped` | **0** |

## Remediation Strategy to Zero

1. **Member-Access Grind**: Continue batch-typing top UI components and domain handlers (`FieldbookQuickActions`, `MobileFieldbookShell`, `rinex.ts`, `topographic-survey`).
2. **Assignment & Explicit-Any Sweeps**: Replace unsafe `any` callback signatures with strong TypeScript interfaces.
3. **Argument Floor Ratcheting**: Enforce `no-unsafe-argument` in `lint-gate.mjs` changed-files gate and `lint-ratchets.mjs`.
4. **API Schema Alignment**: Ensure all route handlers validate request/response payloads through shared `src/lib/validation` schemas.
