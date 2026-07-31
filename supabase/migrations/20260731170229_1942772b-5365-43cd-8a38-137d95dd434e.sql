-- 1. Case-insensitive unique usernames
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. Helper: do two users have a direct message history?
CREATE OR REPLACE FUNCTION private.has_dm_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE (m.sender_id = _a AND m.receiver_id = _b)
       OR (m.sender_id = _b AND m.receiver_id = _a)
  )
$$;
REVOKE EXECUTE ON FUNCTION private.has_dm_with(uuid, uuid) FROM anon, authenticated, public;

-- 3. Restrict profile discovery
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Profiles visible to self, group mates and chat partners"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR private.shares_group_with(auth.uid(), id)
  OR private.has_dm_with(auth.uid(), id)
);

-- 4. Username search (exact / prefix, min 3 chars)
CREATE OR REPLACE FUNCTION public.search_profiles_by_username(_term text)
RETURNS TABLE (id uuid, username text, full_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(trim(_term)) >= 3
    AND p.username IS NOT NULL
    AND p.id <> auth.uid()
    AND lower(p.username) LIKE lower(trim(_term)) || '%'
  ORDER BY (lower(p.username) = lower(trim(_term))) DESC, p.username
  LIMIT 20
$$;
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_username(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_username(text) TO authenticated;

-- 5. Username availability + suggestions
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND length(trim(_username)) >= 3
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE lower(p.username) = lower(trim(_username)) AND p.id <> auth.uid()
     )
$$;
REVOKE EXECUTE ON FUNCTION public.username_available(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.suggest_usernames(_base text DEFAULT NULL)
RETURNS TABLE (username text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adjectives text[] := ARRAY['swift','calm','bright','sharp','steady','bold','clever','quiet','rapid','keen'];
  nouns text[] := ARRAY['pilot','falcon','comet','ranger','skipper','nova','jet','condor','vector','beacon'];
  base text := lower(regexp_replace(coalesce(_base, ''), '[^a-zA-Z0-9]', '', 'g'));
  candidate text;
  i int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  WHILE i < 300 LOOP
    i := i + 1;
    IF base <> '' AND i <= 60 THEN
      candidate := base || (floor(random() * 9000 + 100))::int::text;
    ELSE
      candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
                || nouns[1 + floor(random() * array_length(nouns, 1))::int]
                || (floor(random() * 900 + 10))::int::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = candidate) THEN
      username := candidate;
      RETURN NEXT;
      IF (SELECT count(*) FROM (SELECT 1) t) IS NOT NULL AND i >= 0 THEN
        NULL;
      END IF;
    END IF;
    EXIT WHEN i >= 300;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.suggest_usernames(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.suggest_usernames(text) TO authenticated;

-- 6. Per-user message hiding (Telegram-style "delete for me")
CREATE TABLE IF NOT EXISTS public.hidden_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'dm',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id, scope)
);
GRANT SELECT, INSERT, DELETE ON public.hidden_messages TO authenticated;
GRANT ALL ON public.hidden_messages TO service_role;
ALTER TABLE public.hidden_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hidden messages"
ON public.hidden_messages FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Live study presence
CREATE TABLE IF NOT EXISTS public.study_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_studying boolean NOT NULL DEFAULT false,
  mode text,
  topic text,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_presence TO authenticated;
GRANT ALL ON public.study_presence TO service_role;
ALTER TABLE public.study_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own presence"
ON public.study_presence FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Group mates view presence"
ON public.study_presence FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.shares_group_with(auth.uid(), user_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.study_presence;
ALTER TABLE public.study_presence REPLICA IDENTITY FULL;