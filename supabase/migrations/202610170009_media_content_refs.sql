-- Tie immutable content revisions to sanitized private photo versions.
-- This does not publish drafts or alter the approved public asset pipeline.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170008_private_media') THEN RAISE EXCEPTION 'Migration 008 is required.';END IF;
 IF EXISTS(SELECT 1 FROM farm_private.schema_migrations WHERE version='202610170009_media_content_refs') THEN RAISE EXCEPTION 'Migration 009 already applied; do not rerun.';END IF;
END $$;
CREATE FUNCTION farm_private.attach_revision_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_media_version uuid;v_media_id uuid;v_state text;v_deleted timestamptz;
BEGIN
 IF coalesce(NEW.payload->>'mediaVersionId','')='' THEN RETURN NEW;END IF;
 IF NEW.payload->>'mediaVersionId'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid private photo reference.';
 END IF;
 v_media_version:=(NEW.payload->>'mediaVersionId')::uuid;
 -- Lock parent then version, matching farm_media_remove/farm_media_ready lock order.
 SELECT v.media_id INTO v_media_id FROM public.farm_media_versions AS v WHERE v.id=v_media_version;
 SELECT m.deleted_at INTO v_deleted FROM public.farm_media AS m WHERE m.id=v_media_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Private photo is unavailable.';END IF;
 SELECT v.state INTO v_state FROM public.farm_media_versions AS v WHERE v.id=v_media_version AND v.media_id=v_media_id FOR UPDATE;
 IF v_state IS DISTINCT FROM 'ready' OR v_deleted IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Private photo is unavailable.';END IF;
 INSERT INTO public.farm_media_usages(revision_id,media_version_id) VALUES(NEW.id,v_media_version);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farm_private.attach_revision_media() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER farm_revision_media_link AFTER INSERT ON public.farm_revisions FOR EACH ROW EXECUTE FUNCTION farm_private.attach_revision_media();
INSERT INTO farm_private.schema_migrations(version) VALUES('202610170009_media_content_refs');
NOTIFY pgrst,'reload schema';
COMMIT;
