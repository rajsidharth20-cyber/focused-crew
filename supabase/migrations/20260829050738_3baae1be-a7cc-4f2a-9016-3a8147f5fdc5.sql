DROP POLICY IF EXISTS "Members pin messages" ON public.group_messages;

CREATE OR REPLACE FUNCTION public.set_group_message_pinned(_message_id uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT group_id INTO _group_id FROM public.group_messages WHERE id = _message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  IF NOT private.is_group_member(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a group member';
  END IF;

  UPDATE public.group_messages SET pinned = _pinned WHERE id = _message_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_group_message_pinned(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_message_pinned(uuid, boolean) TO authenticated;