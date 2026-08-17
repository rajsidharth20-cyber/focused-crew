-- 1. Objective duplicates -------------------------------------------------
DELETE FROM public.daily_objectives a
USING public.daily_objectives b
WHERE a.template_id IS NOT NULL
  AND a.template_id = b.template_id
  AND a.user_id = b.user_id
  AND a.date = b.date
  AND a.is_template = false AND b.is_template = false
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS daily_objectives_template_day_uniq
  ON public.daily_objectives (user_id, template_id, date)
  WHERE template_id IS NOT NULL AND is_template = false;

-- 2. Profile settings -------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS day_start_hour smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_day_start_hour_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_day_start_hour_range CHECK (day_start_hour BETWEEN 0 AND 11);

-- 3. Follows ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_status_check CHECK (status IN ('pending','accepted')),
  CONSTRAINT follows_not_self CHECK (follower_id <> following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id, status);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own follow rows" ON public.follows;
CREATE POLICY "View own follow rows" ON public.follows FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

DROP POLICY IF EXISTS "Follow others" ON public.follows;
CREATE POLICY "Follow others" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND NOT private.is_blocked(auth.uid(), following_id));

DROP POLICY IF EXISTS "Target accepts follow" ON public.follows;
CREATE POLICY "Target accepts follow" ON public.follows FOR UPDATE TO authenticated
  USING (following_id = auth.uid()) WITH CHECK (following_id = auth.uid());

DROP POLICY IF EXISTS "Either side removes follow" ON public.follows;
CREATE POLICY "Either side removes follow" ON public.follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE TRIGGER follows_updated_at BEFORE UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- status is decided by the target's privacy setting, never by the client
CREATE OR REPLACE FUNCTION private.set_follow_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT is_private FROM public.profiles WHERE id = NEW.following_id) THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.set_follow_status() FROM PUBLIC;

CREATE TRIGGER follows_set_status BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION private.set_follow_status();

-- 4. Visibility helpers ------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_follower(_viewer uuid, _owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = _viewer AND f.following_id = _owner AND f.status = 'accepted'
  )
$$;
REVOKE ALL ON FUNCTION private.is_follower(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_follower(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.has_follow_link(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows f
    WHERE (f.follower_id = _a AND f.following_id = _b)
       OR (f.follower_id = _b AND f.following_id = _a)
  )
$$;
REVOKE ALL ON FUNCTION private.has_follow_link(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_follow_link(uuid, uuid) TO authenticated;

-- 5. Follower-aware content visibility --------------------------------------
DROP POLICY IF EXISTS "Friends and self can view posts" ON public.posts;
CREATE POLICY "Friends, followers and self can view posts" ON public.posts FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR ((private.are_friends(auth.uid(), user_id) OR private.is_follower(auth.uid(), user_id))
        AND NOT private.is_blocked(auth.uid(), user_id))
  );

DROP POLICY IF EXISTS "Friends and self can view live stories" ON public.stories;
CREATE POLICY "Friends, followers and self can view live stories" ON public.stories FOR SELECT TO authenticated
  USING (
    expires_at > now() AND (
      auth.uid() = user_id
      OR ((private.are_friends(auth.uid(), user_id) OR private.is_follower(auth.uid(), user_id))
          AND NOT private.is_blocked(auth.uid(), user_id))
    )
  );

DROP POLICY IF EXISTS "Profiles visible to self, friends, group mates and chat partner" ON public.profiles;
CREATE POLICY "Profiles visible to self, connections and chat partners" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR private.has_friend_link(auth.uid(), id)
    OR private.has_follow_link(auth.uid(), id)
    OR private.shares_group_with(auth.uid(), id)
    OR private.has_dm_with(auth.uid(), id)
  );

-- 6. Profile overview RPC ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_overview(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  prof record;
  can_see boolean;
  result jsonb;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  SELECT id, username, full_name, bio, avatar_url, is_private
    INTO prof FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF private.is_blocked(me, _user_id) THEN RETURN NULL; END IF;

  can_see := (me = _user_id)
          OR (NOT prof.is_private)
          OR private.is_follower(me, _user_id)
          OR private.are_friends(me, _user_id);

  result := jsonb_build_object(
    'id', prof.id,
    'username', prof.username,
    'full_name', prof.full_name,
    'bio', prof.bio,
    'avatar_url', prof.avatar_url,
    'is_private', prof.is_private,
    'is_self', me = _user_id,
    'can_see', can_see,
    'follow_status', (SELECT status FROM public.follows WHERE follower_id = me AND following_id = _user_id),
    'follows_me', EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _user_id AND following_id = me AND status = 'accepted'),
    'posts_count', (SELECT count(*) FROM public.posts WHERE user_id = _user_id),
    'followers_count', (SELECT count(*) FROM public.follows WHERE following_id = _user_id AND status = 'accepted'),
    'following_count', (SELECT count(*) FROM public.follows WHERE follower_id = _user_id AND status = 'accepted')
  );

  IF can_see THEN
    result := result || jsonb_build_object(
      'total_minutes', COALESCE((SELECT sum(duration_seconds)/60 FROM public.study_sessions WHERE user_id = _user_id), 0),
      'week_minutes', COALESCE((SELECT sum(duration_seconds)/60 FROM public.study_sessions
                                WHERE user_id = _user_id AND started_at > now() - interval '7 days'), 0),
      'sessions_count', (SELECT count(*) FROM public.study_sessions WHERE user_id = _user_id),
      'top_subjects', COALESCE((
        SELECT jsonb_agg(t) FROM (
          SELECT s.name, s.color, sum(ss.duration_seconds)/60 AS minutes
          FROM public.study_sessions ss
          JOIN public.subjects s ON s.id = ss.subject_id
          WHERE ss.user_id = _user_id AND ss.started_at > now() - interval '30 days'
          GROUP BY s.name, s.color
          ORDER BY 3 DESC
          LIMIT 5
        ) t), '[]'::jsonb)
    );
  END IF;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_profile_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_overview(uuid) TO authenticated;