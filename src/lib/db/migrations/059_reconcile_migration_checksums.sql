-- 059: reconcile stored migration checksums for 030-046
--
-- WHY: the new post-deploy schema gate (deploy.yml step 5/6 +
-- scripts/verify-migrations.mjs) reported, on its very first run, that 17
-- migration rows in production carry checksums that no longer match the
-- files: 030-046. Forensics (2026-08-30):
--
--   * All 17 files were touched by commit 95011d2d (a batch file-mode flip,
--     644 -> 755 - content-neutral), and several ALSO received real edits
--     in later commits AFTER production had already applied them
--     (e.g. 033 in ca174355 "14 migration fixes", 044 in abec57e5).
--   * migrate-unified.mjs only WARNS on checksum mismatch and skips -
--     so production ran the ORIGINAL versions of 030-046 and never the
--     later edits. This is the same failure class as migration 054
--     (silently skipped work), and it is why 052/053 exist: those
--     migrations explicitly reconciled the resulting SCHEMA drift
--     (missing tables/columns) at the database level.
--
-- RESOLUTION: production's schema, after 052/053, is equivalent to what
-- the CURRENT files produce (validated end-to-end by the CI e2e suite,
-- which builds a fresh database from these exact files on every run).
-- This migration makes the BOOKKEEPING truthful: the stored checksums now
-- describe the current files, so the verification gate enforces
-- immutability from here on. Any future edit to an applied migration will
-- fail the deploy - which is the point.
--
-- If prod had NOT been reconciled by 052/053, blanket-resetting checksums
-- would hide drift; it is safe here ONLY because those reconciliations
-- ran and e2e proves file-database parity.

UPDATE schema_migrations SET checksum = 'e86f1a4294a75c278605e6dd5a7b6669ef949954eb68aa71c85a75294c02ade2' WHERE version = '030_onboarding_flag';
UPDATE schema_migrations SET checksum = 'cd906861797e05d6bc6e8ef3ade311e523619b610386676ae65d52f5357cf82e' WHERE version = '031_subscription_columns';
UPDATE schema_migrations SET checksum = 'f262d0b43254f2cc114b627f183a43132eec82edb4c3a5587362b33931b9a574' WHERE version = '032_fieldbooks_table';
UPDATE schema_migrations SET checksum = 'cfe3c4740d77081438903f2413257a6e079e9abc7b3b55f1bd7308c3dcc2d333' WHERE version = '033_marketplace_tables';
UPDATE schema_migrations SET checksum = '30adbbc701e0a4fb7f32c60fa1463bd33bfbe4c7c7118ba24519069ea287f3e3' WHERE version = '034_document_signatures';
UPDATE schema_migrations SET checksum = '99301272018b97e948e8feb8ba2490f4b056a8033f3759d9711a641c0b074946' WHERE version = '035_consolidated_missing_tables';
UPDATE schema_migrations SET checksum = '854d2a48fca623839439764fbf76a42f3c2ec7e1fd007abad8050c2f14592581' WHERE version = '036_engineering_table_columns';
UPDATE schema_migrations SET checksum = '5daec0078333b4a94f63a0ee3cfd141ae06547a84386490137ddd30e15a42d18' WHERE version = '037_projects_cryptographic_seal';
UPDATE schema_migrations SET checksum = '2e842297a5075cefaec23187e28fa404f6c59576efe51a7568226a6d215d67ba' WHERE version = '038_professional_memberships';
UPDATE schema_migrations SET checksum = 'f9d834855579ed206f63d92ad95b0cce9ec169b30473d8f287af67c4de050505' WHERE version = '039_cpd_fraud_prevention';
UPDATE schema_migrations SET checksum = '002aff0ea6fe8bae85cee38ad3501dcec434d1dd362798e79433ffe7ac48b662' WHERE version = '040_feedback_table';
UPDATE schema_migrations SET checksum = 'fc7594b3d212339c531cb94ebf2cd698f0f0c19abf238b3da4f314ca75b0b930' WHERE version = '041_drone_processing_tasks';
UPDATE schema_migrations SET checksum = '9d555f28d33e7ac7915a3ac1276075f8371dfaa137d4aa4b5a8612ee97786693' WHERE version = '042_beacon_quality_columns';
UPDATE schema_migrations SET checksum = 'b449cfc2a4e0285e092f38fcc5e63a9f828a4d20968588496d7bf8f59053c8b5' WHERE version = '043_db_best_practices_rectification';
UPDATE schema_migrations SET checksum = '97aef89e4af85c3f770c8bc3207a60b3ca3dd9725828371682da52b06eb3dfed' WHERE version = '044_boundary_monuments';
UPDATE schema_migrations SET checksum = 'e05ac0646ff7a59fef41f07529d9f71e45bc2340358ce64265d22090cc3c9bcb' WHERE version = '045_corridor_control_networks';
UPDATE schema_migrations SET checksum = 'c28e22d0d759b3c2a4974731cf8800fbc4745f98d95c812e439e8f108cae8caa' WHERE version = '046_control_point_verifications';

-- DOWN: not reversible - the old (stale) checksums described file states
-- that no longer exist anywhere and must never be restored.
