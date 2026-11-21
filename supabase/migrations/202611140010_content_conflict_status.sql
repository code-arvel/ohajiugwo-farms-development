-- Revision conflicts are application conflicts, never serialization retries.
-- Additive migration 010 only. Do not rerun 001–009. No content/account writes.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170009_media_content_refs') THEN RAISE EXCEPTION 'Migration 009 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140010_content_conflict_status') THEN RAISE EXCEPTION 'Migration 010 already applied; do not rerun.';END IF;
END $$;

CREATE OR REPLACE FUNCTION public.farm_content_save(p_id uuid,p_kind text,p_base_revision integer,p_payload jsonb) RETURNS jsonb
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
  IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Content revision conflict.';END IF;
  v_next:=v_row.draft_revision+1;
  UPDATE public.farm_content AS c SET kind=p_kind,draft_revision=v_next,payload=p_payload,review_only=true,updated_at=clock_timestamp() WHERE c.id=p_id RETURNING * INTO v_row;
 END IF;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

CREATE OR REPLACE FUNCTION public.farm_content_restore(p_id uuid,p_revision integer,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;v_payload jsonb;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Content is unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Content revision conflict.';END IF;
 SELECT r.payload INTO v_payload FROM public.farm_revisions AS r WHERE r.content_id=p_id AND r.revision=p_revision;
 IF v_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Revision is unavailable.';END IF;
 UPDATE public.farm_content AS c SET draft_revision=c.draft_revision+1,payload=v_payload,review_only=true,updated_at=clock_timestamp() WHERE c.id=p_id RETURNING * INTO v_row;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

CREATE OR REPLACE FUNCTION public.farm_content_trash(p_id uuid,p_base_revision integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL OR v_row.kind<>'post' THEN RETURN false;END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Content revision conflict.';END IF;
 UPDATE public.farm_content AS c SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE c.id=p_id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'content_trash','trashed',p_id);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.farm_content_untrash(p_id uuid,p_base_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_row public.farm_content;
BEGIN
 v_user:=farm_private.require_content_admin();
 SELECT c.* INTO v_row FROM public.farm_content AS c WHERE c.id=p_id FOR UPDATE;
 IF v_row.id IS NULL OR v_row.deleted_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Trashed content is unavailable.';END IF;
 IF p_base_revision IS NULL OR p_base_revision<>v_row.draft_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Content revision conflict.';END IF;
 UPDATE public.farm_content AS c SET deleted_at=NULL,draft_revision=c.draft_revision+1,updated_at=clock_timestamp(),review_only=true WHERE c.id=p_id RETURNING * INTO v_row;
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_row.id,v_row.draft_revision,v_row.payload,v_user);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'content_trash','restored',p_id);
 RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload,'updated_at',v_row.updated_at,'deleted_at',v_row.deleted_at,'review_only',true);
END $$;

INSERT INTO farm_private.schema_migrations(version) VALUES('202611140010_content_conflict_status');
NOTIFY pgrst,'reload schema';
COMMIT;
