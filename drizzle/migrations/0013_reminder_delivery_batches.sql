ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS claim_id uuid, ADD COLUMN IF NOT EXISTS delivered_device_ids uuid[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.claim_reminder_batch(_items jsonb, _claim_id uuid)
RETURNS TABLE(dedupe_key text, delivered_device_ids uuid[]) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 RETURN QUERY WITH items AS (SELECT * FROM jsonb_to_recordset(_items) AS x(user_id uuid,category text,title text,body text,url text,dedupe_key text)), ins AS (
 INSERT INTO public.notification_log(user_id,category,title,body,url,dedupe_key,status,attempts,updated_at,claim_id)
 SELECT i.user_id,i.category,left(i.title,120),left(i.body,240),i.url,i.dedupe_key,'processing',1,now(),_claim_id FROM items i
 ON CONFLICT ON CONSTRAINT notification_log_dedupe_key_key DO NOTHING RETURNING notification_log.dedupe_key,notification_log.delivered_device_ids
 ), retry AS (
 UPDATE public.notification_log l SET status='processing', attempts=l.attempts+1,updated_at=now(),claim_id=_claim_id FROM items i
 WHERE l.dedupe_key=i.dedupe_key AND l.attempts<3 AND ((l.status='failed' AND l.updated_at<now()-interval '4 minutes') OR (l.status='processing' AND l.updated_at<now()-interval '10 minutes')) RETURNING l.dedupe_key,l.delivered_device_ids
 ) SELECT * FROM ins UNION ALL SELECT * FROM retry;
END $$;
CREATE OR REPLACE FUNCTION public.record_reminder_device(_key text,_claim_id uuid,_device_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.notification_log SET delivered_device_ids=array_append(delivered_device_ids,_device_id) WHERE dedupe_key=_key AND claim_id=_claim_id AND status='processing' AND NOT (_device_id=ANY(delivered_device_ids));
$$;
CREATE OR REPLACE FUNCTION public.finish_reminder_batch(_results jsonb,_claim_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.notification_log l SET status=r.status,last_error=left(r.error,300),updated_at=now(),sent_at=CASE WHEN r.status='sent' THEN now() ELSE l.sent_at END
 FROM jsonb_to_recordset(_results) AS r(dedupe_key text,status text,error text)
 WHERE l.dedupe_key=r.dedupe_key AND l.claim_id=_claim_id AND l.status='processing' AND r.status IN ('sent','failed','skipped');
$$;
CREATE TABLE private.reminder_scheduler_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), cursor_id uuid, locked_until timestamptz, owner_id uuid);
REVOKE ALL ON private.reminder_scheduler_state FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.begin_reminder_run(_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE c uuid;
BEGIN
 INSERT INTO private.reminder_scheduler_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE private.reminder_scheduler_state SET locked_until=now()+interval '3 minutes',owner_id=_owner WHERE singleton AND (locked_until IS NULL OR locked_until<now()) RETURNING cursor_id INTO c;
 IF NOT FOUND THEN RETURN jsonb_build_object('acquired',false); END IF;
 RETURN jsonb_build_object('acquired',true,'cursor',c);
END $$;
CREATE OR REPLACE FUNCTION public.end_reminder_run(_owner uuid,_cursor uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,private AS $$
 UPDATE private.reminder_scheduler_state SET cursor_id=_cursor,locked_until=NULL,owner_id=NULL WHERE singleton AND owner_id=_owner;
$$;
CREATE OR REPLACE FUNCTION public.reminder_user_batch(_after uuid DEFAULT NULL,_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH users AS (
 SELECT p.id,p.timezone,p.day_start_hour FROM public.profiles p WHERE (_after IS NULL OR p.id>_after) AND EXISTS(SELECT 1 FROM public.push_tokens t WHERE t.user_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.notification_preferences n WHERE n.user_id=p.id AND n.push_enabled=false) ORDER BY p.id LIMIT least(greatest(_limit,1),100)
 ), days AS (
 SELECT u.*, CASE WHEN u.timezone IN (SELECT name FROM pg_timezone_names) THEN u.timezone ELSE 'Asia/Kolkata' END AS tz FROM users u
 ), bounds AS (
 SELECT d.*, ((now() AT TIME ZONE tz)-make_interval(hours=>coalesce(day_start_hour,3)))::date AS day FROM days d
 ), b AS (
 SELECT bounds.*, (day+make_time(coalesce(day_start_hour,3),0,0)) AT TIME ZONE tz AS day_start, ((day+1)+make_time(coalesce(day_start_hour,3),0,0)) AT TIME ZONE tz AS day_end FROM bounds
 ) SELECT coalesce(jsonb_agg(jsonb_build_object(
 'user',jsonb_build_object('id',b.id,'timezone',b.tz,'day_start_hour',coalesce(b.day_start_hour,3)),
 'prefs',(SELECT to_jsonb(n) FROM public.notification_preferences n WHERE n.user_id=b.id),
 'tokens',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'token',t.token)) FROM public.push_tokens t WHERE t.user_id=b.id),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'start_time',e.start_time,'date',e.event_date,'recurring_days',e.recurring_days)) FROM public.events e WHERE e.user_id=b.id AND (e.event_date BETWEEN b.day-1 AND b.day+2 OR cardinality(e.recurring_days)>0)),'[]'::jsonb),
 'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'start_time',c.start_time,'date',c.date,'recurring_days',c.recurring_days)) FROM public.commitments c WHERE c.user_id=b.id AND (c.date BETWEEN b.day-1 AND b.day+2 OR cardinality(c.recurring_days)>0)),'[]'::jsonb),
 'objectives',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'date',o.date,'completed',o.completed,'skipped',o.skipped,'is_template',o.is_template,'template_id',o.template_id,'recurring_days',o.recurring_days)) FROM public.daily_objectives o WHERE o.user_id=b.id AND (o.date=b.day OR o.is_template)),'[]'::jsonb),
 'studied_seconds',coalesce((SELECT sum(CASE WHEN s.ended_at>s.started_at THEN greatest(0,extract(epoch FROM least(s.ended_at,b.day_end,now())-greatest(s.started_at,b.day_start)))*least(1,s.duration_seconds::numeric/nullif(extract(epoch FROM s.ended_at-s.started_at),0)) ELSE s.duration_seconds END) FROM public.study_sessions s WHERE s.user_id=b.id AND s.started_at<b.day_end AND coalesce(s.ended_at,s.started_at)>=b.day_start),0),
 'active',EXISTS(SELECT 1 FROM public.active_timers a WHERE a.user_id=b.id AND a.is_running)
 ) ORDER BY b.id),'[]'::jsonb) FROM b;
$$;
REVOKE ALL ON FUNCTION public.claim_reminder_batch(jsonb,uuid),public.record_reminder_device(text,uuid,uuid),public.finish_reminder_batch(jsonb,uuid),public.begin_reminder_run(uuid),public.end_reminder_run(uuid,uuid),public.reminder_user_batch(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder_batch(jsonb,uuid),public.record_reminder_device(text,uuid,uuid),public.finish_reminder_batch(jsonb,uuid),public.begin_reminder_run(uuid),public.end_reminder_run(uuid,uuid),public.reminder_user_batch(uuid,integer) TO service_role;
CREATE INDEX IF NOT EXISTS study_sessions_user_ended_idx ON public.study_sessions(user_id,ended_at);
CREATE INDEX IF NOT EXISTS objectives_recurring_reminder_idx ON public.daily_objectives(user_id) WHERE is_template;