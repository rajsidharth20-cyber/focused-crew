import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { onUserEvent } from '@/lib/user-events';
import { useAuth } from '@/hooks/useAuth';
import { useSocialResource } from '@/hooks/use-social-resource';
import type { SetStateAction } from 'react';

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
  const fetchGroups = useCallback(async () => {
    if (!user) return { groups: [] as StudyGroup[], memberships: [] as GroupMember[] };
    const { data: mems, error } = await supabase.from('group_members')
      .select('id, group_id, user_id, role, joined_at').eq('user_id', user.id);
    if (error) throw error;
    const memberships = (mems ?? []) as GroupMember[];
    const ids = memberships.map(m => m.group_id);
    if (!ids.length) return { groups: [] as StudyGroup[], memberships };
    const { data, error: groupError } = await supabase.from('study_groups')
      .select('id, name, description, is_public, owner_id, join_code, created_at').in('id', ids).order('created_at', { ascending: false });
    if (groupError) throw groupError;
    return { groups: (data ?? []) as StudyGroup[], memberships };
  }, [user?.id]);
  const { data: state, setData, loading, reload: refresh } = useSocialResource(user?.id, 'groups', { groups: [] as StudyGroup[], memberships: [] as GroupMember[] }, fetchGroups);
  const { groups, memberships } = state;
  const setGroups = (update: SetStateAction<StudyGroup[]>) => setData(prev => ({ ...prev, groups: typeof update === 'function' ? update(prev.groups) : update }));
  const setMemberships = (update: (rows: GroupMember[]) => GroupMember[]) => setData(prev => ({ ...prev, memberships: update(prev.memberships) }));

  useEffect(() => {
    if (!user) return;
    return onUserEvent(user.id, 'group_members', payload => {
      const row = payload.new as unknown as GroupMember;
      const old = payload.old as { id?: string; user_id?: string; group_id?: string };
      if (payload.eventType !== 'DELETE' && row.user_id !== user.id) return;
      // DELETE payloads may contain only the primary key; match existing memberships by id.
      const id = old?.id ?? row?.id;
      if (!id) return;
      if (payload.eventType !== 'DELETE') {
        void supabase.from('study_groups').select('id, name, description, is_public, owner_id, join_code, created_at').eq('id', row.group_id).maybeSingle()
          .then(({ data }) => { if (data) setGroups(groups => [data as StudyGroup, ...groups.filter(g => g.id !== data.id)]); });
      }
      setData(prev => {
        const existing = prev.memberships.find(m => m.id === id);
        if (payload.eventType === 'DELETE' && !existing) return prev;
        return {
          groups: payload.eventType === 'DELETE' ? prev.groups.filter(g => g.id !== existing?.group_id) : prev.groups,
          memberships: payload.eventType === 'DELETE' ? prev.memberships.filter(m => m.id !== id) : [...prev.memberships.filter(m => m.id !== id), row],
        };
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
