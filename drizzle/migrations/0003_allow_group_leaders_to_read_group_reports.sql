CREATE POLICY "Group leaders read reports about their group messages"
ON public.reports FOR SELECT TO authenticated
USING (
  target_type = 'group_message'
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = reports.target_id
      AND private.is_group_admin(gm.group_id, auth.uid())
  )
);