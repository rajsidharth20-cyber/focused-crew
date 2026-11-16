ALTER TABLE public.notification_preferences ADD COLUMN story_likes boolean NOT NULL DEFAULT true, ADD COLUMN new_posts boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.social_post_notification_recipients(_post_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.id FROM public.posts post JOIN public.profiles author ON author.id=post.user_id JOIN public.profiles p ON p.id<>post.user_id
 WHERE post.id=_post_id AND post.user_id=auth.uid()
 AND (EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted' AND ((f.requester_id=post.user_id AND f.addressee_id=p.id) OR (f.addressee_id=post.user_id AND f.requester_id=p.id)))
 OR (NOT author.is_private AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=p.id AND f.following_id=post.user_id AND f.status='accepted')))
 AND (NOT author.is_private OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=p.id AND f.following_id=post.user_id AND f.status='accepted'))
 AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id=post.user_id AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=post.user_id));
$$;
REVOKE ALL ON FUNCTION public.social_post_notification_recipients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_post_notification_recipients(uuid) TO authenticated;