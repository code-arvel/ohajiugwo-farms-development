-- Entire script is read-only and rollback-only. No real Auth calls or fixture accounts.
BEGIN;
DO $$ DECLARE v_rows jsonb;v_expected integer;v_before bigint;v_after bigint;BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') THEN RAISE EXCEPTION 'FAIL: migration 011 missing.';END IF;
 IF has_function_privilege('anon','public.farm_cleanup_review_read(integer)','EXECUTE') OR has_function_privilege('authenticated','public.farm_cleanup_review_read(integer)','EXECUTE') OR NOT has_function_privilege('service_role','public.farm_cleanup_review_read(integer)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: inspection command grants.';END IF;
 SELECT count(*) INTO v_before FROM farm_private.cleanup_jobs;
 SELECT least(count(*),5)::integer INTO v_expected FROM farm_private.cleanup_jobs AS j WHERE j.source_kind='session' AND j.state='review';
 v_rows:=public.farm_cleanup_review_read(5);
 IF jsonb_typeof(v_rows)<>'array' OR jsonb_array_length(v_rows)<>v_expected THEN RAISE EXCEPTION 'FAIL: bounded review inventory.';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_rows) AS x(value) WHERE x.value->>'source_kind'<>'session' OR x.value->>'state'<>'review') THEN RAISE EXCEPTION 'FAIL: non-review job exposed.';END IF;
 BEGIN PERFORM public.farm_cleanup_review_read(0);RAISE EXCEPTION USING ERRCODE='Z0011',MESSAGE='FAIL: invalid bound accepted.';
 EXCEPTION WHEN SQLSTATE 'Z0011' THEN RAISE;WHEN raise_exception THEN NULL;END;
 BEGIN PERFORM public.farm_cleanup_review_read(21);RAISE EXCEPTION USING ERRCODE='Z0011',MESSAGE='FAIL: oversized bound accepted.';
 EXCEPTION WHEN SQLSTATE 'Z0011' THEN RAISE;WHEN raise_exception THEN NULL;END;
 SELECT count(*) INTO v_after FROM farm_private.cleanup_jobs;
 IF v_before<>v_after THEN RAISE EXCEPTION 'FAIL: inventory changed queue.';END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.farm_cleanup_review_read(1);RAISE EXCEPTION 'FAIL: anonymous inspection available.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.farm_cleanup_review_read(1);RAISE EXCEPTION 'FAIL: browser inspection available.';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: cleanup review read is bounded, session-review-only and service-only; queue unchanged. No provider calls or recovery performed.' AS result;
