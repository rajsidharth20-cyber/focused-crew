REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO authenticated, service_role;

GRANT SELECT ON public.rate_limits TO authenticated;
CREATE POLICY "Users see own rate limit counters" ON public.rate_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());