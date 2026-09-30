import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

type Table = 'posts' | 'stories' | 'friendships' | 'group_members' | 'messages' | 'active_timers';
type Listener = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
type Shared = { channel: RealtimeChannel; listeners: Map<Table, Set<Listener>>; count: number };
const channels = new Map<string, Shared>();

/** One connection subscription per user, independent of which views are mounted. */
export function onUserEvent(userId: string, table: Table, listener: Listener) {
  let shared = channels.get(userId);
  if (!shared) {
    const listeners = new Map<Table, Set<Listener>>();
    let channel = supabase.channel(`user-events-${userId}`);
    const tables: Table[] = ['posts', 'stories', 'friendships', 'group_members', 'messages', 'active_timers'];
    for (const name of tables) {
      const options = { event: '*' as const, schema: 'public' as const, table: name,
        ...(name === 'messages' ? { filter: `receiver_id=eq.${userId}` } : {}),
        ...(name === 'active_timers' ? { filter: `user_id=eq.${userId}` } : {}),
      };
      channel = channel.on('postgres_changes', options, payload => {
        listeners.get(name)?.forEach(fn => fn(payload as RealtimePostgresChangesPayload<Record<string, unknown>>));
      });
    }
    shared = { channel: channel.subscribe(), listeners, count: 0 };
    channels.set(userId, shared);
  }
  const current = shared;
  const set = current.listeners.get(table) ?? new Set<Listener>();
  set.add(listener);
  current.listeners.set(table, set);
  current.count++;
  return () => {
    set.delete(listener);
    current.count--;
    if (current.count === 0) {
      channels.delete(userId);
      void supabase.removeChannel(current.channel);
    }
  };
}