CREATE OR REPLACE FUNCTION public.study_day_totals(_before timestamptz, _timezone text)
RETURNS TABLE(day text, seconds double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT to_char(started_at AT TIME ZONE _timezone, 'YYYY-MM-DD') AS day,
         sum(duration_seconds)::double precision AS seconds
  FROM public.study_sessions
  WHERE user_id = auth.uid() AND started_at < _before
  GROUP BY to_char(started_at AT TIME ZONE _timezone, 'YYYY-MM-DD')
  ORDER BY day DESC;
$$;
REVOKE ALL ON FUNCTION public.study_day_totals(timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_day_totals(timestamptz, text) TO authenticated;
CREATE INDEX IF NOT EXISTS study_sessions_user_started_idx ON public.study_sessions (user_id, started_at DESC);