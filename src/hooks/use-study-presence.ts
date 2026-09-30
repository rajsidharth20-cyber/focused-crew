import { useEffect } from 'react';
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
const groupIds = new Map<string, Set<string>>();
const activeChannels = new Map<string, Set<{ track: (state: StudyState) => Promise<unknown> }>>();

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
  activeChannels.get(input.userId)?.forEach(channel => { void channel.track(state); });
  return Promise.resolve();
}

/** Mount once near the timer; tracking follows group membership and current timer state. */
export function useBroadcastStudyPresence(running: boolean, mode: string, topic?: string | null, startedAt?: string | null) {
  const { user, isGuest } = useAuth();
  const { groups } = useMyGroups();
  const ids = groups.map(g => g.id).sort().join(',');
  useEffect(() => {
    if (!user || isGuest) return;
    groupIds.set(user.id, new Set(ids ? ids.split(',') : []));
    const channels = [...(ids ? ids.split(',') : []).map(id => `study:group:${id}`), `study:user:${user.id}`]
      .map(name => supabase.channel(name, { config: { presence: { key: user.id } } }));
    const trackers = new Set(channels);
    activeChannels.set(user.id, trackers);
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
      if (activeChannels.get(user.id) === trackers) activeChannels.delete(user.id);
      channels.forEach(channel => { void supabase.removeChannel(channel); });
    };
  }, [user?.id, isGuest, ids]);

  useEffect(() => {
    if (!user || isGuest) return;
    void publishStudyPresence({ userId: user.id, isStudying: running, mode, topic, startedAt });
    if (!running) return;
    const interval = setInterval(() => {
      void publishStudyPresence({ userId: user.id, isStudying: running, mode, topic, startedAt });
    }, 60_000);
    return () => clearInterval(interval);
  }, [user?.id, isGuest, running, mode, topic, startedAt]);
}