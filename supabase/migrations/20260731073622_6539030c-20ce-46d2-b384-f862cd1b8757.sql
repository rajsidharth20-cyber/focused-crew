
CREATE OR REPLACE FUNCTION public.gen_join_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT true,
  owner_id uuid NOT NULL,
  join_code text NOT NULL UNIQUE DEFAULT public.gen_join_code(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_announcements TO authenticated;
GRANT ALL ON public.group_announcements TO service_role;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_messages_group_created_idx ON public.group_messages(group_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, invitee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role IN ('owner','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_group_invite(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_invites
    WHERE group_id = _group_id AND invitee_id = _user_id AND status = 'pending'
  )
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members m1
    JOIN public.group_members m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  )
$$;

REVOKE EXECUTE ON FUNCTION public.gen_join_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_group_invite(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) FROM anon;

CREATE POLICY "View public groups or own groups" ON public.study_groups
  FOR SELECT TO authenticated
  USING (is_public OR owner_id = auth.uid() OR public.is_group_member(id, auth.uid()) OR public.has_group_invite(id, auth.uid()));
CREATE POLICY "Create own groups" ON public.study_groups
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates group" ON public.study_groups
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes group" ON public.study_groups
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members view membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Join groups" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Leave or admin removes" ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins update roles" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Members read announcements" ON public.group_announcements
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Admins post announcements" ON public.group_announcements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Admins delete announcements" ON public.group_announcements
  FOR DELETE TO authenticated USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Members read group messages" ON public.group_messages
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members send group messages" ON public.group_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Authors or admins delete messages" ON public.group_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Members pin messages" ON public.group_messages
  FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "See own invites" ON public.group_invites
  FOR SELECT TO authenticated USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members invite friends" ON public.group_invites
  FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Invitee responds" ON public.group_invites
  FOR UPDATE TO authenticated USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid());
CREATE POLICY "Cancel invite" ON public.group_invites
  FOR DELETE TO authenticated USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Group mates view study sessions" ON public.study_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.shares_group_with(auth.uid(), user_id));

CREATE OR REPLACE FUNCTION public.add_group_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_group_owner_member() FROM anon, authenticated;
CREATE TRIGGER study_groups_add_owner
AFTER INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_owner_member();

CREATE TRIGGER study_groups_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.group_announcements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_announcements;
