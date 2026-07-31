import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export interface PresenceRow {
  user_id: string;
  is_studying: boolean;
  mode: string | null;
  topic: string | null;
  started_at: string | null;
  updated_at: string;
}

/** A presence row counts as live only if it was refreshed recently. */
export const isLive = (p?: PresenceRow | null) =>
  Boolean(p?.is_studying && Date.now() - new Date(p.updated_at).getTime() < 5 * 60 * 1000);

export async function publishStudyPresence(input: {
  userId: string;
  isStudying: boolean;
  mode?: string | null;
  topic?: string | null;
  startedAt?: string | null;
}) {
  await db.from('study_presence').upsert(
    {
      user_id: input.userId,
      is_studying: input.isStudying,
      mode: input.mode ?? null,
      topic: input.topic ?? null,
      started_at: input.isStudying ? input.startedAt ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

/**
 * Broadcasts the signed-in user's live study status so group mates can see it,
 * refreshing it every minute while a timer is running.
 */
export function useBroadcastStudyPresence(
  running: boolean,
  mode: string,
  topic?: string | null,
  startedAt?: string | null
) {
  const { user, isGuest } = useAuth();
  const infoRef = useRef({ mode, topic, startedAt });
  infoRef.current = { mode, topic, startedAt };

  useEffect(() => {
    if (!user || isGuest) return;
    const push = () =>
      publishStudyPresence({
        userId: user.id,
        isStudying: running,
        mode: infoRef.current.mode,
        topic: infoRef.current.topic,
        startedAt: infoRef.current.startedAt,
      });
    push();
    if (!running) return;
    const id = setInterval(push, 60_000);
    return () => clearInterval(id);
  }, [running, user, isGuest]);
}
