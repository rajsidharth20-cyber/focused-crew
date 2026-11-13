import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { onUserEvent } from '@/lib/user-events';
import { useAuth } from '@/hooks/useAuth';
import { useSocialResource } from '@/hooks/use-social-resource';

const db = supabase as any;

export interface SocialProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export const socialName = (p?: SocialProfile | null) =>
  p?.full_name || p?.username || 'Pilot';

/**
 * Mutual friendships: one side requests, the other accepts.
 * Nothing is shared until a request is accepted.
 */
export function useFriends() {
  const { user } = useAuth();
  const fetchFriends = useCallback(async () => {
    if (!user) return { rows: [] as Friendship[], profiles: {} as Record<string, SocialProfile> };
    const { data, error } = await db.from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Friendship[];
    const ids = [...new Set(rows.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id))];
    const profiles: Record<string, SocialProfile> = {};
    if (ids.length) {
      const { data, error } = await db.from('profiles').select('id, username, full_name, avatar_url').in('id', ids);
      if (error) throw error;
      (data ?? []).forEach((p: SocialProfile) => { profiles[p.id] = p; });
    }
    return { rows, profiles };
  }, [user?.id]);
  const { data: state, setData, loading, reload: load } = useSocialResource(user?.id, 'friends', { rows: [] as Friendship[], profiles: {} as Record<string, SocialProfile> }, fetchFriends);
  const { rows, profiles } = state;
  const setRows = (update: (rows: Friendship[]) => Friendship[]) => setData(prev => ({ ...prev, rows: update(prev.rows) }));
  const setProfiles = (update: (profiles: Record<string, SocialProfile>) => Record<string, SocialProfile>) => setData(prev => ({ ...prev, profiles: update(prev.profiles) }));

  useEffect(() => {
    if (!user) return;
    return onUserEvent(user.id, 'friendships', payload => {
      const row = payload.new as unknown as Friendship;
      const id = (payload.old as { id?: string })?.id ?? row?.id;
      if (!id) return;
      setRows(prev => {
        const rest = prev.filter(r => r.id !== id);
        return payload.eventType === 'DELETE' ? rest : [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
      if (payload.eventType !== 'DELETE' && (row.requester_id === user.id || row.addressee_id === user.id)) {
        const other = row.requester_id === user.id ? row.addressee_id : row.requester_id;
        void db.from('profiles').select('id, username, full_name, avatar_url').eq('id', other).maybeSingle()
          .then(({ data }: { data: SocialProfile | null }) => { if (data) setProfiles(prev => ({ ...prev, [data.id]: data })); });
      }
    });
  }, [user?.id, load]);

  const otherId = useCallback(
    (r: Friendship) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id),
    [user]
  );

  const friends = useMemo(
    () => rows.filter(r => r.status === 'accepted').map(otherId),
    [rows, otherId]
  );
  const incoming = useMemo(
    () => rows.filter(r => r.status === 'pending' && r.addressee_id === user?.id),
    [rows, user]
  );
  const outgoing = useMemo(
    () => rows.filter(r => r.status === 'pending' && r.requester_id === user?.id),
    [rows, user]
  );

  const statusWith = useCallback(
    (id: string): 'none' | 'friends' | 'requested' | 'awaiting' => {
      const r = rows.find(x => otherId(x) === id);
      if (!r) return 'none';
      if (r.status === 'accepted') return 'friends';
      return r.requester_id === user?.id ? 'requested' : 'awaiting';
    },
    [rows, otherId, user]
  );

  const sendRequest = useCallback(
    async (id: string) => {
      if (!user || id === user.id) return;
      await db.from('friendships').insert({ requester_id: user.id, addressee_id: id });
      load();
    },
    [user, load]
  );

  const accept = useCallback(
    async (rowId: string) => {
      await db.from('friendships').update({ status: 'accepted' }).eq('id', rowId);
      load();
    },
    [load]
  );

  const remove = useCallback(
    async (rowId: string) => {
      await db.from('friendships').delete().eq('id', rowId);
      load();
    },
    [load]
  );

  const removeByUser = useCallback(
    async (id: string) => {
      const r = rows.find(x => otherId(x) === id);
      if (r) await remove(r.id);
    },
    [rows, otherId, remove]
  );

  return {
    loading,
    rows,
    friends,
    incoming,
    outgoing,
    profiles,
    otherId,
    statusWith,
    sendRequest,
    accept,
    remove,
    removeByUser,
    reload: load,
  };
}
