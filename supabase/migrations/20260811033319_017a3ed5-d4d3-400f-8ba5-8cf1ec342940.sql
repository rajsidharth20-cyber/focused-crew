CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View story views of own stories or self"
ON public.story_views FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
);

CREATE POLICY "Record own view on visible stories"
ON public.story_views FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_id
      AND (s.user_id = auth.uid() OR private.are_friends(auth.uid(), s.user_id))
  )
);

CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View story likes of visible stories"
ON public.story_likes FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_id
      AND (s.user_id = auth.uid() OR private.are_friends(auth.uid(), s.user_id))
  )
);

CREATE POLICY "Like visible stories"
ON public.story_likes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_id
      AND (s.user_id = auth.uid() OR private.are_friends(auth.uid(), s.user_id))
  )
);

CREATE POLICY "Unlike own story like"
ON public.story_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());