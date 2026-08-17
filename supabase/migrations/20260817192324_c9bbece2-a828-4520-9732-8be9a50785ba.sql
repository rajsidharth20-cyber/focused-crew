CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  short_description text,
  type text NOT NULL DEFAULT 'update',
  is_important boolean NOT NULL DEFAULT false,
  image_url text,
  action_text text,
  action_url text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_type_check CHECK (type IN ('update','feature','maintenance','important','event'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read live announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  private.is_staff(auth.uid())
  OR (
    is_published = true
    AND coalesce(scheduled_for, published_at, created_at) <= now()
  )
);

CREATE POLICY "Staff can create announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff can update announcements"
ON public.announcements FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff can delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (private.is_staff(auth.uid()));

CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_announcements_published ON public.announcements (is_published, published_at DESC);
CREATE INDEX idx_announcements_scheduled ON public.announcements (scheduled_for);
CREATE INDEX idx_announcements_created_at ON public.announcements (created_at DESC);

CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own read receipts"
ON public.announcement_reads FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own read receipts"
ON public.announcement_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_announcement_reads_user ON public.announcement_reads (user_id);
CREATE INDEX idx_announcement_reads_announcement ON public.announcement_reads (announcement_id);

CREATE OR REPLACE FUNCTION public.announcement_read_counts()
RETURNS TABLE(announcement_id uuid, read_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.announcement_id, count(*)::bigint
  FROM public.announcement_reads r
  WHERE private.is_staff(auth.uid())
  GROUP BY r.announcement_id
$$;

REVOKE ALL ON FUNCTION public.announcement_read_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.announcement_read_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.announcement_read_counts() TO authenticated;