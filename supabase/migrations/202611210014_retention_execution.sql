-- Prepared locally. Default disabled; no Storage calls or deletion acknowledgements.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210013_media_metadata') THEN RAISE EXCEPTION 'Migration 013 required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210014_retention_execution') THEN RAISE EXCEPTION 'Migration 014 already applied.';END IF;
END $$;
ALTER TABLE farm_private.media_cleanup ADD COLUMN media_id uuid REFERENCES public.farm_media(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX farm_one_media_retention_job ON farm_private.media_cleanup(media_id) WHERE media_id IS NOT NULL AND state<>'done';
CREATE TABLE farm_private.retention_configuration(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,source_ref text);
INSERT INTO farm_private.retention_configuration(singleton) VALUES(true);
CREATE TABLE farm_private.backup_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_ref text NOT NULL,set_id text NOT NULL,manifest_sha256 text NOT NULL,verified_at timestamptz NOT NULL,restore_drill_verified boolean NOT NULL CHECK(restore_drill_verified),offsite boolean NOT NULL CHECK(offsite),UNIQUE(source_ref,set_id,manifest_sha256));
ALTER TABLE farm_private.retention_configuration ENABLE ROW LEVEL SECURITY;ALTER TABLE farm_private.backup_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.retention_configuration,farm_private.backup_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.farm_retention_configure(p_source_ref text,p_enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_source_ref IS NULL OR p_source_ref!~'^[a-z0-9]{20}$' OR p_enabled IS NULL THEN RAISE EXCEPTION 'Explicit source project and enablement required.';END IF;
 UPDATE farm_private.retention_configuration SET source_ref=p_source_ref,enabled=p_enabled WHERE singleton;RETURN true;
END $$;
CREATE FUNCTION public.farm_retention_backup_record(p_receipt jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ref text;v_id uuid;v_time timestamptz;
BEGIN
 SELECT source_ref INTO v_ref FROM farm_private.retention_configuration WHERE singleton AND enabled;
 IF v_ref IS NULL OR p_receipt->>'sourceRef' IS DISTINCT FROM v_ref OR p_receipt->>'offsite' IS DISTINCT FROM 'true' OR p_receipt->>'restoreDrillVerified' IS DISTINCT FROM 'true' OR (p_receipt->>'manifestSha256')!~'^[a-f0-9]{64}$' OR coalesce(length(p_receipt->>'setId'),0) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Independent configured backup/restore proof required.';END IF;
 v_time:=(p_receipt->>'verifiedAt')::timestamptz;
 IF v_time IS NULL OR v_time>clock_timestamp() OR v_time<clock_timestamp()-interval '36 hours' THEN RAISE EXCEPTION 'Backup proof is stale or invalid.';END IF;
 INSERT INTO farm_private.backup_receipts(source_ref,set_id,manifest_sha256,verified_at,restore_drill_verified,offsite) VALUES(v_ref,p_receipt->>'setId',p_receipt->>'manifestSha256',v_time,true,true) ON CONFLICT(source_ref,set_id,manifest_sha256) DO UPDATE SET verified_at=EXCLUDED.verified_at RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE FUNCTION public.farm_retention_execute(p_plan_id uuid,p_receipt_id uuid,p_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ref text;v_plan farm_private.media_retention_plans;v_receipt farm_private.backup_receipts;v_revision public.farm_revisions;v_media public.farm_media;v_count integer:=0;v_queued integer:=0;v_paths text[];v_id uuid;v_head integer;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'Bounded retention limit required.';END IF;
 SELECT source_ref INTO v_ref FROM farm_private.retention_configuration WHERE singleton AND enabled FOR UPDATE;
 IF v_ref IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Retention execution disabled.';END IF;
 SELECT * INTO v_receipt FROM farm_private.backup_receipts WHERE id=p_receipt_id;
 IF v_receipt.id IS NULL OR v_receipt.source_ref<>v_ref OR v_receipt.verified_at>clock_timestamp() OR v_receipt.verified_at<clock_timestamp()-interval '36 hours' OR NOT v_receipt.offsite OR NOT v_receipt.restore_drill_verified THEN RAISE EXCEPTION 'Verified fresh off-site restore-capable backup required.';END IF;
 SELECT * INTO v_plan FROM farm_private.media_retention_plans WHERE id=p_plan_id FOR UPDATE;
 IF v_plan.id IS NULL OR v_plan.created_at<clock_timestamp()-interval '1 hour' OR v_receipt.verified_at<v_plan.created_at THEN RAISE EXCEPTION 'Fresh plan with newer verified backup required.';END IF;
 FOR v_id IN SELECT value::uuid FROM jsonb_array_elements_text(v_plan.plan->'expiredRevisionIds') LIMIT p_limit LOOP
  SELECT c.draft_revision INTO v_head FROM public.farm_content c JOIN public.farm_revisions r ON r.content_id=c.id WHERE r.id=v_id FOR UPDATE OF c;
  SELECT * INTO v_revision FROM public.farm_revisions WHERE id=v_id FOR UPDATE;
  IF v_revision.id IS NOT NULL AND v_revision.created_at<=clock_timestamp()-interval '90 days' AND v_revision.revision<>v_head THEN
   DELETE FROM public.farm_media_usages WHERE revision_id=v_revision.id;DELETE FROM public.farm_revisions WHERE id=v_revision.id;v_count:=v_count+1;
  END IF;
 END LOOP;
 FOR v_id IN SELECT value::uuid FROM jsonb_array_elements_text(v_plan.plan->'purgeMediaIds') LIMIT p_limit LOOP
  SELECT * INTO v_media FROM public.farm_media WHERE id=v_id FOR UPDATE;
  IF v_media.id IS NULL OR v_media.deleted_at IS NULL OR v_media.deleted_at>clock_timestamp()-interval '30 days' THEN CONTINUE;END IF;
  PERFORM id FROM public.farm_media_versions WHERE media_id=v_id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.farm_media_versions v JOIN public.farm_media_usages u ON u.media_version_id=v.id WHERE v.media_id=v_id) OR EXISTS(SELECT 1 FROM public.farm_media_versions v JOIN farm_private.release_media_refs u ON u.media_version_id=v.id WHERE v.media_id=v_id) OR EXISTS(SELECT 1 FROM farm_private.media_cleanup WHERE media_id=v_id AND state<>'done') THEN CONTINUE;END IF;
  SELECT array_agg(p.path) INTO v_paths FROM(SELECT original_path path FROM public.farm_media_versions WHERE media_id=v_id AND state='ready' UNION SELECT preview_path FROM public.farm_media_versions WHERE media_id=v_id AND state='ready')p;
  IF cardinality(v_paths)>0 THEN
   INSERT INTO farm_private.media_cleanup(media_id,paths) VALUES(v_id,v_paths);UPDATE public.farm_media_versions SET state='quarantined' WHERE media_id=v_id AND state='ready';v_queued:=v_queued+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('state','queued','prunedRevisions',v_count,'queuedMedia',v_queued);
END $$;
DO $$ DECLARE f regprocedure;BEGIN FOREACH f IN ARRAY ARRAY['public.farm_retention_configure(text,boolean)'::regprocedure,'public.farm_retention_backup_record(jsonb)'::regprocedure,'public.farm_retention_execute(uuid,uuid,integer)'::regprocedure] LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);END LOOP;END $$;
-- Recovery expiry does not purge rows or bypass backup-gated retention.
CREATE OR REPLACE FUNCTION public.farm_content_trash_list() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'revision',c.draft_revision,'payload',c.payload,'updated_at',c.updated_at,'deleted_at',c.deleted_at) ORDER BY c.deleted_at DESC,c.id),'[]'::jsonb)
 INTO v_result FROM public.farm_content AS c WHERE c.deleted_at>clock_timestamp()-interval '30 days';
 RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.farm_content_untrash(p_id uuid,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NULL OR v_row.deleted_at<=clock_timestamp()-interval '30 days' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Trashed content is unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Content revision conflict.';END IF;
 UPDATE public.farm_content AS c SET deleted_at=NULL,draft_revision=c.draft_revision+1,updated_at=clock_timestamp(),review_only=true WHERE c.id=p_id RETURNING * INTO v_row;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'content_trash','restored',p_id);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

INSERT INTO farm_private.schema_migrations(version) VALUES('202611210014_retention_execution');NOTIFY pgrst,'reload schema';COMMIT;
