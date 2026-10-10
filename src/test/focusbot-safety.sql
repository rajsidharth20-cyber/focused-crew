-- Run with psql against the connected database. All fixtures are rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE users uuid[]; g uuid:=gen_random_uuid(); m uuid; b uuid; i integer; denied boolean;
BEGIN
  SELECT array_agg(id) INTO users FROM (SELECT id FROM public.profiles ORDER BY created_at LIMIT 5) p;
  IF cardinality(users)<5 THEN RAISE EXCEPTION 'Five profiles are required'; END IF;
  INSERT INTO public.study_groups(id,name,owner_id) VALUES(g,'Isolated FocusBot safety test',users[1]);
  FOR i IN 2..5 LOOP INSERT INTO public.group_members(group_id,user_id,role) VALUES(g,users[i],'member'); END LOOP;
  INSERT INTO public.bot_instances(group_id,created_by,enabled) VALUES(g,users[1],true) RETURNING id INTO b;
  INSERT INTO public.bot_settings(bot_instance_id,auto_delete_enabled,auto_mute_enabled,mute_minutes) VALUES(b,true,true,10);
  INSERT INTO public.group_messages(group_id,user_id,content) VALUES(g,users[5],'Report test fixture') RETURNING id INTO m;
  FOR i IN 1..3 LOOP
    PERFORM set_config('request.jwt.claim.sub',users[i]::text,true);
    INSERT INTO public.reports(reporter_id,target_type,target_id,group_id,reason) VALUES(users[i],'group_message',m,g,'Safety test') ON CONFLICT DO NOTHING;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.group_member_restrictions WHERE group_id=g) THEN RAISE EXCEPTION 'Three reporters must not ban'; END IF;
  INSERT INTO public.reports(reporter_id,target_type,target_id,group_id,reason) VALUES(users[3],'group_message',m,g,'Duplicate') ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.reports WHERE group_id=g)<>3 THEN RAISE EXCEPTION 'Duplicate report counted'; END IF;
  PERFORM set_config('request.jwt.claim.sub',users[4]::text,true);
  INSERT INTO public.reports(reporter_id,target_type,target_id,group_id,reason) VALUES(users[4],'group_message',m,g,'Fourth reporter');
  IF (SELECT count(*) FROM public.group_member_restrictions WHERE group_id=g AND user_id=users[5])<>1 THEN RAISE EXCEPTION 'Fourth reporter must ban exactly once'; END IF;
  IF (SELECT count(*) FROM public.group_messages WHERE group_id=g)<>1 THEN RAISE EXCEPTION 'Report leaked into chat'; END IF;
  IF EXISTS(SELECT 1 FROM public.notification_log WHERE dedupe_key LIKE 'focusbot-report:%' AND url LIKE '%'||g||'%' AND user_id IN(users[2],users[3],users[4],users[5]) AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role='admin')) THEN RAISE EXCEPTION 'Report notified ordinary members'; END IF;
  PERFORM set_config('request.jwt.claim.sub',users[5]::text,true);
  denied:=false;
  BEGIN INSERT INTO public.group_messages(group_id,user_id,content) VALUES(g,users[5],'muted send'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Muted member retained chat access'; END IF;
  PERFORM set_config('request.jwt.claim.sub',users[2]::text,true);
  denied:=false;
  BEGIN UPDATE public.group_messages SET content='edited' WHERE id=m; EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Message edit bypass remains'; END IF;
  INSERT INTO public.user_restrictions(user_id,reason,restricted_until,created_by) VALUES(users[2],'Test admin restriction',now()+interval '10 minutes',users[1]);
  denied:=false;
  BEGIN INSERT INTO public.messages(sender_id,receiver_id,message,bot_role) VALUES(users[2],users[3],'spoof','assistant'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Assistant spoof bypass remains'; END IF;
  denied:=false;
  BEGIN INSERT INTO public.group_messages(group_id,user_id,content) VALUES(g,users[2],'restricted send'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Admin ban bypass remains'; END IF;
  RAISE NOTICE 'PASS: fourth reporter, duplicates, privacy, bans, edits, assistant spoof';
END $$;
ROLLBACK;