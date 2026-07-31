-- 1. Fix mutable search_path
CREATE OR REPLACE FUNCTION public.gen_join_code()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $function$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$function$;

-- 2. Revoke EXECUTE on SECURITY DEFINER / internal functions from API roles
REVOKE EXECUTE ON FUNCTION public.gen_join_code() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.add_group_owner_member() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_group_invite(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) FROM anon, authenticated, public;

-- 3. Scope policies to the authenticated role
DROP POLICY IF EXISTS "Users manage own daily notes" ON public.daily_notes;
CREATE POLICY "Users manage own daily notes"
ON public.daily_notes FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own study_sessions" ON public.study_sessions;
CREATE POLICY "Users manage own study_sessions"
ON public.study_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own study_tags" ON public.study_tags;
CREATE POLICY "Users manage own study_tags"
ON public.study_tags FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Remove redundant duplicate SELECT policy on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;