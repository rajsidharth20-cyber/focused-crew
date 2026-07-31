CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.is_group_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_group_admin(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.has_group_invite(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.shares_group_with(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.gen_join_code() SET SCHEMA private;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_group_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_group_invite(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_group_with(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.gen_join_code() TO authenticated, service_role;