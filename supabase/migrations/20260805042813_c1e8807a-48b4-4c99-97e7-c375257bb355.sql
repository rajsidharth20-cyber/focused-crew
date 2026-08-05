CREATE TABLE public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_key_enc text NOT NULL,
  google_email text,
  calendar_id text NOT NULL DEFAULT 'primary',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT (user_id, google_email, calendar_id, last_synced_at, created_at, updated_at), DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own google connection"
ON public.google_calendar_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google connection"
ON public.google_calendar_connections FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_google_calendar_connections_updated_at
BEFORE UPDATE ON public.google_calendar_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.google_calendar_sync_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  google_event_id text NOT NULL,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

GRANT SELECT, DELETE ON public.google_calendar_sync_map TO authenticated;
GRANT ALL ON public.google_calendar_sync_map TO service_role;
ALTER TABLE public.google_calendar_sync_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync map"
ON public.google_calendar_sync_map FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync map"
ON public.google_calendar_sync_map FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_google_calendar_sync_map_updated_at
BEFORE UPDATE ON public.google_calendar_sync_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();