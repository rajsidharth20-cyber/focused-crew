import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/use-study-groups';
import { isLive, type PresenceRow } from '@/hooks/use-study-presence';

/** Read live group and friend status without querying or writing study_presence. */
export function useLiveStudy(userIds: string[]) {
  const { user } = useAuth();
  const { groups } = useMyGroups();
  const ids = [...new Set(userIds)].sort().join(',');
  const rooms = groups.map(g => `study:group:${g.id}`);
  // A friend who doesn't share a group can still be watched on their own study scope.
  const names = [...new Set([...rooms, ...ids.split(',').filter(Boolean).map(id => `study:user:${id}`)])].sort().join(',');
  const [byRoom, setByRoom] = useState<Record<string, Record<string, PresenceRow>>>({});
  const [, forceTick] = useState(0);
  const refresh = useCallback(() => setByRoom(prev => ({ ...prev })), []);

  useEffect(() => {
    if (!user || !names) { setByRoom({}); return; }
    const channels = names.split(',').map(name => {
      const channel = supabase.channel(name);
      const sync = () => {
        const state = channel.presenceState();
        const next: Record<string, PresenceRow> = {};
        for (const [id, entries] of Object.entries(state)) {
          const entry = entries[entries.length - 1] as unknown as Omit<PresenceRow, 'user_id'> | undefined;
          if (entry) next[id] = { ...entry, user_id: id };
        }
        setByRoom(prev => ({ ...prev, [name]: next }));
      };
      channel.on('presence', { event: 'sync' }, sync).subscribe();
      return channel;
    });
    const resync = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    const tick = setInterval(() => forceTick(t => t + 1), 15_000);
    let poll: ReturnType<typeof setInterval> | undefined;
    const togglePoll = () => {
      if (poll) clearInterval(poll);
      poll = document.visibilityState === 'visible' ? setInterval(refresh, 60_000) : undefined;
    };
    togglePoll();
    document.addEventListener('visibilitychange', togglePoll);
    return () => {
      channels.forEach(channel => { void supabase.removeChannel(channel); });
      document.removeEventListener('visibilitychange', resync);
      document.removeEventListener('visibilitychange', togglePoll);
      window.removeEventListener('focus', resync);
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [user?.id, names, refresh]);

  const watched = new Set(ids ? ids.split(',') : []);
  const presence = useMemo(() => {
    const merged: Record<string, PresenceRow> = {};
    for (const room of Object.values(byRoom)) {
      for (const [id, row] of Object.entries(room)) {
        if (watched.has(id) && (!merged[id] || row.updated_at > merged[id].updated_at)) merged[id] = row;
      }
    }
    return merged;
  }, [byRoom, ids]);
  const liveIds = Object.values(presence).filter(isLive).map(p => p.user_id);
  return { presence, liveIds, isUserLive: (id: string) => isLive(presence[id]), refresh };
}