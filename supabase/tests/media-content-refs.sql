-- Whole verification runs and rolls back in this session. No object API is contacted.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170009_media_content_refs') THEN RAISE EXCEPTION 'Migration 009 is missing.';END IF;
 IF has_function_privilege('anon','farm_private.attach_revision_media()','EXECUTE') OR has_function_privilege('authenticated','farm_private.attach_revision_media()','EXECUTE') THEN RAISE EXCEPTION 'FAIL: private media trigger function exposed.';END IF;
END $$;
DO $$ DECLARE v_user uuid:=gen_random_uuid();v_cookie text:=repeat('f',43);v_res jsonb;v_owner uuid:=gen_random_uuid();v_content uuid:=gen_random_uuid();v_revision uuid:=gen_random_uuid();v_bad uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id,aud,role,email) VALUES(v_user,'authenticated','authenticated','media-ref-'||v_user||'@example.test');
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 PERFORM public.farm_session_open(v_user,gen_random_uuid()::text,v_cookie,'dummy-sealed-session',repeat('e',43));
 v_res:=public.farm_media_reserve(v_cookie,'image/png',1200);
 PERFORM public.farm_media_claim(v_cookie,(v_res->>'id')::uuid,v_owner);
 IF public.farm_media_ready(v_cookie,(v_res->>'id')::uuid,v_owner,800,600,'image/webp',900,repeat('a',64)) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: fixture publish.';END IF;
 INSERT INTO public.farm_content(id,kind,payload) VALUES(v_content,'post','{}'::jsonb);
 INSERT INTO public.farm_revisions(id,content_id,revision,payload,actor_id) VALUES(v_revision,v_content,1,jsonb_build_object('mediaVersionId',v_res->>'version_id'),v_user);
 IF NOT EXISTS(SELECT 1 FROM public.farm_media_usages WHERE revision_id=v_revision AND media_version_id=(v_res->>'version_id')::uuid) THEN RAISE EXCEPTION 'FAIL: revision media usage not attached.';END IF;
 v_bad:=gen_random_uuid();
 BEGIN INSERT INTO public.farm_revisions(id,content_id,revision,payload,actor_id) VALUES(v_bad,v_content,2,jsonb_build_object('mediaVersionId',gen_random_uuid()),v_user);RAISE EXCEPTION 'FAIL: unavailable media accepted.';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.farm_media_remove(v_cookie,(v_res->>'media_id')::uuid);RAISE EXCEPTION 'FAIL: referenced media removed.';EXCEPTION WHEN foreign_key_violation THEN NULL;END;
END $$;
ROLLBACK;
SELECT 'PASS: revision references accept only ready private media, attach durable usage records, and prevent removal of used photos; fixtures rolled back. No Storage object or browser request was made.' AS result;
