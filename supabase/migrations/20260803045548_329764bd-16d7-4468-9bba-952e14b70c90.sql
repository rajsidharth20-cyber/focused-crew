ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS schedule_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_reminders boolean NOT NULL DEFAULT true;

ALTER TABLE public.daily_objectives
  ADD COLUMN IF NOT EXISTS recurring_days integer[],
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.daily_objectives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS daily_objectives_template_idx ON public.daily_objectives(user_id, template_id, date);