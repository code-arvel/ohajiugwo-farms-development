-- Persistent draft editing with user-JWT access and revision compare-and-swap.
-- Additive to the approved foundation; never edits or resets existing records.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170004_reauthentication') THEN RAISE EXCEPTION 'Migration 004 is required.';END IF;
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170006_account_lifecycle') THEN RAISE EXCEPTION 'Migration 006 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170007_content_commands') THEN RAISE EXCEPTION 'Content commands migration already applied; do not rerun.';END IF;
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT c.payload->>'slug' FROM public.farm_content AS c WHERE c.kind='post' AND c.deleted_at IS NULL
  GROUP BY c.payload->>'slug' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Resolve duplicate active post slugs before migration 007; existing content was not changed.';
 END IF;
END $$;
CREATE UNIQUE INDEX farm_content_active_post_slug ON public.farm_content((payload->>'slug'))
 WHERE kind='post' AND deleted_at IS NULL;

CREATE FUNCTION farm_private.require_content_admin() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR public.farm_has_active_session() IS NOT TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 RETURN v_user;
END $$;
REVOKE ALL ON FUNCTION farm_private.require_content_admin() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.farm_content_list() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'revision',c.draft_revision,'payload',c.payload,'updated_at',c.updated_at,'deleted_at',c.deleted_at) ORDER BY c.updated_at DESC,c.id),'[]'::jsonb)
 INTO v_result FROM public.farm_content AS c WHERE c.deleted_at IS NULL;
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_content_read(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT jsonb_build_object('id',c.id,'kind',c.kind,'revision',c.draft_revision,'payload',c.payload,'updated_at',c.updated_at,'deleted_at',c.deleted_at)
 INTO v_result FROM public.farm_content AS c WHERE c.id=p_id AND c.deleted_at IS NULL;
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_content_history(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 IF NOT EXISTS(SELECT 1 FROM public.farm_content AS c WHERE c.id=p_id) THEN RETURN NULL;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('revision',r.revision,'payload',r.payload,'created_at',r.created_at) ORDER BY r.revision DESC),'[]'::jsonb)
 INTO v_result FROM public.farm_revisions AS r WHERE r.content_id=p_id;
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_content_trash_list() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'revision',c.draft_revision,'payload',c.payload,'updated_at',c.updated_at,'deleted_at',c.deleted_at) ORDER BY c.deleted_at DESC,c.id),'[]'::jsonb)
 INTO v_result FROM public.farm_content AS c WHERE c.deleted_at IS NOT NULL;
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_content_save(p_id uuid,p_kind text,p_base_revision integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;v_id uuid:=coalesce(p_id,gen_random_uuid());v_next integer;
BEGIN
 v_user:=farm_private.require_content_admin();
 IF p_kind IS NULL OR p_kind NOT IN('homepage','post') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>1000000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid content document.';END IF;
 IF (p_kind='homepage' AND p_payload ? 'slug') OR (p_kind='post' AND (p_payload->>'status') IS DISTINCT FROM 'draft') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Only valid homepage or draft documents can be saved.';END IF;
 IF p_id IS NULL THEN
  IF p_base_revision IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='New content has no base revision.';END IF;
  INSERT INTO public.farm_content(id,kind,draft_revision,payload,review_only,deleted_at) VALUES(v_id,p_kind,1,p_payload,true,NULL) RETURNING * INTO v_row;
 ELSE
  SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Content is unavailable.';END IF;
  IF v_row.kind IS DISTINCT FROM p_kind THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Content kind cannot be changed.';END IF;
  IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Content revision conflict.';END IF;
  v_next:=v_row.draft_revision+1;
  UPDATE public.farm_content AS c SET kind=p_kind,draft_revision=v_next,payload=p_payload,review_only=true,updated_at=clock_timestamp() WHERE c.id=p_id RETURNING * INTO v_row;
 END IF;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

CREATE FUNCTION public.farm_content_restore(p_id uuid,p_revision integer,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;v_payload jsonb;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Content is unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Content revision conflict.';END IF;
 SELECT r.payload INTO v_payload FROM public.farm_revisions AS r WHERE r.content_id=p_id AND r.revision=p_revision;
 IF v_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Revision is unavailable.';END IF;
 UPDATE public.farm_content AS c SET draft_revision=c.draft_revision+1,payload=v_payload,review_only=true,updated_at=clock_timestamp() WHERE c.id=p_id RETURNING * INTO v_row;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

CREATE FUNCTION public.farm_content_trash(p_id uuid,p_base_revision integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL OR v_row.kind<>'post' THEN RETURN false;END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Content revision conflict.';END IF;
 UPDATE public.farm_content AS c SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE c.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'content_trash','trashed',p_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_content_untrash(p_id uuid,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Trashed content is unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Content revision conflict.';END IF;
 UPDATE public.farm_content AS c SET deleted_at=NULL,draft_revision=c.draft_revision+1,updated_at=clock_timestamp(),review_only=true WHERE c.id=p_id RETURNING * INTO v_row;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'content_trash','restored',p_id);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

DO $$ DECLARE v_proc regprocedure;BEGIN
 FOREACH v_proc IN ARRAY ARRAY['public.farm_content_list()'::regprocedure,'public.farm_content_read(uuid)'::regprocedure,'public.farm_content_history(uuid)'::regprocedure,'public.farm_content_trash_list()'::regprocedure,'public.farm_content_save(uuid,text,integer,jsonb)'::regprocedure,'public.farm_content_restore(uuid,integer,integer)'::regprocedure,'public.farm_content_trash(uuid,integer)'::regprocedure,'public.farm_content_untrash(uuid,integer)'::regprocedure] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role',v_proc);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',v_proc);
 END LOOP;
END $$;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170007_content_commands');
NOTIFY pgrst,'reload schema';
COMMIT;
