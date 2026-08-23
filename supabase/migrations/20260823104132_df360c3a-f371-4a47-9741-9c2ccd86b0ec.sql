-- Remove anonymous / PUBLIC execute rights on SECURITY DEFINER functions in the public schema.
REVOKE ALL ON FUNCTION public.get_profile_overview(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.announcement_read_counts() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.search_profiles_by_username(text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.suggest_usernames(text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.username_available(text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.add_group_owner_member() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, PUBLIC;

-- Private schema helpers must never be reachable from the Data API.
REVOKE ALL ON FUNCTION private.are_friends(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.has_friend_link(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.has_follow_link(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_follower(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_blocked(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_restricted(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.dm_allowed(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.has_dm_with(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.has_group_invite(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_admin(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.shares_group_with(uuid, uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION private.bump_rate_limit(uuid, text, integer, interval) FROM anon, PUBLIC;

-- Re-grant only what signed-in users genuinely need (each function enforces auth.uid() internally).
GRANT EXECUTE ON FUNCTION public.get_profile_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_read_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_usernames(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;