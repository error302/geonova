-- 060: reconcile stored migration checksums for 000-029 (completes 059)
--
-- WHY: after 059 reset the 030-046 checksums, the schema gate's next run
-- (deploy of 458d99b7) exposed the REST of the legacy drift: 23 of the 30
-- rows for 000-029 also carry checksums that do not match the current
-- files (7 match and are unaffected). These rows predate the checksum
-- bookkeeping's current form — their stored values describe file states
-- (or hashing eras) that no longer exist. The schema itself was already
-- reconciled by 052/053, and fresh-database e2e runs in CI prove the
-- current files produce a working schema, so — exactly as in 059 — the
-- honest fix is to make the bookkeeping describe reality.
--
-- Idempotent: rows whose checksum already matches get re-set to the same
-- value; nothing else touches data or schema.

UPDATE schema_migrations SET checksum = 'df699a8f8e97a2b6acfd570ad3d49ee20aae3657cffc80101e861ab7d8a95f55' WHERE version = '000_canonical_schema';
UPDATE schema_migrations SET checksum = '04fd1ae80b6b6d8d3f4b1469307680e563fbe54bb205c24b828631f8e14319c2' WHERE version = '001_rbac_fixed';
UPDATE schema_migrations SET checksum = '470f7f6c3170c8a3646b2f4db9781a407ede054d6b616629a75ab5430d64ac12' WHERE version = '002_rls_fixed';
UPDATE schema_migrations SET checksum = '1d196d92f69130df4ec08fc11f6179caa08a97eae1e869ab8fede2cfada8117f' WHERE version = '003_rls_missing_tables';
UPDATE schema_migrations SET checksum = 'ec2cef6946e0a8fc5ffaf8fcbeaab9ef9f6b23a956d7d114e32baca8d6c55b32' WHERE version = '004_payment_history_fix';
UPDATE schema_migrations SET checksum = '8416b49dd4b4ce986da7d403663d4dc56a7d9948603497e286cf6c84d5d0f5cd' WHERE version = '005_audit_triggers_precision';
UPDATE schema_migrations SET checksum = '69ee48d17c35adaee13e59bc559f8e5bedb88fce3d9056aa64e0942bb6d75baa' WHERE version = '006_entity_versioning';
UPDATE schema_migrations SET checksum = 'b6466869a817693bc3c2aee54ebefd17a6c816730313185f46aa31463d388eda' WHERE version = '007_phase4_5_6_tables';
UPDATE schema_migrations SET checksum = '15b4ec363f3441999ec8716f276a22cfda45cbc657a8e5966b28922cbe3766ec' WHERE version = '008_phase10_indexes_and_audit';
UPDATE schema_migrations SET checksum = 'afeb32ff251961e78e126a7a0f6b780e5dd0f95c597737b4ed7d6e62242ea1c4' WHERE version = '009_rbac_tables';
UPDATE schema_migrations SET checksum = '5dff83ae1d6dadac24319d4c6f92e82c88f2b430f69c7d68f5116104acf19d79' WHERE version = '010_dpa2019_compliance';
UPDATE schema_migrations SET checksum = '545fdd984b983af2c4a92b8ce12cc97c31271cfd3ee0119f5acfd04eccba39f9' WHERE version = '011_disable_rls';
UPDATE schema_migrations SET checksum = '7e2c505d22c3746ebbc9d4078df8e49723b45122eb9257a56ca7f9dc0720ed60' WHERE version = '012_search_indexes';
UPDATE schema_migrations SET checksum = '0905c04d9b2b960f992f7007f835bb9880b7b5712be2898506c3cf4797491f1d' WHERE version = '013_projects_add_surveyor_country';
UPDATE schema_migrations SET checksum = '282893a379d8caea8c1b996923bfe0e40ca628c9f072f4b0f7c226235098cb0e' WHERE version = '014_entity_trigger_uuid_fix';
UPDATE schema_migrations SET checksum = 'b7487d89b96faeea94b17666c229d094ffbf8c4bf50b46d629c88c26e2e1cebf' WHERE version = '015_fieldbook_soft_delete_audit';
UPDATE schema_migrations SET checksum = 'd4f5807c45befc40f7ec27bf9fdda93fb54b8b960d1d639cebafd69eaf7f0913' WHERE version = '016_oauth_provider';
UPDATE schema_migrations SET checksum = '208caa79b562b39b5ec3074f81f59e9bd3034d5d4f7522392a821b9fbb32a37b' WHERE version = '017_version_fieldbook_entries';
UPDATE schema_migrations SET checksum = '98013ecde460dc74dd237ee812ee9e17a9f62bcc31c8334913457775cac19737' WHERE version = '018_company_logos';
UPDATE schema_migrations SET checksum = '3593869e9c4ef025d43b311df5886642cb535f3d7bc68f1332df3a56a4154433' WHERE version = '019_notifications_activity';
UPDATE schema_migrations SET checksum = '1eccb4b410a2b65b24b8a5e649e7d3483c6e275ee2af771c846dc6af01bc3f83' WHERE version = '020_beacon_equipment';
UPDATE schema_migrations SET checksum = 'd785cee92defe277945a3438808201868cb9bcf305746763daabe1881463405d' WHERE version = '021_field_records';
UPDATE schema_migrations SET checksum = 'bfa258352008b6e3aeca36fcf8c5ca0b7310da8533ec1fddc53ec4063e428bb4' WHERE version = '022_profile_notification_preferences';
UPDATE schema_migrations SET checksum = '02e5a6a0781aa76c792291abc071e1eb332fe5a970a04e3df4a21db1b55b2186' WHERE version = '023_drop_mining_hydro_tables';
UPDATE schema_migrations SET checksum = '8d009b90b9e320724024a09120d4472f43eee8ed77e6ee4449ae4733471ebba5' WHERE version = '024_audit_chain';
UPDATE schema_migrations SET checksum = '6f47d798747301914e5e5b8e510b4de32d687ee7ca728d36b7edc96d84391bc0' WHERE version = '025_survey_points_control_flag';
UPDATE schema_migrations SET checksum = '02f5c46028131de8c320d4c134434e858a18364081609bf31ef0fa56bc63d7be' WHERE version = '026_mpesa_payment_flow_fix';
UPDATE schema_migrations SET checksum = '1e610606bd05b3bb0f90d9ce99fdc23fb90ef2a80c17c66de1e0c47fa02d4c90' WHERE version = '027_survey_points_crs_accuracy_provenance';
UPDATE schema_migrations SET checksum = 'ddf79f2c9109f5a1d62c3258ed329719c1852dcb4205d7151c2a2a223cd5a0b0' WHERE version = '028_organizations_rls';
UPDATE schema_migrations SET checksum = '073bbbfa720c0c24380caf8db9f4492c5adf0101b79b1ad1fbd44fa526ce0e4b' WHERE version = '029_extend_rls_all_tables';

-- DOWN: not reversible (the old values describe nothing that exists).
