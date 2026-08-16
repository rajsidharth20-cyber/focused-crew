-- =========================================================
-- 1. ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'moderator')
  )
$$;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.is_staff(auth.uid()));

-- =========================================================
-- 2. BLOCKING
-- =========================================================
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

CREATE POLICY "Users view own block list" ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "Users block others" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "Users unblock" ON public.blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION private.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = _a AND b.blocked_id = _b)
       OR (b.blocker_id = _b AND b.blocked_id = _a)
  )
$$;
REVOKE ALL ON FUNCTION private.is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- 3. RESTRICTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  restricted_until timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_restrictions TO authenticated;
GRANT ALL ON public.user_restrictions TO service_role;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS user_restrictions_active_idx
  ON public.user_restrictions (user_id, restricted_until DESC);

CREATE POLICY "See own restrictions or staff sees all" ON public.user_restrictions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.is_staff(auth.uid()));
CREATE POLICY "Staff create restrictions" ON public.user_restrictions
  FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff lift restrictions" ON public.user_restrictions
  FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.is_restricted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_restrictions r
    WHERE r.user_id = _user_id AND r.restricted_until > now()
  )
$$;
REVOKE ALL ON FUNCTION private.is_restricted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_restricted(uuid) TO authenticated, service_role;

-- =========================================================
-- 4. RATE LIMITS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: the table is only touched by SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION private.bump_rate_limit(_user uuid, _action text, _limit integer, _window interval)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  INSERT INTO public.rate_limits (user_id, action, window_start, count)
  VALUES (_user, _action, now(), 1)
  ON CONFLICT (user_id, action) DO UPDATE
    SET count = CASE WHEN public.rate_limits.window_start < now() - _window THEN 1
                     ELSE public.rate_limits.count + 1 END,
        window_start = CASE WHEN public.rate_limits.window_start < now() - _window THEN now()
                            ELSE public.rate_limits.window_start END
  RETURNING count INTO c;
  RETURN c <= _limit;
END $$;
REVOKE ALL ON FUNCTION private.bump_rate_limit(uuid, text, integer, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.bump_rate_limit(uuid, text, integer, interval) TO authenticated, service_role;

-- Callable by edge functions (AI endpoints) through the Data API.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_action text, _limit integer, _window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN private.bump_rate_limit(auth.uid(), _action, _limit, make_interval(secs => _window_seconds));
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO authenticated, service_role;

-- Generic guard: blocks restricted accounts and enforces a per-action quota.
CREATE OR REPLACE FUNCTION private.enforce_write_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lim integer := COALESCE(NULLIF(TG_ARGV[1], '')::integer, 30);
  win interval := COALESCE(NULLIF(TG_ARGV[2], ''), '1 hour')::interval;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.is_restricted(auth.uid()) THEN
    RAISE EXCEPTION 'Your account is temporarily restricted.' USING ERRCODE = '55000';
  END IF;
  IF NOT private.bump_rate_limit(auth.uid(), TG_ARGV[0], lim, win) THEN
    RAISE EXCEPTION 'Rate limit reached for %. Please slow down and try again later.', TG_ARGV[0]
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quota_messages ON public.messages;
CREATE TRIGGER quota_messages BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('dm', '60', '1 hour');

DROP TRIGGER IF EXISTS quota_group_messages ON public.group_messages;
CREATE TRIGGER quota_group_messages BEFORE INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('group_message', '150', '1 hour');

DROP TRIGGER IF EXISTS quota_posts ON public.posts;
CREATE TRIGGER quota_posts BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('post', '20', '1 hour');

DROP TRIGGER IF EXISTS quota_stories ON public.stories;
CREATE TRIGGER quota_stories BEFORE INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('story', '20', '1 hour');

DROP TRIGGER IF EXISTS quota_comments ON public.post_comments;
CREATE TRIGGER quota_comments BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('comment', '60', '1 hour');

DROP TRIGGER IF EXISTS quota_friend_requests ON public.friendships;
CREATE TRIGGER quota_friend_requests BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('friend_request', '30', '1 hour');

-- =========================================================
-- 5. REPORTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'message', 'group_message', 'story', 'user')),
  target_id uuid NOT NULL,
  target_user_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_user_idx ON public.reports (target_user_id);

CREATE POLICY "Reporters and staff read reports" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR private.is_staff(auth.uid()));
CREATE POLICY "Anyone can report" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Staff resolve reports" ON public.reports
  FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS quota_reports ON public.reports;
CREATE TRIGGER quota_reports BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION private.enforce_write_quota('report', '20', '1 hour');

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. CONSENT-GATED DIRECT MESSAGES + BLOCK ENFORCEMENT
-- =========================================================
CREATE OR REPLACE FUNCTION private.dm_allowed(_sender uuid, _receiver uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE intro_count integer;
BEGIN
  IF _sender = _receiver THEN RETURN true; END IF;
  IF private.is_blocked(_sender, _receiver) THEN RETURN false; END IF;
  IF private.are_friends(_sender, _receiver) THEN RETURN true; END IF;
  IF private.shares_group_with(_sender, _receiver) THEN RETURN true; END IF;
  -- The receiver already replied at least once: the conversation is consented.
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.sender_id = _receiver AND m.receiver_id = _sender) THEN
    RETURN true;
  END IF;
  -- Otherwise allow at most 3 unanswered introduction messages.
  SELECT count(*) INTO intro_count
  FROM public.messages m WHERE m.sender_id = _sender AND m.receiver_id = _receiver;
  RETURN intro_count < 3;
END $$;
REVOKE ALL ON FUNCTION private.dm_allowed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.dm_allowed(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.messages;
CREATE POLICY "Send DMs to allowed contacts" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND private.dm_allowed(sender_id, receiver_id));

DROP POLICY IF EXISTS "Send friend request" ON public.friendships;
CREATE POLICY "Send friend request" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND NOT private.is_blocked(requester_id, addressee_id)
  );

DROP POLICY IF EXISTS "Friends and self can view posts" ON public.posts;
CREATE POLICY "Friends and self can view posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (private.are_friends(auth.uid(), user_id) AND NOT private.is_blocked(auth.uid(), user_id))
  );

DROP POLICY IF EXISTS "Friends and self can view live stories" ON public.stories;
CREATE POLICY "Friends and self can view live stories" ON public.stories
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      auth.uid() = user_id
      OR (private.are_friends(auth.uid(), user_id) AND NOT private.is_blocked(auth.uid(), user_id))
    )
  );

-- =========================================================
-- 7. MODERATOR TAKEDOWN POWERS
-- =========================================================
CREATE POLICY "Staff remove posts" ON public.posts
  FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff remove comments" ON public.post_comments
  FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff remove stories" ON public.stories
  FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff remove group messages" ON public.group_messages
  FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));

-- =========================================================
-- 8. MISSING INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON public.messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subjects_user_idx ON public.subjects (user_id, sort_order);
CREATE INDEX IF NOT EXISTS commitments_user_idx ON public.commitments (user_id, date);
CREATE INDEX IF NOT EXISTS events_user_idx ON public.events (user_id, event_date);
CREATE INDEX IF NOT EXISTS weekly_targets_user_idx ON public.weekly_targets (user_id);
CREATE INDEX IF NOT EXISTS user_quotes_user_idx ON public.user_quotes (user_id);
CREATE INDEX IF NOT EXISTS daily_objectives_user_date_idx ON public.daily_objectives (user_id, date);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS story_views_user_idx ON public.story_views (user_id);
CREATE INDEX IF NOT EXISTS story_likes_user_idx ON public.story_likes (user_id);
CREATE INDEX IF NOT EXISTS post_comments_user_idx ON public.post_comments (user_id);
CREATE INDEX IF NOT EXISTS group_announcements_group_idx ON public.group_announcements (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_invites_invitee_idx ON public.group_invites (invitee_id, status);
CREATE INDEX IF NOT EXISTS hidden_messages_user_idx ON public.hidden_messages (user_id);