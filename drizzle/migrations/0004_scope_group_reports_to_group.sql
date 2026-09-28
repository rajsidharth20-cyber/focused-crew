ALTER TABLE public.reports ADD COLUMN group_id uuid REFERENCES public.study_groups(id) ON DELETE SET NULL;
CREATE INDEX reports_group_created_idx ON public.reports (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE POLICY "Group leaders read scoped group reports"
ON public.reports FOR SELECT TO authenticated
USING (target_type = 'group_message' AND group_id IS NOT NULL AND private.is_group_admin(group_id, auth.uid()));