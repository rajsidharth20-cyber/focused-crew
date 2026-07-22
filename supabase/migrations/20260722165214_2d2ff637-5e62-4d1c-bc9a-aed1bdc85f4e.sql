ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS recurring_days integer[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurring_days integer[];
ALTER TABLE public.events ALTER COLUMN event_date DROP NOT NULL;