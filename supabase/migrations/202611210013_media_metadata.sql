-- Prepared locally only: editorial CAS, complete usage, recoverable soft deletion.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170009_media_content_refs')
 OR NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210012_release_commands') THEN RAISE EXCEPTION 'Migrations 009 and 012 are required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210013_media_metadata') THEN RAISE EXCEPTION 'Migration 013 already applied; do not rerun.';END IF;
END $$;
CREATE TABLE farm_private.media_metadata_revisions(
 media_id uuid NOT NULL REFERENCES public.farm_media(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0),editorial jsonb NOT NULL CHECK(jsonb_typeof(editorial)='object'),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(media_id,revision)
);
ALTER TABLE farm_private.media_metadata_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.media_metadata_revisions FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION farm_private.validate_media_editorial(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text;v jsonb;max_length integer;
BEGIN
 IF p_value IS NULL OR jsonb_typeof(p_value)<>'object' OR octet_length(p_value::text)>20000 THEN RETURN false;END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_value) LOOP
  IF k IN('displayName','altText','description','credit','licence','source','provenance','folder') THEN
   max_length:=CASE k WHEN 'displayName' THEN 160 WHEN 'altText' THEN 500 WHEN 'description' THEN 2000 WHEN 'credit' THEN 300 WHEN 'licence' THEN 300 WHEN 'source' THEN 2048 WHEN 'provenance' THEN 2000 ELSE 120 END;
   IF jsonb_typeof(v)<>'string' OR length(p_value->>k)>max_length OR (p_value->>k)~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RETURN false;END IF;
   IF k='source' AND p_value->>k<>'' AND (p_value->>k)!~'^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' THEN RETURN false;END IF;
  ELSIF k='tags' THEN
   IF jsonb_typeof(v)<>'array' THEN RETURN false;END IF;
   IF jsonb_array_length(v)>20 THEN RETURN false;END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(v) t WHERE jsonb_typeof(t)<>'string' OR length(btrim(t#>>'{}')) NOT BETWEEN 1 AND 50 OR (t#>>'{}')~'[[:cntrl:]]') THEN RETURN false;END IF;
  ELSIF k='focalPoint' THEN
   IF jsonb_typeof(v)<>'object' THEN RETURN false;END IF;
   IF (SELECT count(*) FROM jsonb_object_keys(v))<>2 OR NOT(v?'x' AND v?'y') OR jsonb_typeof(v->'x')<>'number' OR jsonb_typeof(v->'y')<>'number' THEN RETURN false;END IF;
   IF (v->>'x')::numeric NOT BETWEEN 0 AND 1 OR (v->>'y')::numeric NOT BETWEEN 0 AND 1 THEN RETURN false;END IF;
  ELSE RETURN false;
  END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION farm_private.validate_media_editorial(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.farm_media_metadata_read(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_media;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT m.* INTO v_row FROM public.farm_media m WHERE m.id=p_id;
 IF v_row.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Photograph unavailable.';END IF;
 RETURN jsonb_build_object('id',v_row.id,'revision',v_row.revision,'editorial',coalesce(v_row.metadata->'editorial','{}'::jsonb),'technical',v_row.metadata-'editorial','deletedAt',v_row.deleted_at);
END $$;
CREATE FUNCTION public.farm_media_trash_list() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_result jsonb;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'revision',m.revision,'editorial',coalesce(m.metadata->'editorial','{}'::jsonb),'technical',m.metadata-'editorial','deletedAt',m.deleted_at) ORDER BY m.deleted_at DESC),'[]'::jsonb) INTO v_result
 FROM (SELECT z.* FROM public.farm_media z WHERE z.deleted_at>clock_timestamp()-interval '30 days' AND EXISTS(SELECT 1 FROM public.farm_media_versions v WHERE v.media_id=z.id AND v.state='ready') ORDER BY z.deleted_at DESC,z.id LIMIT 200) m;
 RETURN v_result;
END $$;
CREATE FUNCTION public.farm_media_metadata_save(p_id uuid,p_base_revision integer,p_editorial jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_media;
BEGIN
 v_user:=farm_private.require_content_admin();
 IF farm_private.validate_media_editorial(p_editorial) IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid editorial metadata.';END IF;
 SELECT m.* INTO v_row FROM public.farm_media m WHERE m.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.farm_media_versions WHERE media_id=p_id AND state='ready') THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Photograph unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Photograph revision conflict.';END IF;
 INSERT INTO farm_private.media_metadata_revisions(media_id,revision,editorial,actor_id) VALUES(v_row.id,v_row.revision,coalesce(v_row.metadata->'editorial','{}'::jsonb),v_user) ON CONFLICT DO NOTHING;
 UPDATE public.farm_media SET metadata=jsonb_set(metadata,'{editorial}',p_editorial),revision=revision+1 WHERE id=p_id RETURNING * INTO v_row;
 INSERT INTO farm_private.media_metadata_revisions(media_id,revision,editorial,actor_id) VALUES(v_row.id,v_row.revision,p_editorial,v_user);
 RETURN public.farm_media_metadata_read(p_id);
END $$;
CREATE FUNCTION public.farm_media_usage(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_revisions jsonb;v_releases jsonb;
BEGIN
 v_user:=farm_private.require_content_admin();
 IF NOT EXISTS(SELECT 1 FROM public.farm_media WHERE id=p_id) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Photograph unavailable.';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('revisionId',r.id,'contentId',r.content_id,'revision',r.revision,'createdAt',r.created_at,'currentDraft',c.draft_revision=r.revision,'deletedAt',c.deleted_at) ORDER BY r.created_at DESC),'[]'::jsonb) INTO v_revisions
 FROM public.farm_media_usages u JOIN public.farm_media_versions v ON v.id=u.media_version_id JOIN public.farm_revisions r ON r.id=u.revision_id JOIN public.farm_content c ON c.id=r.content_id WHERE v.media_id=p_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('releaseId',q.release_id,'createdAt',q.created_at) ORDER BY q.created_at DESC),'[]'::jsonb) INTO v_releases FROM
 (SELECT DISTINCT r.id release_id,r.created_at FROM farm_private.release_media_refs u JOIN farm_private.releases r ON r.id=u.release_id JOIN public.farm_media_versions v ON v.id=u.media_version_id WHERE v.media_id=p_id) q;
 RETURN jsonb_build_object('id',p_id,'revisions',v_revisions,'releases',v_releases,'protected',jsonb_array_length(v_revisions)>0 OR jsonb_array_length(v_releases)>0,'revisionRetentionDays',90,'trashRetentionDays',30);
END $$;
-- Preserve every saved-content guard from 008, add release references, and stop
-- eager object cleanup. Ready bytes remain private and recoverable for 30 days.
CREATE OR REPLACE FUNCTION public.farm_media_remove(p_actor_cookie_hash text,p_media_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_media;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT m.* INTO v_row FROM public.farm_media m WHERE m.id=p_media_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.farm_media_usages u JOIN public.farm_media_versions v ON v.id=u.media_version_id WHERE v.media_id=p_media_id)
 OR EXISTS(SELECT 1 FROM farm_private.release_media_refs u JOIN public.farm_media_versions v ON v.id=u.media_version_id WHERE v.media_id=p_media_id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Photograph is referenced by saved content or a release.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.farm_media_versions WHERE media_id=p_media_id AND state='ready') THEN RETURN false;END IF;
 UPDATE public.farm_media SET deleted_at=clock_timestamp(),revision=revision+1 WHERE id=p_media_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','soft_deleted',p_media_id);
 RETURN true;
END $$;
CREATE FUNCTION public.farm_media_restore(p_id uuid,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_media;
BEGIN
 v_user:=farm_private.require_content_admin();
 -- Serialize capacity checks with upload reservations (same guard-before-media order).
 PERFORM g.active_count FROM farm_private.admin_guard g WHERE g.singleton FOR UPDATE;
 IF (SELECT count(*) FROM public.farm_media WHERE deleted_at IS NULL)>=200 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Photo library capacity reached.';END IF;
 SELECT m.* INTO v_row FROM public.farm_media m WHERE m.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NULL OR v_row.deleted_at<=clock_timestamp()-interval '30 days' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Recoverable photograph unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Photograph revision conflict.';END IF;
 -- Pre-013 eager removals were quarantined; their bytes may already be gone.
 IF NOT EXISTS(SELECT 1 FROM public.farm_media_versions WHERE media_id=p_id AND state='ready') THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Recoverable photograph bytes unavailable.';END IF;
 UPDATE public.farm_media SET deleted_at=NULL,revision=revision+1 WHERE id=p_id RETURNING * INTO v_row;
 INSERT INTO farm_private.media_metadata_revisions(media_id,revision,editorial,actor_id) VALUES(p_id,v_row.revision,coalesce(v_row.metadata->'editorial','{}'::jsonb),v_user);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','restored_draft',p_id);
 RETURN public.farm_media_metadata_read(p_id)||jsonb_build_object('restoredAs','draft');
END $$;
-- Durable, reviewable inventory only. There is no execution/ack/delete function.
CREATE TABLE farm_private.media_retention_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),plan jsonb NOT NULL,
 CHECK(plan->>'preparedOnly'='true' AND plan->>'deleteEnabled'='false')
);
ALTER TABLE farm_private.media_retention_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.media_retention_plans FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.farm_media_retention_prepare() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_id uuid:=gen_random_uuid();v_plan jsonb;v_revisions jsonb;v_media jsonb;v_bytes bigint;v_now timestamptz:=clock_timestamp();
BEGIN
 v_user:=farm_private.require_content_admin();
 -- A plan does not imply these rows or bytes were removed. Current heads survive.
 SELECT coalesce(jsonb_agg(r.id ORDER BY r.created_at,r.id),'[]'::jsonb) INTO v_revisions
 FROM public.farm_revisions r JOIN public.farm_content c ON c.id=r.content_id
 WHERE r.created_at<=v_now-interval '90 days' AND r.revision<>c.draft_revision;
 -- All existing usage links hold bytes until a fresh inventory proves them gone.
 SELECT coalesce(jsonb_agg(m.id ORDER BY m.deleted_at,m.id),'[]'::jsonb) INTO v_media
 FROM public.farm_media m WHERE m.deleted_at<=v_now-interval '30 days'
 AND EXISTS(SELECT 1 FROM public.farm_media_versions v WHERE v.media_id=m.id)
 AND NOT EXISTS(SELECT 1 FROM public.farm_media_versions v JOIN public.farm_media_usages u ON u.media_version_id=v.id WHERE v.media_id=m.id)
 AND NOT EXISTS(SELECT 1 FROM public.farm_media_versions v JOIN farm_private.release_media_refs u ON u.media_version_id=v.id WHERE v.media_id=m.id);
 SELECT coalesce(sum(CASE WHEN (m.metadata->>'byteSize')~'^[0-9]{1,10}$' THEN (m.metadata->>'byteSize')::bigint ELSE 0 END),0) INTO v_bytes FROM public.farm_media m;
 v_plan:=jsonb_build_object('id',v_id,'asOf',v_now,'preparedOnly',true,'deleteEnabled',false,'revisionRetentionDays',90,'trashRetentionDays',30,'expiredRevisionIds',v_revisions,'purgeMediaIds',v_media,'originalBytes',v_bytes,'storageEstimateNote','Original bytes only; previews, staging and provider overhead are additional.');
 INSERT INTO farm_private.media_retention_plans(id,actor_id,created_at,plan) VALUES(v_id,v_user,v_now,v_plan);
 RETURN v_plan;
END $$;
DO $$ DECLARE p regprocedure;BEGIN
 FOREACH p IN ARRAY ARRAY['public.farm_media_retention_prepare()'::regprocedure,'public.farm_media_trash_list()'::regprocedure,'public.farm_media_metadata_read(uuid)'::regprocedure,'public.farm_media_metadata_save(uuid,integer,jsonb)'::regprocedure,'public.farm_media_usage(uuid)'::regprocedure,'public.farm_media_restore(uuid,integer)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',p);
 END LOOP;
END $$;
INSERT INTO farm_private.schema_migrations(version) VALUES('202611210013_media_metadata');
NOTIFY pgrst,'reload schema';
COMMIT;
