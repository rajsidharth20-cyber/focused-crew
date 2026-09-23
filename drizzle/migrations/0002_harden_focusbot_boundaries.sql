CREATE OR REPLACE FUNCTION private.guard_group_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.group_id IS DISTINCT FROM OLD.group_id OR
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.image_url IS DISTINCT FROM OLD.image_url OR
    NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.author_type IS DISTINCT FROM OLD.author_type OR
    NEW.bot_event_id IS DISTINCT FROM OLD.bot_event_id OR
    NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
  ) THEN
    RAISE EXCEPTION 'Only message pin status can be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_group_message_update
BEFORE UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION private.guard_group_message_update();

REVOKE ALL ON FUNCTION private.guard_group_message_update() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Members change own poll votes" ON public.bot_poll_votes;
CREATE POLICY "Members change own open poll votes"
ON public.bot_poll_votes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bot_polls p
    JOIN public.bot_poll_options o ON o.poll_id = p.id
    WHERE p.id = poll_id
      AND o.id = option_id
      AND p.status = 'open'
      AND private.is_group_member(p.group_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members remove own poll votes" ON public.bot_poll_votes;
CREATE POLICY "Members remove own open poll votes"
ON public.bot_poll_votes
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bot_polls p
    WHERE p.id = poll_id
      AND p.status = 'open'
      AND private.is_group_member(p.group_id, auth.uid())
  )
);

CREATE UNIQUE INDEX bot_focus_one_active_per_group
ON public.bot_focus_sessions(group_id)
WHERE active;

ALTER TABLE public.bot_instances
  ADD CONSTRAINT bot_instances_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_events
  ADD CONSTRAINT bot_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.bot_flags
  ADD CONSTRAINT bot_flags_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_flags
  ADD CONSTRAINT bot_flags_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.bot_focus_sessions
  ADD CONSTRAINT bot_focus_sessions_started_by_fkey
  FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_polls
  ADD CONSTRAINT bot_polls_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_poll_votes
  ADD CONSTRAINT bot_poll_votes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_direct_state
  ADD CONSTRAINT bot_direct_state_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.group_member_restrictions
  ADD CONSTRAINT group_member_restrictions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.group_member_restrictions
  ADD CONSTRAINT group_member_restrictions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;