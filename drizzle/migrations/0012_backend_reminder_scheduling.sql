ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
COMMENT ON COLUMN public.profiles.timezone IS 'IANA timezone (e.g. Asia/Kolkata) synced from the user''s device; used by backend reminders.';

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS notification_log_status_check;
ALTER TABLE public.notification_log ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('processing','sent','failed','skipped'));
CREATE INDEX IF NOT EXISTS notification_log_retry_idx ON public.notification_log (status, updated_at) WHERE status IN ('processing','failed');

CREATE OR REPLACE FUNCTION public.claim_reminders(_items jsonb)
RETURNS TABLE(dedupe_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH items AS (
    SELECT * FROM jsonb_to_recordset(_items) AS x(user_id uuid, category text, title text, body text, url text, dedupe_key text)
  ), ins AS (
    INSERT INTO public.notification_log (user_id, category, title, body, url, dedupe_key, status, attempts, updated_at)
    SELECT i.user_id, i.category, left(i.title,120), left(i.body,240), i.url, i.dedupe_key, 'processing', 1, now() FROM items i
    ON CONFLICT ON CONSTRAINT notification_log_dedupe_key_key DO NOTHING
    RETURNING notification_log.dedupe_key
  ), retry AS (
    UPDATE public.notification_log l SET status = 'processing', attempts = l.attempts + 1, updated_at = now()
    FROM items i
    WHERE l.dedupe_key = i.dedupe_key AND l.attempts < 3
      AND ((l.status = 'failed' AND l.updated_at < now() - interval '4 minutes')
        OR (l.status = 'processing' AND l.updated_at < now() - interval '10 minutes'))
    RETURNING l.dedupe_key
  )
  SELECT ins.dedupe_key FROM ins UNION SELECT retry.dedupe_key FROM retry;
END $$;

CREATE OR REPLACE FUNCTION public.finish_reminders(_results jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.notification_log l
  SET status = r.status, last_error = left(r.error, 300), updated_at = now(),
      sent_at = CASE WHEN r.status = 'sent' THEN now() ELSE l.sent_at END
  FROM jsonb_to_recordset(_results) AS r(dedupe_key text, status text, error text)
  WHERE l.dedupe_key = r.dedupe_key AND l.status = 'processing' AND r.status IN ('sent','failed','skipped');
$$;

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.scheduler_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.scheduler_secrets FROM PUBLIC, anon, authenticated;
INSERT INTO private.scheduler_secrets (name, secret)
VALUES ('process_reminders', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_reminder_cron_secret(_secret text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
  SELECT coalesce(length(_secret) >= 32 AND EXISTS (
    SELECT 1 FROM private.scheduler_secrets WHERE name = 'process_reminders' AND secret = _secret), false);
$$;

REVOKE ALL ON FUNCTION public.claim_reminders(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_reminders(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_reminder_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminders(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_reminders(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_reminder_cron_secret(text) TO service_role;

CREATE INDEX IF NOT EXISTS events_recurring_user_idx ON public.events (user_id) WHERE recurring_days IS NOT NULL;
CREATE INDEX IF NOT EXISTS commitments_recurring_user_idx ON public.commitments (user_id) WHERE recurring_days IS NOT NULL;