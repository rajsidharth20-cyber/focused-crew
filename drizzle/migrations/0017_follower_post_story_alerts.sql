CREATE OR REPLACE FUNCTION public.social_post_notification_recipients(_post_id uuid)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.id FROM public.posts post JOIN public.profiles p ON p.id<>post.user_id
 WHERE post.id=_post_id AND post.user_id=auth.uid()
 AND (private.are_friends(p.id, post.user_id) OR private.is_follower(p.id, post.user_id))
 AND NOT private.is_blocked(p.id, post.user_id);
$$;
CREATE OR REPLACE FUNCTION public.social_story_notification_recipients(_story_id uuid)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.id FROM public.stories s JOIN public.profiles p ON p.id<>s.user_id
 WHERE s.id=_story_id AND s.user_id=auth.uid() AND s.expires_at>now()
 AND (private.are_friends(p.id, s.user_id) OR private.is_follower(p.id, s.user_id))
 AND NOT private.is_blocked(p.id, s.user_id);
$$;
REVOKE ALL ON FUNCTION public.social_story_notification_recipients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_story_notification_recipients(uuid) TO authenticated;