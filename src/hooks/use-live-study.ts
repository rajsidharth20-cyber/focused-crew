import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isLive, type PresenceRow } from '@/hooks/use-study-presence';

const db = supabase as any;

/** Live study status (YPT style) for a set of users, refreshed in realtime. */
export function useLiveStudy(userIds: string[]) {
  const key = userIds.slice().sort().join(',');
  const [presence, setPresence] = useState<Record<string, PresenceRow>>({});
  const [, forceTick] = useState(0);
  const instanceId = useId();

  const load = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setPresence({});
      return;
    }
    const { data } = await db.from('study_presence').select('*').in('user_id', ids);
    const map: Record<string, PresenceRow> = {};
    ((data ?? []) as PresenceRow[]).forEach(p => {
      map[p.user_id] = p;
    });
    setPresence(map);
  }, [key]);

  useEffect(() => {
    load();
    const watched = new Set(key ? key.split(',') : []);
    const channel = supabase
      .channel(`presence-${key.slice(0, 40)}-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_presence' }, payload => {
        const row = (payload.new ?? payload.old) as PresenceRow | undefined;
        if (!row?.user_id) return load();
        if (!watched.has(row.user_id)) return;
        setPresence(prev => {
          if (payload.eventType === 'DELETE') {
            const next = { ...prev };
            delete next[row.user_id];
            return next;
          }
          return { ...prev, [row.user_id]: row };
        });
      })
      .subscribe();

    // Re-sync whenever the tab or connection comes back, so we never show stale rows.
    const resync = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('online', load);

    const tick = setInterval(() => forceTick(t => t + 1), 15_000);
    // Periodic safety refetch in case a realtime event was missed.
    const poll = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('online', load);
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [key, load, instanceId]);

  const liveIds = Object.values(presence)
    .filter(isLive)
    .map(p => p.user_id);

  return { presence, liveIds, isUserLive: (id: string) => isLive(presence[id]), refresh: load };
}
