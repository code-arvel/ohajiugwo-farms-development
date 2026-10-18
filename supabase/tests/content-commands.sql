-- Entire script is rollback-only; use after migration 007 is reviewed/applied.
BEGIN;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{}';
DO $$ DECLARE v_proc regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170007_content_commands') THEN RAISE EXCEPTION 'FAIL: migration 007 is missing.';END IF;
 FOREACH v_proc IN ARRAY ARRAY['public.farm_content_list()'::regprocedure,'public.farm_content_read(uuid)'::regprocedure,'public.farm_content_history(uuid)'::regprocedure,'public.farm_content_trash_list()'::regprocedure,'public.farm_content_save(uuid,text,integer,jsonb)'::regprocedure,'public.farm_content_restore(uuid,integer,integer)'::regprocedure,'public.farm_content_trash(uuid,integer)'::regprocedure,'public.farm_content_untrash(uuid,integer)'::regprocedure] LOOP
  IF has_function_privilege('anon',v_proc,'EXECUTE') OR NOT has_function_privilege('authenticated',v_proc,'EXECUTE') OR has_function_privilege('service_role',v_proc,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: user-only content command grants.';END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.farm_content','INSERT') OR has_table_privilege('authenticated','public.farm_content','UPDATE') OR has_table_privilege('authenticated','public.farm_content','DELETE') THEN RAISE EXCEPTION 'FAIL: direct browser content writes are available.';END IF;
END $$;
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.farm_content_list()','EXECUTE') THEN
  BEGIN PERFORM public.farm_content_list();RAISE EXCEPTION 'FAIL: no-session user read content.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END IF;
END $$;
DO $$ DECLARE v_user uuid:=gen_random_uuid();v_session uuid:=gen_random_uuid();v_id uuid;v_post_id uuid;v_saved jsonb;v_updated jsonb;v_history jsonb;v_post jsonb;
v_payload jsonb:='{"company":{"name":"Fixture Farm","displayName":"Fixture Farm","email":"","headquarters":"Enugu","farmland":"Enugu","hectares":1,"mission":"Care.","vision":"Grow.","values":["Care","Soil","People"]},"products":[{"title":"A","description":"B","enquiry":"Ask"},{"title":"C","description":"D","enquiry":"Ask"},{"title":"E","description":"F","enquiry":"Ask"}],"services":[{"title":"A","description":"B","enquiry":"Ask"},{"title":"C","description":"D","enquiry":"Ask"},{"title":"E","description":"F","enquiry":"Ask"}]}';
BEGIN
 INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,encrypted_password) VALUES(v_user,'authenticated','authenticated','content-fixture@example.test',clock_timestamp(),'fixture');
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
 INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at)
 VALUES(v_user,v_session::text,repeat('a',43),'sealed-fixture',repeat('b',43),clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '11 hours');
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('session_id',v_session)::text,true);
 SET LOCAL ROLE authenticated;
 v_saved:=public.farm_content_save(NULL,'homepage',NULL,v_payload);v_id:=(v_saved->>'id')::uuid;
 IF v_saved->>'revision'<>'1' OR v_saved->>'review_only'<>'true' THEN RAISE EXCEPTION 'FAIL: initial draft save.';END IF;
 v_payload:=jsonb_set(v_payload,'{company,mission}','"Care for soil."');
 v_updated:=public.farm_content_save(v_id,'homepage',1,v_payload);
 IF v_updated->>'revision'<>'2' THEN RAISE EXCEPTION 'FAIL: compare-and-swap update.';END IF;
 BEGIN PERFORM public.farm_content_save(v_id,'homepage',1,v_payload);RAISE EXCEPTION 'FAIL: stale revision was accepted.';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 v_history:=public.farm_content_history(v_id);IF jsonb_array_length(v_history)<>2 THEN RAISE EXCEPTION 'FAIL: immutable revision history.';END IF;
 v_updated:=public.farm_content_restore(v_id,1,2);IF v_updated->>'revision'<>'3' THEN RAISE EXCEPTION 'FAIL: restore did not create a new revision.';END IF;
 IF public.farm_content_trash(v_id,3) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL: homepage draft cannot be trashed.';END IF;
 v_post:=public.farm_content_save(NULL,'post',NULL,'{"slug":"fixture-post","title":"Fixture draft","excerpt":"A short intro.","publishedAt":"","cover":"planting","status":"draft","body":{"type":"doc","content":[{"type":"paragraph"}]}}'::jsonb);v_post_id:=(v_post->>'id')::uuid;
 IF public.farm_content_trash(v_post_id,1) IS NOT TRUE OR public.farm_content_read(v_post_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: trash visibility.';END IF;
 IF jsonb_array_length(public.farm_content_trash_list())<>1 THEN RAISE EXCEPTION 'FAIL: trash inventory.';END IF;
 BEGIN PERFORM public.farm_content_untrash(v_post_id,0);RAISE EXCEPTION 'FAIL: stale trash restore accepted.';EXCEPTION WHEN serialization_failure THEN NULL;END;
 v_updated:=public.farm_content_untrash(v_post_id,1);IF v_updated->>'revision'<>'2' OR v_updated->>'deleted_at' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: trash restoration did not create a visible revision.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: authenticated session gates, user-only grants, immutable revisions, compare-and-swap conflicts, restore and trash checked; fixtures rolled back. Provider, HTTP, concurrent and hosted browser checks remain separate.' AS result;
