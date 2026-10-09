CREATE OR REPLACE FUNCTION public.apply_focusbot_moderation(_message_id uuid,_classification text,_reason text,_confidence numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE msg public.group_messages%ROWTYPE; bot public.bot_instances%ROWTYPE; settings public.bot_settings%ROWTYPE; removed boolean:=false; muted boolean:=false; owner uuid;
BEGIN
  SELECT * INTO msg FROM public.group_messages WHERE id=_message_id FOR UPDATE;
  IF NOT FOUND OR msg.author_type<>'human' OR msg.moderation_status='violation' THEN RETURN jsonb_build_object('removed',false); END IF;
  SELECT * INTO bot FROM public.bot_instances WHERE group_id=msg.group_id AND bot_type='focusbot' AND enabled;
  IF NOT FOUND THEN RETURN jsonb_build_object('removed',false); END IF;
  SELECT * INTO settings FROM public.bot_settings WHERE bot_instance_id=bot.id;
  IF _classification NOT IN ('POTENTIALLY_PROBLEMATIC','HIGH_CONFIDENCE_VIOLATION') THEN RAISE EXCEPTION 'Invalid classification'; END IF;
  removed:=_classification='HIGH_CONFIDENCE_VIOLATION' AND _confidence>=0.9 AND settings.auto_delete_enabled;
  INSERT INTO public.bot_flags(bot_instance_id,group_id,message_id,target_user_id,classification,reason,confidence,status) VALUES(bot.id,msg.group_id,msg.id,msg.user_id,_classification,left(_reason,300),_confidence,CASE WHEN removed THEN 'deleted' ELSE 'pending' END) ON CONFLICT(message_id) DO NOTHING;
  UPDATE public.group_messages SET moderation_status=CASE WHEN removed THEN 'violation' ELSE 'flagged' END,content=CASE WHEN removed THEN '' ELSE content END,image_url=CASE WHEN removed THEN NULL ELSE image_url END,pinned=CASE WHEN removed THEN false ELSE pinned END WHERE id=msg.id;
  IF _classification='HIGH_CONFIDENCE_VIOLATION' AND _confidence>=0.9 AND settings.auto_mute_enabled THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(msg.group_id::text||':'||msg.user_id::text,0));
    IF NOT EXISTS(SELECT 1 FROM public.group_member_restrictions WHERE group_id=msg.group_id AND user_id=msg.user_id AND restricted_until>now()) THEN
      SELECT owner_id INTO owner FROM public.study_groups WHERE id=msg.group_id;
      INSERT INTO public.group_member_restrictions(group_id,user_id,reason,restricted_until,created_by) VALUES(msg.group_id,msg.user_id,left(_reason,300),now()+make_interval(mins=>settings.mute_minutes),owner);
      muted:=true;
    END IF;
  END IF;
  INSERT INTO public.notification_log(user_id,category,title,body,url,dedupe_key)
  SELECT recipient,'group_messages','FocusBot moderation action',CASE WHEN removed THEN 'An abusive group message was removed.' ELSE 'A group message needs review.' END,'/groups/'||msg.group_id||'/bots/focusbot','focusbot-moderation:'||msg.id||':'||recipient FROM (SELECT msg.user_id AS recipient UNION SELECT user_id FROM public.group_members WHERE group_id=msg.group_id AND role IN ('owner','admin')) recipients ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('removed',removed,'muted',muted);
END $$;
REVOKE ALL ON FUNCTION public.apply_focusbot_moderation(uuid,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_focusbot_moderation(uuid,text,text,numeric) TO service_role;