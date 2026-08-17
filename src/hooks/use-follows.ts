import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ProfileOverview {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
  is_self: boolean;
  can_see: boolean;
  follow_status: 'pending' | 'accepted' | null;
  follows_me: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
  total_minutes?: number;
  week_minutes?: number;
  sessions_count?: number;
  top_subjects?: { name: string; color: string | null; minutes: number }[];
}

/** Loads a profile overview (stats + follow counts) and exposes follow actions. */
export function useProfileOverview(userId?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data: raw } = await supabase.rpc('get_profile_overview', { _user_id: userId });
    setData((raw as unknown as ProfileOverview) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const follow = useCallback(async () => {
    if (!user || !userId) return;
    setBusy(true);
    await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
    await load();
    setBusy(false);
  }, [user, userId, load]);

  const unfollow = useCallback(async () => {
    if (!user || !userId) return;
    setBusy(true);
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
    await load();
    setBusy(false);
  }, [user, userId, load]);

  return { data, loading, busy, follow, unfollow, reload: load };
}

export interface FollowRequest {
  id: string;
  follower_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

/** Pending follow requests for a private account. */
export function useFollowRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('id, follower_id')
      .eq('following_id', user.id)
      .eq('status', 'pending');
    const rows = data ?? [];
    if (rows.length === 0) {
      setRequests([]);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', rows.map(r => r.follower_id));
    setRequests(
      rows.map(r => {
        const p = profs?.find(x => x.id === r.follower_id);
        return {
          id: r.id,
          follower_id: r.follower_id,
          username: p?.username ?? null,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      })
    );
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = useCallback(
    async (id: string) => {
      await supabase.from('follows').update({ status: 'accepted' }).eq('id', id);
      await load();
    },
    [load]
  );

  const decline = useCallback(
    async (id: string) => {
      await supabase.from('follows').delete().eq('id', id);
      await load();
    },
    [load]
  );

  return { requests, accept, decline, reload: load };
}
