CREATE OR REPLACE FUNCTION public.suggest_usernames(_base text DEFAULT NULL)
RETURNS TABLE (username text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adjectives text[] := ARRAY['swift','calm','bright','sharp','steady','bold','clever','quiet','rapid','keen'];
  nouns text[] := ARRAY['pilot','falcon','comet','ranger','skipper','nova','jet','condor','vector','beacon'];
  base text := lower(regexp_replace(coalesce(_base, ''), '[^a-zA-Z0-9]', '', 'g'));
  candidate text;
  i int := 0;
  found int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  WHILE i < 200 AND found < 5 LOOP
    i := i + 1;
    IF base <> '' AND i <= 20 THEN
      candidate := base || (floor(random() * 9000 + 100))::int::text;
    ELSE
      candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
                || nouns[1 + floor(random() * array_length(nouns, 1))::int]
                || (floor(random() * 900 + 10))::int::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = candidate) THEN
      username := candidate;
      found := found + 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.suggest_usernames(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.suggest_usernames(text) TO authenticated;