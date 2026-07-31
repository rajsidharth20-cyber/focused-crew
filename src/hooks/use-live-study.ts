import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isLive, type PresenceRow } from '@/hooks/use-study-presence';

const db = supabase as any;

/** Live study status (YPT style) for a set of users, refreshed in realtime. */
export function useLiveStudy(userIds: string[]) {
  const key = userIds.slice().sort().join(',');
  const [presence, setPresence] = useState<Record<string, PresenceRow>>({});
  const [, forceTick] = useState(0);

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
    const channel = supabase
      .channel(`presence-${key.slice(0, 40)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_presence' }, () => load())
      .subscribe();
    const tick = setInterval(() => forceTick(t => t + 1), 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [key, load]);

  const liveIds = Object.values(presence)
    .filter(isLive)
    .map(p => p.user_id);

  return { presence, liveIds, isUserLive: (id: string) => isLive(presence[id]), refresh: load };
}
