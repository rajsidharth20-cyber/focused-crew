ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'human' CHECK (author_type IN ('human','focusbot'));
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS bot_event_id uuid;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'none' CHECK (moderation_status IN ('none','safe','flagged','violation'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bot_type text CHECK (bot_type IS NULL OR bot_type = 'focusbot');
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bot_role text CHECK (bot_role IS NULL OR bot_role IN ('user','assistant','system'));

CREATE TABLE public.bot_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  bot_type text NOT NULL DEFAULT 'focusbot' CHECK (bot_type = 'focusbot'),
  enabled boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, bot_type)
);
GRANT SELECT ON public.bot_instances TO authenticated;
GRANT ALL ON public.bot_instances TO service_role;
ALTER TABLE public.bot_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read bot instances" ON public.bot_instances FOR SELECT TO authenticated USING (private.is_group_member(group_id, auth.uid()));

CREATE TABLE public.bot_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('spam_detection','ai_moderation','study_assistance','chat_summaries','focus_sessions','productivity_reminders','polls')),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_instance_id, permission)
);
GRANT SELECT ON public.bot_permissions TO authenticated;
GRANT ALL ON public.bot_permissions TO service_role;
ALTER TABLE public.bot_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read bot permissions" ON public.bot_permissions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bot_instances i WHERE i.id=bot_instance_id AND private.is_group_member(i.group_id, auth.uid())));

CREATE TABLE public.bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL UNIQUE REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  response_mode text NOT NULL DEFAULT 'mentions_commands' CHECK (response_mode IN ('commands_only','mentions_commands')),
  moderation_level text NOT NULL DEFAULT 'conservative' CHECK (moderation_level IN ('conservative','balanced','strict')),
  language text NOT NULL DEFAULT 'auto',
  group_rules text NOT NULL DEFAULT 'Be respectful, stay study-focused, and do not spam.',
  auto_delete_enabled boolean NOT NULL DEFAULT false,
  auto_mute_enabled boolean NOT NULL DEFAULT false,
  mute_minutes integer NOT NULL DEFAULT 10 CHECK (mute_minutes BETWEEN 1 AND 1440),
  user_requests_per_minute integer NOT NULL DEFAULT 5 CHECK (user_requests_per_minute BETWEEN 1 AND 20),
  group_ai_requests_per_minute integer NOT NULL DEFAULT 20 CHECK (group_ai_requests_per_minute BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_settings TO authenticated;
GRANT ALL ON public.bot_settings TO service_role;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read bot settings" ON public.bot_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bot_instances i WHERE i.id=bot_instance_id AND private.is_group_member(i.group_id, auth.uid())));

CREATE TABLE public.bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
  actor_id uuid,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','ignored','failed','rate_limited')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(message_id, event_type)
);
GRANT SELECT ON public.bot_events TO authenticated;
GRANT ALL ON public.bot_events TO service_role;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group admins read bot events" ON public.bot_events FOR SELECT TO authenticated USING (private.is_group_admin(group_id, auth.uid()));

CREATE TABLE public.bot_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL,
  classification text NOT NULL CHECK (classification IN ('POTENTIALLY_PROBLEMATIC','HIGH_CONFIDENCE_VIOLATION')),
  reason text NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','deleted','muted')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);
GRANT SELECT ON public.bot_flags TO authenticated;
GRANT ALL ON public.bot_flags TO service_role;
ALTER TABLE public.bot_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group admins read bot flags" ON public.bot_flags FOR SELECT TO authenticated USING (private.is_group_admin(group_id, auth.uid()));

CREATE TABLE public.bot_focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.bot_focus_sessions TO authenticated;
GRANT ALL ON public.bot_focus_sessions TO service_role;
ALTER TABLE public.bot_focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read focus sessions" ON public.bot_focus_sessions FOR SELECT TO authenticated USING (private.is_group_member(group_id, auth.uid()));

CREATE TABLE public.bot_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 240),
  message_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_polls TO authenticated;
GRANT ALL ON public.bot_polls TO service_role;
ALTER TABLE public.bot_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read polls" ON public.bot_polls FOR SELECT TO authenticated USING (private.is_group_member(group_id, auth.uid()));

CREATE TABLE public.bot_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.bot_polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  UNIQUE(poll_id, position)
);
GRANT SELECT ON public.bot_poll_options TO authenticated;
GRANT ALL ON public.bot_poll_options TO service_role;
ALTER TABLE public.bot_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read poll options" ON public.bot_poll_options FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bot_polls p WHERE p.id=poll_id AND private.is_group_member(p.group_id, auth.uid())));

CREATE TABLE public.bot_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.bot_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.bot_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_poll_votes TO authenticated;
GRANT ALL ON public.bot_poll_votes TO service_role;
ALTER TABLE public.bot_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read poll votes" ON public.bot_poll_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bot_polls p WHERE p.id=poll_id AND private.is_group_member(p.group_id, auth.uid())));
CREATE POLICY "Members cast own poll votes" ON public.bot_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.bot_polls p JOIN public.bot_poll_options o ON o.poll_id=p.id WHERE p.id=poll_id AND o.id=option_id AND p.status='open' AND private.is_group_member(p.group_id, auth.uid())));
CREATE POLICY "Members change own poll votes" ON public.bot_poll_votes FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.bot_poll_options o WHERE o.id=option_id AND o.poll_id=poll_id));
CREATE POLICY "Members remove own poll votes" ON public.bot_poll_votes FOR DELETE TO authenticated USING (user_id=auth.uid());

CREATE TABLE public.bot_direct_state (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_direct_state TO authenticated;
GRANT ALL ON public.bot_direct_state TO service_role;
ALTER TABLE public.bot_direct_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bot state" ON public.bot_direct_state FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE TABLE public.group_member_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  restricted_until timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_member_restrictions TO authenticated;
GRANT ALL ON public.group_member_restrictions TO service_role;
ALTER TABLE public.group_member_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read group restrictions" ON public.group_member_restrictions FOR SELECT TO authenticated USING (private.is_group_admin(group_id, auth.uid()) OR user_id=auth.uid());

CREATE INDEX bot_instances_group_enabled_idx ON public.bot_instances(group_id, enabled);
CREATE INDEX bot_events_group_created_idx ON public.bot_events(group_id, created_at DESC);
CREATE INDEX bot_flags_group_status_idx ON public.bot_flags(group_id, status, created_at DESC);
CREATE INDEX bot_focus_group_active_idx ON public.bot_focus_sessions(group_id, active, ends_at DESC);
CREATE INDEX bot_polls_group_created_idx ON public.bot_polls(group_id, created_at DESC);
CREATE INDEX bot_votes_poll_idx ON public.bot_poll_votes(poll_id, option_id);
CREATE INDEX group_restrictions_active_idx ON public.group_member_restrictions(group_id, user_id, restricted_until DESC);
CREATE INDEX messages_focusbot_idx ON public.messages(sender_id, receiver_id, created_at) WHERE bot_type='focusbot';

CREATE OR REPLACE FUNCTION private.guard_focusbot_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF NEW.author_type='focusbot' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'FocusBot messages are server-only'; END IF;
  IF NEW.author_type='human' AND EXISTS (SELECT 1 FROM public.group_member_restrictions r WHERE r.group_id=NEW.group_id AND r.user_id=NEW.user_id AND r.restricted_until>now()) THEN RAISE EXCEPTION 'You are temporarily muted in this group'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_focusbot_group_message BEFORE INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION private.guard_focusbot_message();

CREATE OR REPLACE FUNCTION private.guard_focusbot_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
  IF NEW.bot_type='focusbot' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'FocusBot conversations are server-only'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_focusbot_direct_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION private.guard_focusbot_dm();

CREATE TRIGGER bot_instances_updated_at BEFORE UPDATE ON public.bot_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_permissions_updated_at BEFORE UPDATE ON public.bot_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_settings_updated_at BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_direct_state_updated_at BEFORE UPDATE ON public.bot_direct_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON FUNCTION private.guard_focusbot_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_focusbot_dm() FROM PUBLIC, anon, authenticated;