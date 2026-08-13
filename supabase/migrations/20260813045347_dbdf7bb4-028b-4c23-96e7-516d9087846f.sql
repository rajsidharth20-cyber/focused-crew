ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.active_timers (
  user_id uuid PRIMARY KEY,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  started_at timestamptz,
  accumulated_seconds integer NOT NULL DEFAULT 0,
  is_running boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_timers TO authenticated;
GRANT ALL ON public.active_timers TO service_role;

ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own active timer"
ON public.active_timers FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_active_timers_updated_at
BEFORE UPDATE ON public.active_timers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.active_timers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_timers;