-- Run the entire freshly saved file after migration 010; rollback-only fixtures.
BEGIN;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{}';
DO $$ DECLARE v_proc regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140010_content_conflict_status') THEN RAISE EXCEPTION 'FAIL: migration 010 is missing.';END IF;
 FOREACH v_proc IN ARRAY ARRAY['public.farm_content_save(uuid,text,integer,jsonb)'::regprocedure,'public.farm_content_restore(uuid,integer,integer)'::regprocedure,'public.farm_content_trash(uuid,integer)'::regprocedure,'public.farm_content_untrash(uuid,integer)'::regprocedure] LOOP
  IF has_function_privilege('anon',v_proc,'EXECUTE') OR has_function_privilege('service_role',v_proc,'EXECUTE') OR NOT has_function_privilege('authenticated',v_proc,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: content grants changed.';END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.farm_content','INSERT') OR has_table_privilege('authenticated','public.farm_content','UPDATE') OR has_table_privilege('authenticated','public.farm_content','DELETE') THEN RAISE EXCEPTION 'FAIL: direct writes available.';END IF;
 IF NOT (SELECT c.relrowsecurity FROM pg_class AS c WHERE c.oid='public.farm_content'::regclass) THEN RAISE EXCEPTION 'FAIL: content RLS disabled.';END IF;
 BEGIN PERFORM public.farm_content_list();RAISE EXCEPTION 'FAIL: session guard bypassed.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
DO $$
DECLARE
 v_user uuid:=gen_random_uuid();v_session uuid:=gen_random_uuid();v_id uuid;v_saved jsonb;v_read jsonb;
 v_cookie text:=left(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),43);
 v_csrf text:=left(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),43);
 v_payload jsonb;v_winner jsonb;
BEGIN
 -- Deliberately roll this fixture group back inside the DO block, even before final ROLLBACK.
 BEGIN
  INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,encrypted_password)
   VALUES(v_user,'authenticated','authenticated','conflict-'||v_user::text||'@example.test',clock_timestamp(),'NON_USABLE_SQL_FIXTURE');
  INSERT INTO farm_private.memberships(user_id,state) VALUES(v_user,'active');
  INSERT INTO farm_private.sessions(user_id,provider_session_id,cookie_hash,encrypted_credentials,csrf_hash,idle_expires_at,absolute_expires_at)
   VALUES(v_user,v_session::text,v_cookie,'SQL_FIXTURE_ONLY',v_csrf,clock_timestamp()+interval '20 minutes',clock_timestamp()+interval '1 hour');
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('session_id',v_session)::text,true);
  SET LOCAL ROLE authenticated;
  v_payload:=jsonb_build_object('slug','conflict-'||v_user::text,'title','Original fixture','excerpt','Temporary private fixture.','publishedAt','','cover','planting','status','draft','body',jsonb_build_object('type','doc','content','[]'::jsonb));
  v_saved:=public.farm_content_save(NULL,'post',NULL,v_payload);v_id:=(v_saved->>'id')::uuid;
  v_winner:=jsonb_set(v_payload,'{title}','"Saved from tab A"'::jsonb);
  v_saved:=public.farm_content_save(v_id,'post',1,v_winner);
  BEGIN PERFORM public.farm_content_save(v_id,'post',1,v_payload);RAISE EXCEPTION 'FAIL: stale save accepted.';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
  BEGIN PERFORM public.farm_content_restore(v_id,1,1);RAISE EXCEPTION 'FAIL: stale restore accepted.';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
  BEGIN PERFORM public.farm_content_trash(v_id,1);RAISE EXCEPTION 'FAIL: stale trash accepted.';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
  v_read:=public.farm_content_read(v_id);
  IF v_read->>'revision'<>'2' OR v_read->'payload' IS DISTINCT FROM v_winner OR jsonb_array_length(public.farm_content_history(v_id))<>2 THEN RAISE EXCEPTION 'FAIL: stale writer changed saved content/history.';END IF;
  IF public.farm_content_trash(v_id,2) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: current trash denied.';END IF;
  BEGIN PERFORM public.farm_content_untrash(v_id,1);RAISE EXCEPTION 'FAIL: stale untrash accepted.';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
  v_saved:=public.farm_content_untrash(v_id,2);
  IF v_saved->>'revision'<>'3' OR v_saved->'payload' IS DISTINCT FROM v_winner THEN RAISE EXCEPTION 'FAIL: current untrash lost content.';END IF;
  RAISE EXCEPTION USING ERRCODE='Z0010',MESSAGE='Rollback conflict fixtures';
 EXCEPTION WHEN SQLSTATE 'Z0010' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM auth.users AS u WHERE u.id=v_user) THEN RAISE EXCEPTION 'FAIL: fixture rollback failed.';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: explicit PT409 conflicts, saved content/history preservation, session guard, grants and RLS checked; fixtures rolled back. Actual HTTP/two-tab behavior remains separate.' AS result;
