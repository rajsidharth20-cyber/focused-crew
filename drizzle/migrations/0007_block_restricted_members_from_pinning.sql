CREATE OR REPLACE FUNCTION public.set_group_message_pinned(_message_id uuid, _pinned boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private'
AS $function$
DECLARE _group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT group_id INTO _group_id FROM public.group_messages WHERE id = _message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'message not found'; END IF;
  PERFORM public.assert_chat_access(_group_id);
  UPDATE public.group_messages SET pinned = _pinned WHERE id = _message_id AND moderation_status <> 'violation';
END;
$function$;