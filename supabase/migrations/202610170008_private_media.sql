-- Private photo reservation, sanitisation publication and durable object cleanup.
-- Draft only: hosted application must wait for source review and full rollback verification.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170005_durable_cleanup')
  OR NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170006_account_lifecycle')
  OR NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170007_content_commands') THEN
  RAISE EXCEPTION 'Migrations 005, 006 and 007 are required.';
 END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170008_private_media') THEN
  RAISE EXCEPTION 'Migration 008 already applied; do not rerun.';
 END IF;
END $$;

CREATE TABLE farm_private.media_uploads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 media_id uuid NOT NULL UNIQUE REFERENCES public.farm_media(id) ON DELETE RESTRICT,
 version_id uuid NOT NULL UNIQUE REFERENCES public.farm_media_versions(id) ON DELETE RESTRICT,
 upload_path text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN('reserved','processing','complete','quarantined','cancelled')),
 lease_owner uuid,
 lease_until timestamptz,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((state='processing')=(lease_owner IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE farm_private.media_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.media_uploads FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE farm_private.media_cleanup(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paths text[] NOT NULL CHECK(cardinality(paths) BETWEEN 1 AND 200),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','leased','review','done')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_owner uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((state='leased')=(lease_owner IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE farm_private.media_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.media_cleanup FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION farm_private.media_actor(p_cookie_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_active integer;
BEGIN
 IF p_cookie_hash IS NULL OR p_cookie_hash!~'^[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 -- Match account command lock order and serialize upload-count/capacity reservations.
 SELECT g.active_count INTO v_active FROM farm_private.admin_guard AS g WHERE g.singleton FOR UPDATE;
 IF v_active IS NULL OR v_active<1 THEN RETURN NULL;END IF;
 SELECT s.user_id INTO v_user FROM farm_private.sessions AS s JOIN farm_private.memberships AS m ON m.user_id=s.user_id
  WHERE s.cookie_hash=p_cookie_hash AND s.revoked_at IS NULL AND s.idle_expires_at>clock_timestamp()
   AND s.absolute_expires_at>clock_timestamp() AND m.state='active' FOR UPDATE OF s,m;
 RETURN v_user;
END $$;
REVOKE ALL ON FUNCTION farm_private.media_actor(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.farm_media_reserve(p_actor_cookie_hash text,p_mime_type text,p_byte_size bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_media uuid:=gen_random_uuid();v_version uuid:=gen_random_uuid();v_id uuid:=gen_random_uuid();v_original text;v_preview text;v_upload text;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);
 IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 IF p_mime_type NOT IN('image/jpeg','image/png','image/webp') OR p_byte_size NOT BETWEEN 12 AND 10485760 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid photo upload.';END IF;
 IF (SELECT count(*) FROM farm_private.media_uploads AS u WHERE u.user_id=v_user AND u.state IN('reserved','processing') AND u.expires_at>clock_timestamp())>=2
  OR (SELECT count(*) FROM public.farm_media AS m WHERE m.deleted_at IS NULL)>=200 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Photo upload limit reached.';END IF;
 v_upload:='staging/'||v_id::text||'/source';v_original:='media/'||v_media::text||'/'||v_version::text||'/original.webp';v_preview:='media/'||v_media::text||'/'||v_version::text||'/preview.webp';
 INSERT INTO public.farm_media(id,metadata) VALUES(v_media,'{}'::jsonb);
 INSERT INTO public.farm_media_versions(id,media_id,original_path,preview_path,state) VALUES(v_version,v_media,v_original,v_preview,'pending');
 INSERT INTO farm_private.media_uploads(id,user_id,media_id,version_id,upload_path,expires_at) VALUES(v_id,v_user,v_media,v_version,v_upload,clock_timestamp()+interval '20 minutes');
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','reserved',v_media);
 RETURN jsonb_build_object('id',v_id,'media_id',v_media,'version_id',v_version,'upload_path',v_upload,'original_path',v_original,'preview_path',v_preview);
END $$;

CREATE FUNCTION public.farm_media_claim(p_actor_cookie_hash text,p_id uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 IF p_owner IS NULL THEN RETURN false;END IF;
 UPDATE farm_private.media_uploads AS u SET state='processing',lease_owner=p_owner,lease_until=clock_timestamp()+interval '3 minutes'
  WHERE u.id=p_id AND u.user_id=v_user AND u.state='reserved' AND u.expires_at>clock_timestamp();
 RETURN FOUND;
END $$;

CREATE FUNCTION public.farm_media_ready(p_actor_cookie_hash text,p_id uuid,p_owner uuid,p_width integer,p_height integer,p_mime_type text,p_byte_size bigint,p_checksum text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_upload farm_private.media_uploads;v_deleted timestamptz;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT u.* INTO v_upload FROM farm_private.media_uploads AS u WHERE u.id=p_id AND u.user_id=v_user AND u.state='processing' AND u.lease_owner=p_owner AND u.lease_until>clock_timestamp() FOR UPDATE;
 IF v_upload.id IS NULL OR p_width NOT BETWEEN 1 AND 4096 OR p_height NOT BETWEEN 1 AND 4096 OR p_mime_type<>'image/webp'
  OR p_byte_size NOT BETWEEN 1 AND 10485760 OR p_checksum!~'^[a-f0-9]{64}$' THEN RETURN false;END IF;
 SELECT m.deleted_at INTO v_deleted FROM public.farm_media AS m WHERE m.id=v_upload.media_id FOR UPDATE;
 IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN false;END IF;
 UPDATE public.farm_media_versions AS v SET state='ready',checksum=p_checksum WHERE v.id=v_upload.version_id AND v.media_id=v_upload.media_id AND v.state='pending';
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE public.farm_media AS m SET metadata=jsonb_build_object('width',p_width,'height',p_height,'mimeType','image/webp','byteSize',p_byte_size) WHERE m.id=v_upload.media_id;
 UPDATE farm_private.media_uploads AS u SET state='complete',lease_owner=NULL,lease_until=NULL WHERE u.id=v_upload.id;
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','ready',v_upload.media_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_media_quarantine(p_actor_cookie_hash text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_upload farm_private.media_uploads;v_paths text[];
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT u.* INTO v_upload FROM farm_private.media_uploads AS u WHERE u.id=p_id AND u.user_id=v_user AND u.state IN('reserved','processing') FOR UPDATE;
 IF v_upload.id IS NULL THEN RETURN false;END IF;
 SELECT ARRAY[v_upload.upload_path,v.original_path,v.preview_path] INTO v_paths FROM public.farm_media_versions AS v WHERE v.id=v_upload.version_id;
 UPDATE farm_private.media_uploads AS u SET state='quarantined',lease_owner=NULL,lease_until=NULL WHERE u.id=v_upload.id;
 UPDATE public.farm_media_versions AS v SET state='quarantined' WHERE v.id=v_upload.version_id;
 INSERT INTO farm_private.media_cleanup(paths) VALUES(v_paths);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','quarantined',v_upload.media_id);
 RETURN true;
END $$;

CREATE FUNCTION public.farm_media_list(p_actor_cookie_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_result jsonb;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'versionId',v.id,'metadata',m.metadata,'createdAt',m.created_at) ORDER BY m.created_at DESC,m.id),'[]'::jsonb)
  INTO v_result FROM public.farm_media AS m JOIN public.farm_media_versions AS v ON v.media_id=m.id WHERE m.deleted_at IS NULL AND v.state='ready';
 RETURN v_result;
END $$;

CREATE FUNCTION public.farm_media_preview_path(p_actor_cookie_hash text,p_media_id uuid,p_version_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_path text;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT v.preview_path INTO v_path FROM public.farm_media_versions AS v JOIN public.farm_media AS m ON m.id=v.media_id
  WHERE m.id=p_media_id AND v.id=p_version_id AND m.deleted_at IS NULL AND v.state='ready';
 RETURN v_path;
END $$;

CREATE FUNCTION public.farm_media_remove(p_actor_cookie_hash text,p_media_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_paths text[];v_deleted timestamptz;
BEGIN
 v_user:=farm_private.media_actor(p_actor_cookie_hash);IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active administrator session required.';END IF;
 SELECT m.deleted_at INTO v_deleted FROM public.farm_media AS m WHERE m.id=p_media_id FOR UPDATE;
 IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.farm_media_usages AS u JOIN public.farm_media_versions AS v ON v.id=u.media_version_id WHERE v.media_id=p_media_id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='A photo used by saved content cannot be removed.';END IF;
 SELECT array_agg(p.path) INTO v_paths FROM (SELECT v.original_path AS path FROM public.farm_media_versions AS v WHERE v.media_id=p_media_id UNION SELECT v.preview_path FROM public.farm_media_versions AS v WHERE v.media_id=p_media_id) AS p;
 IF v_paths IS NULL THEN RETURN false;END IF;
 UPDATE public.farm_media AS m SET deleted_at=clock_timestamp() WHERE m.id=p_media_id;
 UPDATE public.farm_media_versions AS v SET state='quarantined' WHERE v.media_id=p_media_id;
 INSERT INTO farm_private.media_cleanup(paths) VALUES(v_paths);
 INSERT INTO farm_private.security_events(actor_id,event_type,outcome,target_id) VALUES(v_user,'media_upload','removed',p_media_id);
 RETURN true;
END $$;

-- Turn uploads abandoned before quarantine into durable object cleanup work.
CREATE FUNCTION public.farm_media_expired_cleanup_enqueue(p_limit integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_upload farm_private.media_uploads;v_paths text[];v_count integer:=0;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid expired media batch.';END IF;
 FOR v_upload IN SELECT u.* FROM farm_private.media_uploads AS u
  WHERE u.state IN('reserved','processing') AND u.expires_at<=clock_timestamp()
  ORDER BY u.expires_at,u.created_at FOR UPDATE SKIP LOCKED LIMIT p_limit LOOP
  SELECT ARRAY[v_upload.upload_path,v.original_path,v.preview_path] INTO v_paths
   FROM public.farm_media_versions AS v WHERE v.id=v_upload.version_id AND v.media_id=v_upload.media_id;
  IF v_paths IS NULL THEN
   UPDATE farm_private.media_uploads AS u SET state='quarantined',lease_owner=NULL,lease_until=NULL WHERE u.id=v_upload.id;
   CONTINUE;
  END IF;
  UPDATE farm_private.media_uploads AS u SET state='quarantined',lease_owner=NULL,lease_until=NULL WHERE u.id=v_upload.id;
  UPDATE public.farm_media_versions AS v SET state='quarantined' WHERE v.id=v_upload.version_id AND v.state='pending';
  INSERT INTO farm_private.media_cleanup(paths) VALUES(v_paths);
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;

CREATE FUNCTION public.farm_media_cleanup_claim(p_owner uuid,p_limit integer) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.media_cleanup;
BEGIN
 IF p_owner IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid media cleanup batch.';END IF;
 FOR v_row IN SELECT c.* FROM farm_private.media_cleanup AS c WHERE (c.state='queued' AND c.available_at<=clock_timestamp())
  OR (c.state='leased' AND c.lease_until<=clock_timestamp()) ORDER BY c.available_at,c.created_at FOR UPDATE SKIP LOCKED LIMIT p_limit LOOP
  UPDATE farm_private.media_cleanup AS c SET state='leased',lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',attempts=c.attempts+1 WHERE c.id=v_row.id RETURNING c.* INTO v_row;
  RETURN NEXT jsonb_build_object('id',v_row.id,'paths',v_row.paths,'attempts',v_row.attempts);
 END LOOP;
END $$;

CREATE FUNCTION public.farm_media_cleanup_finish(p_id uuid,p_owner uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row farm_private.media_cleanup;
BEGIN
 SELECT c.* INTO v_row FROM farm_private.media_cleanup AS c WHERE c.id=p_id AND c.state='leased' AND c.lease_owner=p_owner AND c.lease_until>clock_timestamp() FOR UPDATE;
 IF v_row.id IS NULL THEN RETURN false;END IF;
 IF p_success THEN UPDATE farm_private.media_cleanup AS c SET state='done',lease_owner=NULL,lease_until=NULL WHERE c.id=p_id;
 ELSIF v_row.attempts>=8 THEN UPDATE farm_private.media_cleanup AS c SET state='review',lease_owner=NULL,lease_until=NULL WHERE c.id=p_id;
 ELSE UPDATE farm_private.media_cleanup AS c SET state='queued',available_at=clock_timestamp()+make_interval(secs=>least(3600,(2^least(v_row.attempts,11))::integer)),lease_owner=NULL,lease_until=NULL WHERE c.id=p_id;END IF;
 RETURN true;
END $$;

DO $$ DECLARE v_proc regprocedure;BEGIN
 FOREACH v_proc IN ARRAY ARRAY['public.farm_media_reserve(text,text,bigint)'::regprocedure,'public.farm_media_claim(text,uuid,uuid)'::regprocedure,
  'public.farm_media_ready(text,uuid,uuid,integer,integer,text,bigint,text)'::regprocedure,'public.farm_media_quarantine(text,uuid)'::regprocedure,
  'public.farm_media_list(text)'::regprocedure,'public.farm_media_preview_path(text,uuid,uuid)'::regprocedure,'public.farm_media_remove(text,uuid)'::regprocedure,
 'public.farm_media_cleanup_claim(uuid,integer)'::regprocedure,'public.farm_media_cleanup_finish(uuid,uuid,boolean)'::regprocedure,
 'public.farm_media_expired_cleanup_enqueue(integer)'::regprocedure] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_proc);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',v_proc);
 END LOOP;
END $$;
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170008_private_media');
NOTIFY pgrst,'reload schema';
COMMIT;
