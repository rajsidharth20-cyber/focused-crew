-- ============ FRIENDSHIPS (mutual) ============
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_status_chk CHECK (status IN ('pending','accepted')),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id, status);
CREATE INDEX friendships_requester_idx ON public.friendships(requester_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own friendships" ON public.friendships FOR SELECT TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Send friend request" ON public.friendships FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY "Addressee can accept" ON public.friendships FOR UPDATE TO authenticated
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Either side can remove" ON public.friendships FOR DELETE TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ helper ============
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

-- ============ POSTS ============
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'photo',
  caption text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_kind_chk CHECK (kind IN ('photo','text','analysis'))
);
CREATE INDEX posts_user_created_idx ON public.posts(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Friends and self can view posts" ON public.posts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

CREATE POLICY "Create own posts" ON public.posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own posts" ON public.posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own posts" ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POST LIKES ============
CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX post_likes_post_idx ON public.post_likes(post_id);

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View likes on visible posts" ON public.post_likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id
  AND (p.user_id = auth.uid() OR public.are_friends(auth.uid(), p.user_id))));

CREATE POLICY "Like visible posts" ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id
  AND (p.user_id = auth.uid() OR public.are_friends(auth.uid(), p.user_id))));

CREATE POLICY "Remove own like" ON public.post_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============ POST COMMENTS ============
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_comments_post_idx ON public.post_comments(post_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on visible posts" ON public.post_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id
  AND (p.user_id = auth.uid() OR public.are_friends(auth.uid(), p.user_id))));

CREATE POLICY "Comment on visible posts" ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id
  AND (p.user_id = auth.uid() OR public.are_friends(auth.uid(), p.user_id))));

CREATE POLICY "Delete own comment or on own post" ON public.post_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

-- ============ STORIES ============
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text,
  caption text,
  background text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX stories_user_idx ON public.stories(user_id, created_at DESC);
CREATE INDEX stories_expires_idx ON public.stories(expires_at);

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Friends and self can view live stories" ON public.stories FOR SELECT TO authenticated
USING (expires_at > now() AND (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id)));

CREATE POLICY "Create own stories" ON public.stories FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own stories" ON public.stories FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============ STORAGE POLICIES (bucket: social) ============
CREATE POLICY "Read social media of friends" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'social' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR public.are_friends(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
));

CREATE POLICY "Upload own social media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'social' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Delete own social media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'social' AND (storage.foldername(name))[1] = auth.uid()::text);