CREATE TABLE public.audio_call_signals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 call_id uuid NOT NULL,
 sender_id uuid NOT NULL,
 receiver_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('offer','answer','ice','ringing','ended','rejected','busy')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(payload::text) <= 32768),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 seconds'),
 CHECK (sender_id <> receiver_id)
);
GRANT SELECT, DELETE ON public.audio_call_signals TO authenticated;
GRANT ALL ON public.audio_call_signals TO service_role;
ALTER TABLE public.audio_call_signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX audio_call_signals_receiver_idx ON public.audio_call_signals(receiver_id, created_at);
CREATE INDEX audio_call_signals_expiry_idx ON public.audio_call_signals(expires_at);
CREATE FUNCTION public.can_audio_call(_peer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND auth.uid() <> _peer AND EXISTS (
 SELECT 1 FROM public.friendships WHERE status='accepted' AND ((requester_id=auth.uid() AND addressee_id=_peer) OR (addressee_id=auth.uid() AND requester_id=_peer)))
 AND NOT EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id=auth.uid() AND blocked_id=_peer) OR (blocked_id=auth.uid() AND blocker_id=_peer));
$$;
REVOKE ALL ON FUNCTION public.can_audio_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_audio_call(uuid) TO authenticated;
CREATE POLICY "Read incoming friend call signals" ON public.audio_call_signals FOR SELECT TO authenticated USING (receiver_id=auth.uid() AND expires_at>now() AND public.can_audio_call(sender_id));
CREATE POLICY "Discard own call signals" ON public.audio_call_signals FOR DELETE TO authenticated USING (receiver_id=auth.uid() OR sender_id=auth.uid());
CREATE FUNCTION public.send_audio_call_signal(_peer uuid, _call_id uuid, _kind text, _payload jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.can_audio_call(_peer) THEN RAISE EXCEPTION 'Audio calls are available only between unblocked friends'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':audio', 0));
 DELETE FROM public.audio_call_signals WHERE expires_at <= now();
 IF (SELECT count(*) FROM public.audio_call_signals WHERE sender_id=auth.uid() AND created_at>now()-interval '1 minute') >= 150 THEN RAISE EXCEPTION 'Too many call signals. Please wait.'; END IF;
 INSERT INTO public.audio_call_signals(call_id,sender_id,receiver_id,kind,payload) VALUES (_call_id,auth.uid(),_peer,_kind,_payload);
END;
$$;
REVOKE ALL ON FUNCTION public.send_audio_call_signal(uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_audio_call_signal(uuid,uuid,text,jsonb) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_call_signals;