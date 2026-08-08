# Member Access & Typing Remediation Plan

## Dominant Any Sources Taxonomy & Current Counts

Fresh snapshot from `scripts/lint-ratchets.mjs --report`:

- **Member Access Floor**: `1,588` (down from 2,052 baseline)
- **Assignment Floor**: `974` (down from 1,107 baseline)
- **Explicit Any Floor**: `676` (down from 816 baseline)
- **Argument Floor**: `334` (decoupled floor initialized)

### Key Workstreams Remaining
1. `FieldbookQuickActions` (36) & `MobileFieldbookShell` (32)
2. `rinex.ts` (28) & Total Station import handlers (`parseGSI`, `parseSDR`, `parseTopcon`)
3. `TraverseDiagram.tsx` (16) & `CadastralComputeIntegration.tsx` (16)
4. `/tools/topographic-survey/page.tsx` (16) & `/project/[id]/scheme/page.tsx` (16)

## Verification Loop

```bash
# Update family floors individually
node scripts/lint-ratchets.mjs --update-member-access
node scripts/lint-ratchets.mjs --update-assignment
node scripts/lint-ratchets.mjs --update-explicit-any
node scripts/lint-ratchets.mjs --update-argument

# Snapshot overall warnings baseline
node scripts/lint-ratchets.mjs --update
node scripts/lint-ratchets.mjs --report
```
