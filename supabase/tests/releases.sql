-- Run this ENTIRE freshly saved file only after reviewed migration 012.
-- Fixture identities/posts; reads an existing homepage if present. All changes roll back; no provider/deployment calls.
BEGIN;
DO $$
DECLARE v_actor uuid:=gen_random_uuid();v_session uuid:=gen_random_uuid();v_home uuid:=gen_random_uuid();v_post uuid:=gen_random_uuid();v_request uuid:=gen_random_uuid();v_owner uuid:=gen_random_uuid();v_first jsonb;v_next jsonb;v_claim jsonb;v_read jsonb;v_home_revision integer:=1;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210012_release_commands') THEN RAISE EXCEPTION 'Migration 012 required.';END IF;
 IF has_function_privilege('anon','public.farm_release_list()','EXECUTE') OR has_function_privilege('authenticated','public.farm_release_claim(uuid)','EXECUTE') OR NOT has_function_privilege('service_role','public.farm_release_claim(uuid)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: release command grants.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.release_jobs) THEN RAISE EXCEPTION 'Initial release verification requires an empty release queue; use isolated verification after publishing starts.';END IF;
 INSERT INTO auth.users(id,email) VALUES(v_actor,'release-verification-'||v_actor||'@example.test');
 INSERT INTO farm_private.memberships(user_id,state) VALUES(v_actor,'active');
 PERFORM public.farm_session_open(v_actor,v_session::text,repeat('x',43),'sealed-fixture',repeat('y',43));
 UPDATE farm_private.sessions SET reauthenticated_at=NULL WHERE user_id=v_actor;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('session_id',v_session)::text,true);
 -- These intentionally minimal SQL fixtures are never rendered or published.
 IF EXISTS(SELECT 1 FROM public.farm_content WHERE kind='homepage') THEN
  SELECT id,draft_revision INTO v_home,v_home_revision FROM public.farm_content WHERE kind='homepage';
 ELSE
  INSERT INTO public.farm_content(id,kind,payload) VALUES(v_home,'homepage','{}');
  INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_home,1,'{}',v_actor);
 END IF;
 INSERT INTO public.farm_content(id,kind,payload) VALUES(v_post,'post','{"slug":"verification-only"}');
 INSERT INTO public.farm_revisions(content_id,revision,payload,actor_id) VALUES(v_post,1,'{"slug":"verification-only"}',v_actor);
 BEGIN PERFORM public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_home,'revision',v_home_revision)),NULL,'{}'::uuid[],v_request);RAISE EXCEPTION 'FAIL: missing recent password accepted.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE farm_private.sessions SET reauthenticated_at=clock_timestamp() WHERE user_id=v_actor;
 BEGIN PERFORM public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_home)),NULL,'{}'::uuid[],gen_random_uuid());RAISE EXCEPTION 'FAIL: missing revision accepted.';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 v_first:=public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_home,'revision',v_home_revision)),NULL,'{}'::uuid[],v_request);
 IF (public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_home,'revision',v_home_revision)),NULL,'{}'::uuid[],v_request))->>'id' IS DISTINCT FROM v_first->>'id' THEN RAISE EXCEPTION 'FAIL: idempotency.';END IF;
 BEGIN PERFORM public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_home,'revision',v_home_revision+1)),NULL,'{}'::uuid[],v_request);RAISE EXCEPTION 'FAIL: request key changed selection accepted.';EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
 v_read:=public.farm_release_read((v_first->>'id')::uuid);
 IF jsonb_array_length(v_read#>'{snapshot,posts}')<>0 OR (v_read#>>'{snapshot,homepage,revision}')::integer<>v_home_revision THEN RAISE EXCEPTION 'FAIL: explicit saved selection.';END IF;
 BEGIN UPDATE farm_private.releases SET snapshot='{}' WHERE id=(v_first->>'id')::uuid;RAISE EXCEPTION 'FAIL: mutable release.';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 v_claim:=public.farm_release_claim(v_owner);
 IF v_claim->>'id' IS DISTINCT FROM v_first->>'id' OR public.farm_release_claim(gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: serialized claim.';END IF;
 BEGIN PERFORM public.farm_release_worker_update((v_first->>'id')::uuid,v_owner,'confirm','fixture-deployment',repeat('a',64));RAISE EXCEPTION 'FAIL: publication before submission.';EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL: publication before submission.' THEN RAISE;END IF;END;
 PERFORM public.farm_release_worker_update((v_first->>'id')::uuid,v_owner,'built',NULL,repeat('a',64));
 PERFORM public.farm_release_worker_update((v_first->>'id')::uuid,v_owner,'submitted','fixture-deployment',repeat('a',64));
 PERFORM public.farm_release_worker_update((v_first->>'id')::uuid,v_owner,'confirm','fixture-deployment',repeat('a',64));
 v_next:=public.farm_release_prepare(jsonb_build_array(jsonb_build_object('id',v_post,'revision',1)),(v_first->>'id')::uuid,'{}'::uuid[],gen_random_uuid());
 IF jsonb_array_length((public.farm_release_read((v_next->>'id')::uuid))#>'{snapshot,posts}')<>1 THEN RAISE EXCEPTION 'FAIL: selected post missing.';END IF;
 BEGIN PERFORM public.farm_release_prepare('[]',NULL,'{}'::uuid[],gen_random_uuid());RAISE EXCEPTION 'FAIL: stale live base.';EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
END $$;
ROLLBACK;
SELECT 'PASS: release grants, recent password, explicit saved selections, idempotency, immutable snapshots, serial claim and confirmation guards; fixtures rolled back. Provider/HTTP/deployment remain separate.' AS result;
