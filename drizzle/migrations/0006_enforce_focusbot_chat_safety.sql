CREATE INDEX IF NOT EXISTS reports_group_target_reporters_idx ON public.reports(group_id, target_user_id, created_at, reporter_id) WHERE target_type='group_message';

CREATE OR REPLACE FUNCTION private.guard_focusbot_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF NEW.author_type='focusbot' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'FocusBot messages are server-only'; END IF;
  IF NEW.author_type='human' THEN
    IF private.is_restricted(NEW.user_id) THEN RAISE EXCEPTION 'Your messaging access is temporarily restricted by an app admin'; END IF;
    IF EXISTS (SELECT 1 FROM public.group_member_restrictions r WHERE r.group_id=NEW.group_id AND r.user_id=NEW.user_id AND r.restricted_until>now()) THEN RAISE EXCEPTION 'You are temporarily muted in this group'; END IF;
    IF coalesce(NEW.content,'') ~* '^\s*(@focusbot\s+report|/report)\M' THEN RAISE EXCEPTION 'Send reports privately using FocusBot report, not as a group message'; END IF;
    IF auth.uid() IS NOT NULL AND (NEW.moderation_status<>'none' OR NEW.bot_event_id IS NOT NULL) THEN RAISE EXCEPTION 'Message moderation is server-only'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.guard_focusbot_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF NEW.bot_type='focusbot' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'FocusBot conversations are server-only'; END IF;
  IF private.is_restricted(NEW.sender_id) AND coalesce(NEW.bot_role,'user')<>'assistant' THEN RAISE EXCEPTION 'Your messaging access is temporarily restricted by an app admin'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.validate_group_safety_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE target public.group_messages%ROWTYPE;
BEGIN
  IF NEW.target_type<>'group_message' THEN RETURN NEW; END IF;
  SELECT * INTO target FROM public.group_messages WHERE id=NEW.target_id;
  IF NOT FOUND OR target.author_type<>'human' OR target.user_id=NEW.reporter_id OR NOT private.is_group_member(target.group_id,NEW.reporter_id) THEN RAISE EXCEPTION 'You can only report another member''s group message'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid()<>NEW.reporter_id THEN RAISE EXCEPTION 'Invalid reporter'; END IF;
  IF NEW.group_id IS NOT NULL AND NEW.group_id<>target.group_id THEN RAISE EXCEPTION 'Invalid report group'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target.group_id::text || ':' || target.user_id::text,0));
  NEW.group_id:=target.group_id;
  NEW.target_user_id:=target.user_id;
  NEW.status:='open'; NEW.handled_by:=NULL; NEW.created_at:=now();
  NEW.details:='Reason: ' || left(coalesce(NEW.details,NEW.reason,'Reported via FocusBot'),500) || E'\nReported message: ' || left(coalesce(target.content,'[Removed message]'),2000) || CASE WHEN target.image_url IS NOT NULL THEN E'\nIncludes an image.' ELSE '' END;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_group_safety_report BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.validate_group_safety_report();

CREATE OR REPLACE FUNCTION private.act_on_group_safety_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE reporters integer; until_at timestamptz; duration integer; leader uuid;
BEGIN
  IF NEW.target_type<>'group_message' THEN RETURN NEW; END IF;
  INSERT INTO public.notification_log(user_id,category,title,body,url,dedupe_key)
  SELECT recipient,'group_messages','Group message reported','A group message needs private review.',CASE WHEN private.is_group_admin(NEW.group_id,recipient) THEN '/groups/'||NEW.group_id||'/bots/focusbot' ELSE '/admin/reports' END,'focusbot-report:'||NEW.id||':'||recipient
  FROM (SELECT user_id AS recipient FROM public.group_members WHERE group_id=NEW.group_id AND role IN ('owner','admin') UNION SELECT user_id FROM public.user_roles WHERE role='admin') recipients;
  SELECT count(DISTINCT r.reporter_id) INTO reporters FROM public.reports r WHERE r.group_id=NEW.group_id AND r.target_user_id=NEW.target_user_id AND r.target_type='group_message' AND r.status='open' AND private.is_group_member(NEW.group_id,r.reporter_id) AND r.created_at>coalesce((SELECT max(created_at) FROM public.group_member_restrictions WHERE group_id=NEW.group_id AND user_id=NEW.target_user_id),'-infinity'::timestamptz);
  IF reporters>3 AND NOT EXISTS (SELECT 1 FROM public.group_member_restrictions WHERE group_id=NEW.group_id AND user_id=NEW.target_user_id AND restricted_until>now()) THEN
    SELECT owner_id INTO leader FROM public.study_groups WHERE id=NEW.group_id;
    SELECT s.mute_minutes INTO duration FROM public.bot_settings s JOIN public.bot_instances b ON b.id=s.bot_instance_id WHERE b.group_id=NEW.group_id AND b.bot_type='focusbot';
    until_at:=now()+make_interval(mins=>coalesce(duration,10));
    INSERT INTO public.group_member_restrictions(group_id,user_id,reason,restricted_until,created_by) VALUES(NEW.group_id,NEW.target_user_id,'Automatic temporary chat ban: reports from four distinct group members',until_at,leader);
    INSERT INTO public.notification_log(user_id,category,title,body,url,dedupe_key)
    SELECT recipient,'group_messages','Temporary group chat restriction','Messaging is paused until '||until_at::text||'. Group leaders can review this restriction.','/groups/'||NEW.group_id||'/chat','focusbot-restriction:'||NEW.id||':'||recipient FROM (SELECT NEW.target_user_id AS recipient UNION SELECT user_id FROM public.group_members WHERE group_id=NEW.group_id AND role IN ('owner','admin') UNION SELECT user_id FROM public.user_roles WHERE role='admin') recipients;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER act_on_group_safety_report AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.act_on_group_safety_report();
REVOKE ALL ON FUNCTION private.validate_group_safety_report(),private.act_on_group_safety_report() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.submit_focusbot_report(_group_id uuid,_message_id uuid,_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE report_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to report a message'; END IF;
  IF NOT private.is_group_member(_group_id,auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.group_messages WHERE id=_message_id AND group_id=_group_id) THEN RAISE EXCEPTION 'Message not found in your group'; END IF;
  INSERT INTO public.reports(reporter_id,target_type,target_id,group_id,reason,details) VALUES(auth.uid(),'group_message',_message_id,_group_id,'Group chat report',left(coalesce(_reason,''),500)) ON CONFLICT DO NOTHING RETURNING id INTO report_id;
  RETURN jsonb_build_object('ok',true,'reported',true,'duplicate',report_id IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.submit_focusbot_report(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_focusbot_report(uuid,uuid,text) TO authenticated;

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
  UPDATE public.group_messages SET moderation_status=CASE WHEN removed THEN 'violation' ELSE 'flagged' END,content=CASE WHEN removed THEN NULL ELSE content END,image_url=CASE WHEN removed THEN NULL ELSE image_url END,pinned=CASE WHEN removed THEN false ELSE pinned END WHERE id=msg.id;
  IF _classification='HIGH_CONFIDENCE_VIOLATION' AND _confidence>=0.9 AND settings.auto_mute_enabled THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(msg.group_id::text||':'||msg.user_id::text,0));
    IF NOT EXISTS(SELECT 1 FROM public.group_member_restrictions WHERE group_id=msg.group_id AND user_id=msg.user_id AND restricted_until>now()) THEN
      SELECT owner_id INTO owner FROM public.study_groups WHERE id=msg.group_id;
      INSERT INTO public.group_member_restrictions(group_id,user_id,reason,restricted_until,created_by) VALUES(msg.group_id,msg.user_id,left(_reason,300),now()+make_interval(mins=>settings.mute_minutes),owner);
      muted:=true;
    END IF;
  END IF;
  INSERT INTO public.notification_log(user_id,category,title,body,url,dedupe_key)
  SELECT recipient,'group_messages','FocusBot moderation action',CASE WHEN removed THEN 'An abusive group message was removed.' ELSE 'A group message needs review.' END, '/groups/'||msg.group_id||'/bots/focusbot','focusbot-moderation:'||msg.id||':'||recipient FROM (SELECT msg.user_id AS recipient UNION SELECT user_id FROM public.group_members WHERE group_id=msg.group_id AND role IN ('owner','admin')) recipients ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('removed',removed,'muted',muted);
END $$;
REVOKE ALL ON FUNCTION public.apply_focusbot_moderation(uuid,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_focusbot_moderation(uuid,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_chat_access(_group_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to send messages'; END IF;
  IF private.is_restricted(auth.uid()) THEN RAISE EXCEPTION 'Your messaging access is temporarily restricted by an app admin'; END IF;
  IF _group_id IS NOT NULL THEN
    IF NOT private.is_group_member(_group_id,auth.uid()) THEN RAISE EXCEPTION 'You are not a member of this group'; END IF;
    IF EXISTS(SELECT 1 FROM public.group_member_restrictions WHERE group_id=_group_id AND user_id=auth.uid() AND restricted_until>now()) THEN RAISE EXCEPTION 'You are temporarily muted in this group'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_chat_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assert_chat_access(uuid) TO authenticated;
