-- READ ONLY. Run as owner/postgres in existing ohajiugwo-development.
-- No credentials, provider identifiers or email addresses are returned.
SELECT
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210014_retention_execution') AS migration_014_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250015_session_reconciliation') AS migration_015_present,
 EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611250016_account_email_delivery') AS migration_016_present,
 to_regclass('auth.sessions') IS NOT NULL AS auth_sessions_present,
 to_regclass('auth.refresh_tokens') IS NOT NULL AS auth_refresh_tokens_present,
 has_table_privilege(current_user,'auth.sessions','DELETE') AS owner_can_delete_sessions;
