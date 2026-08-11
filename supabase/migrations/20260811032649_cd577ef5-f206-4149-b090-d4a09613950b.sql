-- 1. Group membership: self-join only for public groups or invited users
DROP POLICY IF EXISTS "Join groups" ON public.group_members;
CREATE POLICY "Join groups"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_group_admin(group_id, auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.is_public)
      OR private.has_group_invite(group_id, auth.uid())
    )
  )
);

-- 2. Google Calendar tables: allow owners to create/update their own rows
CREATE POLICY "Users can create their own google connection"
ON public.google_calendar_connections
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google connection"
ON public.google_calendar_connections
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync map"
ON public.google_calendar_sync_map
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync map"
ON public.google_calendar_sync_map
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Likes are immutable by design
REVOKE UPDATE ON public.post_likes FROM authenticated;
REVOKE UPDATE ON public.post_likes FROM anon;

-- 4. Move friend-check helpers out of the exposed API schema
CREATE OR REPLACE FUNCTION private.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  )
$$;

CREATE OR REPLACE FUNCTION private.has_friend_link(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.requester_id = _a AND f.addressee_id = _b)
       OR (f.requester_id = _b AND f.addressee_id = _a)
  )
$$;

GRANT EXECUTE ON FUNCTION private.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_friend_link(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Friends and self can view posts" ON public.posts;
CREATE POLICY "Friends and self can view posts"
ON public.posts FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR private.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "View likes on visible posts" ON public.post_likes;
CREATE POLICY "View likes on visible posts"
ON public.post_likes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_likes.post_id
    AND (p.user_id = auth.uid() OR private.are_friends(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Like visible posts" ON public.post_likes;
CREATE POLICY "Like visible posts"
ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_likes.post_id
    AND (p.user_id = auth.uid() OR private.are_friends(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "View comments on visible posts" ON public.post_comments;
CREATE POLICY "View comments on visible posts"
ON public.post_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_comments.post_id
    AND (p.user_id = auth.uid() OR private.are_friends(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Comment on visible posts" ON public.post_comments;
CREATE POLICY "Comment on visible posts"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_comments.post_id
    AND (p.user_id = auth.uid() OR private.are_friends(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Friends and self can view live stories" ON public.stories;
CREATE POLICY "Friends and self can view live stories"
ON public.stories FOR SELECT TO authenticated
USING (expires_at > now() AND (auth.uid() = user_id OR private.are_friends(auth.uid(), user_id)));

DROP POLICY IF EXISTS "Read social media of friends" ON storage.objects;
CREATE POLICY "Read social media of friends"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'social'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.are_friends(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);

DROP POLICY IF EXISTS "Profiles visible to self, friends, group mates and chat partner" ON public.profiles;
CREATE POLICY "Profiles visible to self, friends, group mates and chat partner"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR private.has_friend_link(auth.uid(), id)
  OR private.shares_group_with(auth.uid(), id)
  OR private.has_dm_with(auth.uid(), id)
);

DROP FUNCTION IF EXISTS public.are_friends(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_friend_link(uuid, uuid);