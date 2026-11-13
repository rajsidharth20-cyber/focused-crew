import { supabase } from '@/integrations/supabase/client';
import { afterPaint } from '@/lib/after-paint';

type Channel = ReturnType<typeof supabase.channel>;
type Listener = (channel: Channel) => void;
const rooms = new Map<string, { channel: Channel; listeners: Set<Listener>; subscribers: Set<Listener>; users: number; ready: boolean; cancel: () => void }>();

/** Publishers and readers share one channel; register Presence handlers before subscribe. */
export function acquireStudyChannel(name: string, userId: string, listener: Listener, onReady?: Listener) {
  const key = `${userId}:${name}`;
  let room = rooms.get(key);
  if (!room) {
    const channel = supabase.channel(name, { config: { presence: { key: userId } } });
    room = { channel, listeners: new Set(), subscribers: new Set(), users: 0, ready: false, cancel: () => {} };
    const entry = room;
    const notify = () => entry.listeners.forEach(fn => fn(channel));
    channel.on('presence', { event: 'sync' }, notify);
    rooms.set(key, entry);
    entry.cancel = afterPaint(() => { channel.subscribe(status => {
      entry.ready = status === 'SUBSCRIBED';
      if (entry.ready) {
        entry.subscribers.forEach(fn => fn(channel));
        notify();
      }
    }); });
  }
  const entry = room;
  entry.users++;
  entry.listeners.add(listener);
  if (onReady) entry.subscribers.add(onReady);
  if (entry.ready) {
    onReady?.(entry.channel);
    listener(entry.channel);
  }
  let released = false;
  return {
    track: (state: Record<string, unknown>) => entry.ready ? entry.channel.track(state) : Promise.resolve(),
    release: () => {
      if (released) return;
      released = true;
      entry.listeners.delete(listener);
      if (onReady) entry.subscribers.delete(onReady);
      entry.users--;
      if (entry.users === 0 && rooms.get(key) === entry) {
        entry.cancel();
        rooms.delete(key);
        void supabase.removeChannel(entry.channel);
      }
    },
  };
}