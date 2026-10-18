-- Stage 2: reviewed source, NOT evidence of an applied/verified hosted migration.
-- Run only in the selected disposable ohajiugwo-development project after preflight.
-- One transaction. Existing farm namespace/bucket causes a stop; never overwrite it.
BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='farm_private')
 OR EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'farm_%')
 OR EXISTS (SELECT 1 FROM storage.buckets WHERE id='farm-photographs') THEN
  RAISE EXCEPTION 'Existing farm setup detected. Inspect migrations before proceeding; do not reset or overwrite.';
 END IF;
END $$;
CREATE SCHEMA farm_private;
REVOKE ALL ON SCHEMA farm_private FROM PUBLIC, anon, authenticated;

CREATE TABLE farm_private.schema_migrations (
 version text PRIMARY KEY,
 applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO farm_private.schema_migrations(version) VALUES('202610160001_security_foundation');
CREATE TABLE farm_private.admin_guard (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 active_count integer NOT NULL DEFAULT 0 CHECK (active_count>=0)
);
INSERT INTO farm_private.admin_guard(singleton,active_count) VALUES(true,0);
CREATE TABLE farm_private.memberships (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK (state IN ('pending','active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE farm_private.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 cookie_hash text NOT NULL UNIQUE,
 provider_session_id text NOT NULL UNIQUE,
 encrypted_credentials text NOT NULL,
 csrf_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 idle_expires_at timestamptz NOT NULL,
 absolute_expires_at timestamptz NOT NULL,
 reauthenticated_at timestamptz,
 revoked_at timestamptz,
 CHECK (idle_expires_at<=absolute_expires_at),
 CHECK (absolute_expires_at<=created_at+interval '12 hours')
);
CREATE INDEX ON farm_private.sessions(user_id);
CREATE TABLE farm_private.invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_email text NOT NULL CHECK (recipient_email=lower(btrim(recipient_email))),
 user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 invited_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK (state IN ('queued','sent','accepted','cancelled','expired')),
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 nonce_hash text NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX farm_pending_recipient ON farm_private.invitations(recipient_email)
 WHERE state IN ('queued','sent');
CREATE TABLE farm_private.security_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid,
 event_type text NOT NULL,
 outcome text NOT NULL,
 target_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE farm_private.auth_attempts (
 scope_hash text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 attempts integer NOT NULL CHECK(attempts>=0),
 blocked_until timestamptz
);
-- Serialize active-count changes even when two administrators revoke each other.
CREATE FUNCTION farm_private.protect_last_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE delta integer:=0;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.state='active' THEN delta:=1; END IF;
 ELSIF TG_OP='DELETE' THEN
  IF OLD.state='active' THEN delta:=-1; END IF;
 ELSE
  delta:=(CASE WHEN NEW.state='active' THEN 1 ELSE 0 END)
       -(CASE WHEN OLD.state='active' THEN 1 ELSE 0 END);
 END IF;
 IF delta<>0 THEN
  UPDATE farm_private.admin_guard SET active_count=active_count+delta
   WHERE singleton AND active_count+delta>=1;
  IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cannot remove or disable the last active administrator.';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farm_private.protect_last_admin() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER farm_membership_count BEFORE INSERT OR UPDATE OR DELETE
 ON farm_private.memberships FOR EACH ROW EXECUTE FUNCTION farm_private.protect_last_admin();

-- A stale provider JWT alone must not survive application logout, expiry or revocation.
CREATE FUNCTION public.farm_has_active_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM farm_private.memberships m JOIN farm_private.sessions s ON s.user_id=m.user_id
  WHERE m.user_id=auth.uid() AND m.state='active'
    AND s.provider_session_id=(auth.jwt()->>'session_id')
    AND s.revoked_at IS NULL
    AND s.idle_expires_at>now() AND s.absolute_expires_at>now()
 );
$$;
REVOKE ALL ON FUNCTION public.farm_has_active_session() FROM PUBLIC,anon;
-- Safe boolean predicate returns false without a verified user/session.
-- Anon may call it so restrictive Storage guards do not break other buckets.
GRANT EXECUTE ON FUNCTION public.farm_has_active_session() TO anon,authenticated;

CREATE TABLE public.farm_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('homepage','post')),
 draft_revision integer NOT NULL DEFAULT 1 CHECK(draft_revision>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 review_only boolean NOT NULL DEFAULT true,
 deleted_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX farm_homepage_singleton ON public.farm_content(kind) WHERE kind='homepage';
CREATE TABLE public.farm_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_id uuid NOT NULL REFERENCES public.farm_content(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(content_id,revision)
);
CREATE TABLE public.farm_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
 deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.farm_media_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 media_id uuid NOT NULL REFERENCES public.farm_media(id) ON DELETE RESTRICT,
 original_path text NOT NULL UNIQUE,
 preview_path text UNIQUE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','quarantined')),
 checksum text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (state<>'ready' OR (preview_path IS NOT NULL AND checksum IS NOT NULL))
);
CREATE TABLE public.farm_media_usages (
 revision_id uuid NOT NULL REFERENCES public.farm_revisions(id) ON DELETE RESTRICT,
 media_version_id uuid NOT NULL REFERENCES public.farm_media_versions(id) ON DELETE RESTRICT,
 PRIMARY KEY(revision_id,media_version_id)
);

-- Enable RLS even for the non-exposed private tables. No direct private role grants.
ALTER TABLE farm_private.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.admin_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_private.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA farm_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA farm_private FROM PUBLIC,anon,authenticated;

ALTER TABLE public.farm_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_media_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_media_usages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.farm_content,public.farm_revisions,public.farm_media,
 public.farm_media_versions,public.farm_media_usages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.farm_content,public.farm_revisions,public.farm_media,
 public.farm_media_versions,public.farm_media_usages TO authenticated;
CREATE POLICY farm_content_read ON public.farm_content FOR SELECT TO authenticated USING(public.farm_has_active_session());
CREATE POLICY farm_revisions_read ON public.farm_revisions FOR SELECT TO authenticated USING(public.farm_has_active_session());
CREATE POLICY farm_media_read ON public.farm_media FOR SELECT TO authenticated USING(public.farm_has_active_session());
CREATE POLICY farm_versions_read ON public.farm_media_versions FOR SELECT TO authenticated USING(public.farm_has_active_session());
CREATE POLICY farm_usages_read ON public.farm_media_usages FOR SELECT TO authenticated USING(public.farm_has_active_session());
-- There are deliberately no browser write grants/policies. Validated atomic RPCs follow later.

-- Create the private bucket AFTER this transaction, via npm run admin:configure-storage.
-- Do not write managed Storage metadata directly in SQL.
CREATE POLICY farm_photographs_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='farm-photographs' AND public.farm_has_active_session() AND EXISTS(
  SELECT 1 FROM public.farm_media_versions v WHERE v.state='ready'
   AND (v.original_path=storage.objects.name OR v.preview_path=storage.objects.name)
 ));
-- Existing permissive Storage policies must be inspected before relying on this policy.
-- Add a restrictive guard so any unrelated permissive policy cannot expose this bucket.
CREATE POLICY farm_photographs_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(bucket_id<>'farm-photographs' OR public.farm_has_active_session());
CREATE POLICY farm_photographs_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
 WITH CHECK(bucket_id<>'farm-photographs');
CREATE POLICY farm_photographs_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
 USING(bucket_id<>'farm-photographs') WITH CHECK(bucket_id<>'farm-photographs');
CREATE POLICY farm_photographs_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
 USING(bucket_id<>'farm-photographs');
-- Service-role maintenance bypasses RLS; that key must remain server-only.
COMMIT;
