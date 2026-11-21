-- Prepared locally only. Immutable public-release snapshots and serial worker leases.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611140011_cleanup_review_inspection') THEN RAISE EXCEPTION 'Migration 011 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202611210012_release_commands') THEN RAISE EXCEPTION 'Migration 012 already applied; do not rerun.';END IF;
END $$;
CREATE TABLE farm_private.releases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),base_release_id uuid REFERENCES farm_private.releases(id) ON DELETE RESTRICT,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=10000000),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,request_digest text NOT NULL
);
CREATE TABLE farm_private.release_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),live_release_id uuid REFERENCES farm_private.releases(id) ON DELETE RESTRICT,withdrawn_ids uuid[] NOT NULL DEFAULT '{}');
INSERT INTO farm_private.release_state(singleton) VALUES(true);
CREATE TABLE farm_private.release_jobs(
 release_id uuid PRIMARY KEY REFERENCES farm_private.releases(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','building','deploying','published','failed','review')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),lease_owner uuid,lease_until timestamptz,artifact_hash text,deployment_id text,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX farm_one_active_release ON farm_private.release_jobs((true)) WHERE state IN('building','deploying');
CREATE TABLE farm_private.release_media_refs(release_id uuid NOT NULL REFERENCES farm_private.releases(id) ON DELETE RESTRICT,media_version_id uuid NOT NULL REFERENCES public.farm_media_versions(id) ON DELETE RESTRICT,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,PRIMARY KEY(release_id,media_version_id));
ALTER TABLE farm_private.releases ENABLE ROW LEVEL SECURITY;ALTER TABLE farm_private.release_state ENABLE ROW LEVEL SECURITY;ALTER TABLE farm_private.release_jobs ENABLE ROW LEVEL SECURITY;ALTER TABLE farm_private.release_media_refs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farm_private.releases,farm_private.release_state,farm_private.release_jobs,farm_private.release_media_refs FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION farm_private.release_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Release snapshots are immutable.';END $$;
CREATE TRIGGER farm_release_immutable BEFORE UPDATE ON farm_private.releases FOR EACH ROW EXECUTE FUNCTION farm_private.release_immutable();
CREATE FUNCTION farm_private.release_actor() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cookie text;v_actor uuid;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT s.cookie_hash INTO v_cookie FROM farm_private.sessions s WHERE s.user_id=auth.uid() AND s.provider_session_id=auth.jwt()->>'session_id';
 v_actor:=farm_private.recent_admin(v_cookie);
 IF v_actor IS NULL OR v_actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Recent administrator confirmation required.';END IF;
 RETURN v_actor;
END $$;
CREATE FUNCTION farm_private.store_release(p_actor uuid,p_base uuid,p_snapshot jsonb,p_request uuid,p_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_entry jsonb;v_version uuid;v_media uuid;v_ready text;v_deleted timestamptz;
BEGIN
 IF(SELECT count(*) FROM farm_private.release_jobs WHERE state IN('queued','building','deploying','review'))>=10 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Release queue is full. Review current jobs first.';END IF;
 IF octet_length(p_snapshot::text)>10000000 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Release snapshot exceeds bound.';END IF;
 INSERT INTO farm_private.releases(base_release_id,snapshot,actor_id,request_id,request_digest) VALUES(p_base,p_snapshot,p_actor,p_request,p_digest) RETURNING id INTO v_id;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_snapshot->'posts') LOOP
  IF coalesce(v_entry->'payload'->>'mediaVersionId','')<>'' THEN
   IF (v_entry->'payload'->>'mediaVersionId')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Invalid release media reference.';END IF;
   v_version:=(v_entry->'payload'->>'mediaVersionId')::uuid;
   SELECT v.media_id INTO v_media FROM public.farm_media_versions v WHERE v.id=v_version;
   SELECT m.deleted_at INTO v_deleted FROM public.farm_media m WHERE m.id=v_media FOR UPDATE;
   IF NOT FOUND OR v_deleted IS NOT NULL THEN RAISE EXCEPTION 'Release photo unavailable.';END IF;
   SELECT v.state INTO v_ready FROM public.farm_media_versions v WHERE v.id=v_version FOR UPDATE;
   IF v_ready IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'Release photo unavailable.';END IF;
   IF jsonb_typeof(v_entry->'mediaMetadata') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Captured release photo details unavailable.';END IF;
   IF EXISTS(SELECT 1 FROM farm_private.release_media_refs WHERE release_id=v_id AND media_version_id=v_version AND metadata IS DISTINCT FROM v_entry->'mediaMetadata') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Select all articles sharing changed photo details together.';END IF;
   INSERT INTO farm_private.release_media_refs(release_id,media_version_id,metadata) VALUES(v_id,v_version,v_entry->'mediaMetadata') ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 INSERT INTO farm_private.release_jobs(release_id) VALUES(v_id);
 RETURN jsonb_build_object('id',v_id,'state','queued','baseReleaseId',p_base,'requestId',p_request);
END $$;
CREATE FUNCTION public.farm_release_prepare(p_selections jsonb,p_base uuid,p_withdrawals uuid[],p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_live uuid;v_snapshot jsonb;v_existing farm_private.releases;v_digest text;v_selection jsonb;v_row public.farm_content;v_entry jsonb;v_home jsonb;v_posts jsonb;v_withdrawn uuid[];v_selected uuid[]:='{}';v_id uuid;
BEGIN
 v_actor:=farm_private.release_actor();SELECT s.live_release_id INTO v_live FROM farm_private.release_state s WHERE singleton FOR UPDATE;
 IF p_request IS NULL OR p_selections IS NULL OR jsonb_typeof(p_selections)<>'array' OR jsonb_array_length(p_selections)>100 OR cardinality(coalesce(p_withdrawals,'{}'))>100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid release selection.';END IF;
 v_digest:=jsonb_build_object('selections',p_selections,'base',p_base,'withdrawals',coalesce(p_withdrawals,'{}'))::text;
 SELECT * INTO v_existing FROM farm_private.releases r WHERE r.request_id=p_request;
 IF FOUND THEN
  IF v_existing.request_digest<>v_digest THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Request key was used for another selection.';END IF;
  RETURN jsonb_build_object('id',v_existing.id,'state',(SELECT j.state FROM farm_private.release_jobs j WHERE j.release_id=v_existing.id),'baseReleaseId',v_existing.base_release_id,'requestId',p_request);
 END IF;
 IF p_base IS DISTINCT FROM v_live THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Live release changed. Review again.';END IF;
 IF(SELECT count(*) FROM farm_private.release_jobs WHERE state IN('queued','building','deploying','review'))>=10 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Release queue is full. Review current jobs first.';END IF;
 IF p_base IS NOT NULL THEN SELECT r.snapshot INTO v_snapshot FROM farm_private.releases r WHERE r.id=p_base;END IF;
 v_home:=v_snapshot->'homepage';v_posts:=coalesce(v_snapshot->'posts','[]');
 SELECT coalesce(array_agg(value::uuid),'{}') INTO v_withdrawn FROM jsonb_array_elements_text(coalesce(v_snapshot->'withdrawnIds','[]'));
 FOR v_selection IN SELECT value FROM jsonb_array_elements(p_selections) LOOP
  IF jsonb_typeof(v_selection)<>'object' OR (v_selection->>'id') IS NULL OR jsonb_typeof(v_selection->'revision') IS DISTINCT FROM 'number' OR (v_selection->>'revision') IS NULL OR (v_selection->>'revision')!~'^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid selected revision.';END IF;
  v_id:=(v_selection->>'id')::uuid;
  IF v_id=ANY(v_selected) OR v_id=ANY(coalesce(p_withdrawals,'{}')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Duplicate or conflicting selection.';END IF;
  v_selected:=array_append(v_selected,v_id);
  SELECT * INTO v_row FROM public.farm_content c WHERE c.id=v_id FOR UPDATE;
  IF NOT FOUND OR v_row.deleted_at IS NOT NULL OR v_row.draft_revision<>(v_selection->>'revision')::integer THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Selected draft changed or is unavailable.';END IF;
  v_entry:=jsonb_build_object('id',v_row.id,'kind',v_row.kind,'revision',v_row.draft_revision,'payload',v_row.payload);
  IF v_row.kind='post' AND coalesce(v_row.payload->>'mediaVersionId','')<>'' THEN
   v_entry:=v_entry||jsonb_build_object('mediaMetadata',(SELECT m.metadata FROM public.farm_media m JOIN public.farm_media_versions v ON v.media_id=m.id WHERE v.id=(v_row.payload->>'mediaVersionId')::uuid));
  END IF;
  IF v_row.kind='homepage' THEN v_home:=v_entry;ELSE
   SELECT coalesce(jsonb_agg(value),'[]') INTO v_posts FROM jsonb_array_elements(v_posts) WHERE value->>'id'<>v_id::text;
   v_posts:=v_posts||jsonb_build_array(v_entry);
  END IF;
  v_withdrawn:=array_remove(v_withdrawn,v_id);
 END LOOP;
 IF v_home IS NULL OR v_home='null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='First release requires an explicitly selected homepage revision.';END IF;
 FOREACH v_id IN ARRAY coalesce(p_withdrawals,'{}') LOOP
  IF v_id::text=v_home->>'id' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='The homepage cannot be withdrawn.';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_posts) WHERE value->>'id'=v_id::text) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Withdraw only a currently live article.';END IF;
  SELECT coalesce(jsonb_agg(value),'[]') INTO v_posts FROM jsonb_array_elements(v_posts) WHERE value->>'id'<>v_id::text;
  IF NOT v_id=ANY(v_withdrawn) THEN v_withdrawn:=array_append(v_withdrawn,v_id);END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_posts) a JOIN jsonb_array_elements(v_posts) b ON a.value->>'id'<>b.value->>'id' AND a.value->'payload'->>'slug'=b.value->'payload'->>'slug') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Release article URLs must be unique.';END IF;
 v_snapshot:=jsonb_build_object('version',1,'homepage',v_home,'posts',v_posts,'withdrawnIds',to_jsonb(v_withdrawn),'capturedAt',clock_timestamp());
 RETURN farm_private.store_release(v_actor,p_base,v_snapshot,p_request,v_digest);
END $$;
CREATE FUNCTION public.farm_release_list() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM farm_private.require_content_admin();
 SELECT jsonb_build_object('liveReleaseId',(SELECT live_release_id FROM farm_private.release_state WHERE singleton),'releases',coalesce((SELECT jsonb_agg(x.value ORDER BY x.created_at DESC) FROM(SELECT r.created_at,jsonb_build_object('id',r.id,'baseReleaseId',r.base_release_id,'createdAt',r.created_at,'state',j.state,'attempts',j.attempts,'deploymentId',j.deployment_id) value FROM farm_private.releases r JOIN farm_private.release_jobs j ON j.release_id=r.id ORDER BY r.created_at DESC LIMIT 100)x),'[]')) INTO v_result;
 RETURN v_result;
END $$;
CREATE FUNCTION public.farm_release_read(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM farm_private.require_content_admin();
 RETURN(SELECT jsonb_build_object('id',r.id,'baseReleaseId',r.base_release_id,'snapshot',r.snapshot,'createdAt',r.created_at,'state',j.state) FROM farm_private.releases r JOIN farm_private.release_jobs j ON j.release_id=r.id WHERE r.id=p_id);
END $$;
CREATE FUNCTION public.farm_release_claim(p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.release_jobs;v_release farm_private.releases;v_live uuid;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'Worker owner required.';END IF;
 SELECT live_release_id INTO v_live FROM farm_private.release_state WHERE singleton FOR UPDATE;
 UPDATE farm_private.release_jobs SET state='review',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE state IN('building','deploying') AND lease_until<=clock_timestamp();
 IF EXISTS(SELECT 1 FROM farm_private.release_jobs WHERE state IN('building','deploying','review')) THEN RETURN NULL;END IF;
 SELECT * INTO v_job FROM farm_private.release_jobs WHERE state='queued' ORDER BY updated_at,release_id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO v_release FROM farm_private.releases WHERE id=v_job.release_id;
 IF v_release.base_release_id IS DISTINCT FROM v_live THEN UPDATE farm_private.release_jobs SET state='failed',updated_at=clock_timestamp() WHERE release_id=v_job.release_id;RETURN NULL;END IF;
 UPDATE farm_private.release_jobs SET state='building',attempts=attempts+1,lease_owner=p_owner,lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp() WHERE release_id=v_job.release_id;
 RETURN jsonb_build_object('id',v_release.id,'snapshot',v_release.snapshot,'baseReleaseId',v_release.base_release_id,'requestId',v_release.request_id,'media',coalesce((SELECT jsonb_agg(jsonb_build_object('versionId',v.id,'mediaId',v.media_id,'path',v.original_path,'checksum',v.checksum,'metadata',u.metadata)) FROM farm_private.release_media_refs u JOIN public.farm_media_versions v ON v.id=u.media_version_id JOIN public.farm_media m ON m.id=v.media_id WHERE u.release_id=v_release.id),'[]'));
END $$;
CREATE FUNCTION public.farm_release_worker_update(p_id uuid,p_owner uuid,p_action text,p_deployment_id text,p_artifact_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.release_jobs;v_release farm_private.releases;v_live uuid;
BEGIN
 SELECT live_release_id INTO v_live FROM farm_private.release_state WHERE singleton FOR UPDATE;
 SELECT * INTO v_job FROM farm_private.release_jobs WHERE release_id=p_id FOR UPDATE;
 IF v_job.release_id IS NULL OR v_job.lease_owner IS DISTINCT FROM p_owner OR v_job.lease_until<=clock_timestamp() OR v_job.state NOT IN('building','deploying') THEN RETURN false;END IF;
 IF p_action='renew' THEN UPDATE farm_private.release_jobs SET lease_until=clock_timestamp()+interval '2 minutes' WHERE release_id=p_id;RETURN true;END IF;
 IF p_action='uncertain' THEN UPDATE farm_private.release_jobs SET state='review',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF p_action='failed' AND (v_job.state='building' OR (v_job.deployment_id IS NOT NULL AND v_job.deployment_id=p_deployment_id)) THEN UPDATE farm_private.release_jobs SET state='failed',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF p_artifact_hash IS NULL OR p_artifact_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Verified artifact checksum required.';END IF;
 IF p_action='built' AND v_job.state='building' THEN UPDATE farm_private.release_jobs SET state='deploying',artifact_hash=p_artifact_hash,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF v_job.state<>'deploying' OR v_job.artifact_hash IS DISTINCT FROM p_artifact_hash OR p_deployment_id IS NULL OR p_deployment_id!~'^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'Deployment identity/checksum mismatch.';END IF;
 IF p_action='submitted' AND (v_job.deployment_id IS NULL OR v_job.deployment_id=p_deployment_id) THEN UPDATE farm_private.release_jobs SET deployment_id=p_deployment_id,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF p_action='confirm' AND v_job.deployment_id=p_deployment_id THEN
  SELECT * INTO v_release FROM farm_private.releases WHERE id=p_id;
  IF v_release.base_release_id IS DISTINCT FROM v_live THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Live release changed; deployment requires review.';END IF;
  UPDATE farm_private.release_state SET live_release_id=p_id,withdrawn_ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(v_release.snapshot->'withdrawnIds')) WHERE singleton;
  UPDATE farm_private.release_jobs SET state='published',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;
 END IF;
 RAISE EXCEPTION 'Invalid release transition.';
END $$;
CREATE FUNCTION public.farm_release_reconcile(p_id uuid,p_deployment_id text,p_outcome text,p_artifact_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_job farm_private.release_jobs;v_release farm_private.releases;v_live uuid;
BEGIN
 SELECT live_release_id INTO v_live FROM farm_private.release_state WHERE singleton FOR UPDATE;
 SELECT * INTO v_job FROM farm_private.release_jobs WHERE release_id=p_id FOR UPDATE;
 IF v_job.state IS DISTINCT FROM 'review' THEN RETURN false;END IF;
 IF p_outcome='not_deployed' AND v_job.deployment_id IS NULL AND p_deployment_id IS NULL THEN UPDATE farm_private.release_jobs SET state='queued',updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF p_artifact_hash IS NULL OR p_artifact_hash IS DISTINCT FROM v_job.artifact_hash OR p_deployment_id IS NULL OR p_deployment_id!~'^[A-Za-z0-9_-]{1,128}$' OR (v_job.deployment_id IS NOT NULL AND v_job.deployment_id<>p_deployment_id) THEN RAISE EXCEPTION 'Provider evidence does not match this release.';END IF;
 IF p_outcome='failed' THEN UPDATE farm_private.release_jobs SET state='failed',deployment_id=p_deployment_id,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;END IF;
 IF p_outcome<>'published' THEN RAISE EXCEPTION 'Unknown reconciliation outcome.';END IF;
 SELECT * INTO v_release FROM farm_private.releases WHERE id=p_id;
 IF v_release.base_release_id IS DISTINCT FROM v_live THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Cannot reconcile over a newer live release.';END IF;
 UPDATE farm_private.release_state SET live_release_id=p_id,withdrawn_ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(v_release.snapshot->'withdrawnIds')) WHERE singleton;
 UPDATE farm_private.release_jobs SET state='published',deployment_id=p_deployment_id,updated_at=clock_timestamp() WHERE release_id=p_id;RETURN true;
END $$;
CREATE FUNCTION public.farm_release_rollback(p_source uuid,p_base uuid,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;v_live uuid;v_snapshot jsonb;v_withdrawn uuid[];v_digest text;v_existing farm_private.releases;
BEGIN
 v_actor:=farm_private.release_actor();SELECT live_release_id,withdrawn_ids INTO v_live,v_withdrawn FROM farm_private.release_state WHERE singleton FOR UPDATE;
 v_digest:=jsonb_build_object('source',p_source,'base',p_base)::text;SELECT * INTO v_existing FROM farm_private.releases WHERE request_id=p_request;
 IF FOUND THEN IF v_existing.request_digest<>v_digest THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Request key conflict.';END IF;RETURN jsonb_build_object('id',v_existing.id,'state',(SELECT state FROM farm_private.release_jobs WHERE release_id=v_existing.id));END IF;
 IF p_base IS DISTINCT FROM v_live THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Live release changed.';END IF;
 SELECT r.snapshot INTO v_snapshot FROM farm_private.releases r JOIN farm_private.release_jobs j ON j.release_id=r.id WHERE r.id=p_source AND j.state='published';
 IF v_snapshot IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Choose a previously published release.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.farm_content WHERE id=(v_snapshot->'homepage'->>'id')::uuid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Homepage unavailable.';END IF;
 v_snapshot:=jsonb_set(v_snapshot,'{posts}',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(v_snapshot->'posts') WHERE NOT(value->>'id')::uuid=ANY(v_withdrawn) AND EXISTS(SELECT 1 FROM public.farm_content c WHERE c.id=(value->>'id')::uuid AND c.deleted_at IS NULL)),'[]'));
 v_snapshot:=jsonb_set(jsonb_set(v_snapshot,'{withdrawnIds}',to_jsonb(v_withdrawn)),'{capturedAt}',to_jsonb(clock_timestamp()));
 RETURN farm_private.store_release(v_actor,p_base,v_snapshot,p_request,v_digest);
END $$;
CREATE FUNCTION farm_private.protect_release_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='farm_media' THEN
 IF NEW.deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM farm_private.release_media_refs u JOIN public.farm_media_versions v ON v.id=u.media_version_id WHERE v.media_id=OLD.id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Photo is retained by a release.';END IF;
 END IF;
 IF TG_TABLE_NAME='farm_media_versions' THEN
 IF NEW.state<>'ready' AND EXISTS(SELECT 1 FROM farm_private.release_media_refs WHERE media_version_id=OLD.id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Photo version is retained by a release.';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER farm_release_media_parent BEFORE UPDATE OF deleted_at ON public.farm_media FOR EACH ROW EXECUTE FUNCTION farm_private.protect_release_media();
CREATE TRIGGER farm_release_media_version BEFORE UPDATE OF state ON public.farm_media_versions FOR EACH ROW EXECUTE FUNCTION farm_private.protect_release_media();
REVOKE ALL ON FUNCTION farm_private.release_immutable(),farm_private.release_actor(),farm_private.store_release(uuid,uuid,jsonb,uuid,text),farm_private.protect_release_media() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.farm_release_prepare(jsonb,uuid,uuid[],uuid),public.farm_release_list(),public.farm_release_read(uuid),public.farm_release_rollback(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.farm_release_prepare(jsonb,uuid,uuid[],uuid),public.farm_release_list(),public.farm_release_read(uuid),public.farm_release_rollback(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.farm_release_claim(uuid),public.farm_release_worker_update(uuid,uuid,text,text,text),public.farm_release_reconcile(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.farm_release_claim(uuid),public.farm_release_worker_update(uuid,uuid,text,text,text),public.farm_release_reconcile(uuid,text,text,text) TO service_role;
INSERT INTO farm_private.schema_migrations(version) VALUES('202611210012_release_commands');NOTIFY pgrst,'reload schema';
COMMIT;
