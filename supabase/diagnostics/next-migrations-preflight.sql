-- READ ONLY. Run in existing ohajiugwo-development as owner/postgres.
-- Report flags only. This does not apply migrations or publish the website.
SELECT
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') AS migration_011_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210012_release_commands') AS migration_012_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210013_media_metadata') AS migration_013_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210014_retention_execution') AS migration_014_present;
