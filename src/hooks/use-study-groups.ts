import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { onUserEvent } from '@/lib/user-events';
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
    return onUserEvent(user.id, 'group_members', payload => {
      const row = payload.new as unknown as GroupMember;
      const old = payload.old as { id?: string; user_id?: string; group_id?: string };
      if (payload.eventType !== 'DELETE' && row.user_id !== user.id) return;
      // DELETE payloads may contain only the primary key; match existing memberships by id.
      const id = old?.id ?? row?.id;
      if (!id) return;
      setMemberships(prev => {
        const existing = prev.find(m => m.id === id);
        if (payload.eventType === 'DELETE' && !existing) return prev;
        if (payload.eventType !== 'DELETE' && !existing) {
          void supabase.from('study_groups').select('*').eq('id', row.group_id).maybeSingle()
            .then(({ data }) => { if (data) setGroups(groups => [data as StudyGroup, ...groups.filter(g => g.id !== data.id)]); });
        }
        if (payload.eventType === 'DELETE' && existing) {
          setGroups(groups => groups.filter(g => g.id !== existing.group_id));
        }
        return payload.eventType === 'DELETE' ? prev.filter(m => m.id !== id) : [...prev.filter(m => m.id !== id), row];
      });
    });
  }, [user?.id, refresh]);

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
