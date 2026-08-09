import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const [rows, setRows] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SocialProfile>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await db
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as Friendship[];
    setRows(list);

    const ids = Array.from(
      new Set(list.map(r => (r.requester_id === user.id ? r.addressee_id : r.requester_id)))
    );
    if (ids.length) {
      const { data: profs } = await db
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ids);
      const map: Record<string, SocialProfile> = {};
      ((profs ?? []) as SocialProfile[]).forEach(p => (map[p.id] = p));
      setProfiles(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`friendships-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

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
