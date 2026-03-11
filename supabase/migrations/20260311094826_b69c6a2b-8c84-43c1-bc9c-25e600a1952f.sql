
-- Add deadline column to daily_objectives
ALTER TABLE public.daily_objectives ADD COLUMN deadline date;

-- Add deadline column to weekly_targets
ALTER TABLE public.weekly_targets ADD COLUMN deadline date;
