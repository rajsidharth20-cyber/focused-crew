CREATE OR REPLACE FUNCTION public.has_friend_link(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.requester_id = _a AND f.addressee_id = _b)
       OR (f.requester_id = _b AND f.addressee_id = _a)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_friend_link(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_friend_link(uuid, uuid) TO authenticated, service_role;

DROP POLICY "Profiles visible to self, group mates and chat partners" ON public.profiles;
CREATE POLICY "Profiles visible to self, friends, group mates and chat partners"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_friend_link(auth.uid(), id)
  OR private.shares_group_with(auth.uid(), id)
  OR private.has_dm_with(auth.uid(), id)
);