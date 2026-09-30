import { useEffect, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/use-study-groups';

export interface PresenceRow {
  user_id: string;
  is_studying: boolean;
  mode: string | null;
  topic: string | null;
  started_at: string | null;
  updated_at: string;
}

export const isLive = (p?: PresenceRow | null) =>
  Boolean(p?.is_studying && Date.now() - new Date(p.updated_at).getTime() < 60_000);

type StudyState = Omit<PresenceRow, 'user_id'>;
const states = new Map<string, StudyState>();
const activeChannels = new Map<string, { rooms: string; count: number; channels: Set<{ track: (state: StudyState) => Promise<unknown> }> ; close: () => void }>();
const sources = new Map<string, Map<string, StudyState>>();

export function publishStudyPresence(input: {
  userId: string; isStudying: boolean; mode?: string | null;
  topic?: string | null; startedAt?: string | null;
}) {
  const state: StudyState = {
    is_studying: input.isStudying,
    mode: input.mode ?? null,
    topic: input.topic ?? null,
    started_at: input.isStudying ? input.startedAt ?? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  states.set(input.userId, state);
  activeChannels.get(input.userId)?.channels.forEach(channel => { void channel.track(state); });
  return Promise.resolve();
}

/** Mount once near the timer; tracking follows group membership and current timer state. */
export function useBroadcastStudyPresence(running: boolean, mode: string, topic?: string | null, startedAt?: string | null) {
  const { user, isGuest } = useAuth();
  const sourceId = useId();
  const { groups } = useMyGroups();
  const ids = groups.map(g => g.id).sort().join(',');
  useEffect(() => {
    if (!user || isGuest) return;
    const existing = activeChannels.get(user.id);
    if (existing?.rooms === ids) {
      existing.count++;
      return () => { existing.count--; if (!existing.count) { existing.close(); activeChannels.delete(user.id); } };
    }
    existing?.close();
    const channels = [...(ids ? ids.split(',') : []).map(id => `study:group:${id}`), `study:user:${user.id}`]
      .map(name => supabase.channel(name, { config: { presence: { key: user.id } } }));
    const trackers = new Set(channels);
    const record = { rooms: ids, count: 1, channels: trackers,
      close: () => channels.forEach(channel => { void supabase.removeChannel(channel); }) };
    activeChannels.set(user.id, record);
    for (const channel of channels) {
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void channel.track(states.get(user.id) ?? {
            is_studying: false, mode: null, topic: null, started_at: null, updated_at: new Date().toISOString(),
          });
        }
      });
    }
    return () => {
      record.count--;
      if (record.count === 0 && activeChannels.get(user.id) === record) {
        activeChannels.delete(user.id);
        record.close();
      }
    };
  }, [user?.id, isGuest, ids]);

  useEffect(() => {
    if (!user || isGuest) return;
    const current = sources.get(user.id) ?? new Map<string, StudyState>();
    current.set(sourceId, { is_studying: running, mode, topic: topic ?? null, started_at: startedAt ?? null, updated_at: new Date().toISOString() });
    sources.set(user.id, current);
    const update = () => {
      const selected = [...current.values()].find(state => state.is_studying);
      void publishStudyPresence({ userId: user.id, isStudying: Boolean(selected), mode: selected?.mode,
        topic: selected?.topic, startedAt: selected?.started_at });
    };
    update();
    const interval = running ? setInterval(update, 60_000) : undefined;
    return () => {
      if (interval) clearInterval(interval);
      current.delete(sourceId);
      update();
    };
  }, [user?.id, isGuest, sourceId, running, mode, topic, startedAt]);
}