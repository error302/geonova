# Phase 13: Submission Package Handoff Implementation TODO

Current progress: 0/6 phases complete.

## Breakdown of Approved Plan

### Phase 1: Database Schema & Types (Workstreams 1,3)
- [x] 1. Create supabase/migrations/20260402_phase13_submissions.sql (project_submissions table, submission_sequence, increment function, ALTER projects for new fields: lr_number, folio_number, etc.) ✓
- [x] 2. Create src/types/submission.ts (ProjectSubmission interface, SUBMISSION_SECTIONS const, etc.) ✓

### Phase 2: Core Submission Lib (Workstreams 2,3,7,9)
- [x] 3. Create src/lib/submission/surveyorProfile.ts (getActiveSurveyorProfile) ✓
- [x] 4. Create src/lib/submission/numbering.ts (generateSubmissionNumber, incrementRevision) ✓
- [x] 5. Create src/lib/submission/checklist.ts (BOUNDARY_ATTACHMENT_SLOTS) ✓
- [x] 6. Create src/lib/submission/assembleSubmission.ts + validateSubmissionPackage ✓

### Phase 3: Reports & Exports (Workstreams 5,6,8)
- [x] 7. Update src/lib/reports/surveyReport/index.ts (inject submission_number to header/footer) ✓
- [x] 8. Create src/lib/submission/workbook/generateWorkbook.ts (XLSX benchmark sheets) ✓
- [x] 9. Create src/lib/export/generateShapefile.ts (shp-write-based ZIP) ✓

### Phase 4: Deduplication & Unification (Workstream 10,2)
- [x] 10. Update src/app/project/[id]/page.tsx (replace surveyor props with getActiveSurveyorProfile, add 'submission' step) ✓
- [x] 11. Redirect/Delete src/app/project/[id]/workspace/page.tsx ✓

### Phase 5: Submission UI (Workstreams 4)
- [ ] 12. Create src/app/project/[id]/submission/page.tsx (manifest, checklist, generate/validate/export)
- [ ] 13. Create src/components/import/DWGImportGuidance.tsx
- [ ] 14. Update src/lib/reports/surveyPlan/renderer.ts + types.ts (Form No. 4 title block, coord tables, insets)

### Phase 6: Polish & Test
- [ ] 15. Install deps (shpwrite @types/shpwrite), run migrations, test end-to-end (all 10 test cases)
- [ ] 16. attempt_completion

**Next step: Phase 1 Step 1 - Create submissions migration**

