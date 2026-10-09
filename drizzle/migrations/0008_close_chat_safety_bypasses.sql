CREATE OR REPLACE FUNCTION private.guard_focusbot_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.bot_type IS NOT NULL OR NEW.bot_role IS NOT NULL) THEN RAISE EXCEPTION 'Bot messages are server-only'; END IF;
  IF private.is_restricted(NEW.sender_id) AND NOT (auth.uid() IS NULL AND NEW.bot_type='focusbot' AND NEW.bot_role='assistant') THEN RAISE EXCEPTION 'Your messaging access is temporarily restricted by an app admin'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_direct_message_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (to_jsonb(NEW)-'read_at') IS DISTINCT FROM (to_jsonb(OLD)-'read_at') THEN RAISE EXCEPTION 'Only message read status can be changed'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_direct_message_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_direct_message_update BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_direct_message_update();
CREATE OR REPLACE FUNCTION public.guard_group_pin_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.pinned IS DISTINCT FROM OLD.pinned THEN PERFORM public.assert_chat_access(OLD.group_id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_group_pin_access() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_group_pin_access BEFORE UPDATE ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.guard_group_pin_access();
-- Group sends now use the authenticated FocusBot service, preventing raw inserts from skipping moderation.
REVOKE INSERT ON public.group_messages FROM authenticated,anon;
GRANT INSERT ON public.group_messages TO service_role;