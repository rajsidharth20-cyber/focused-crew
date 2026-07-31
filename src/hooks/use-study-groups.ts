import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  owner_id: string;
  join_code: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface MemberProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export const memberName = (p?: MemberProfile | null) =>
  p?.full_name || p?.username || 'Pilot';

/** Groups the signed-in user belongs to. */
export function useMyGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [memberships, setMemberships] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setMemberships([]);
      setLoading(false);
      return;
    }
    const { data: mems } = await supabase
      .from('group_members')
      .select('*')
      .eq('user_id', user.id);
    const ids = (mems ?? []).map(m => m.group_id);
    setMemberships((mems ?? []) as GroupMember[]);
    if (ids.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('study_groups')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    setGroups((data ?? []) as StudyGroup[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const channel = supabase
      .channel(`my-groups-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { groups, memberships, loading, refresh };
}

export async function createGroup(
  ownerId: string,
  name: string,
  description: string,
  isPublic: boolean
) {
  return supabase
    .from('study_groups')
    .insert({ owner_id: ownerId, name, description: description || null, is_public: isPublic })
    .select()
    .single();
}

export async function joinGroup(groupId: string, userId: string) {
  return supabase.from('group_members').insert({ group_id: groupId, user_id: userId });
}

export async function leaveGroup(groupId: string, userId: string) {
  return supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
}

export async function searchPublicGroups(term: string) {
  let query = supabase.from('study_groups').select('*').eq('is_public', true).limit(40);
  if (term.trim()) query = query.ilike('name', `%${term.trim()}%`);
  const { data } = await query.order('created_at', { ascending: false });
  return (data ?? []) as StudyGroup[];
}

export async function findGroupByCode(code: string) {
  const { data } = await supabase
    .from('study_groups')
    .select('*')
    .eq('join_code', code.trim().toUpperCase())
    .maybeSingle();
  return (data as StudyGroup) ?? null;
}

export async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, MemberProfile>;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', ids);
  const map: Record<string, MemberProfile> = {};
  (data ?? []).forEach(p => {
    map[p.id] = p as MemberProfile;
  });
  return map;
}
