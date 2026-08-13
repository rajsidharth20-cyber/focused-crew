import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { publishStudyPresence } from '@/hooks/use-study-presence';

const db = supabase as any;
const GUEST_KEY = 'taskpilot_active_subject_timer_v1';

/**
 * Server-truth shape of a running timer. We persist the *start timestamp* and
 * banked seconds (never a local counter), so elapsed time can be recomputed by
 * this device after a reload/background — and later by other users in a group.
 */
export interface ActiveTimer {
  subjectId: string | null;
  /** ISO time the current running segment started; null while paused. */
  startedAt: string | null;
  /** Seconds banked from previous running segments of this session. */
  accumulatedSeconds: number;
  isRunning: boolean;
  /** ISO time the whole session began (first start). */
  sessionStartedAt: string | null;
}

export interface FinishedSession {
  subjectId: string | null;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

const EMPTY: ActiveTimer | null = null;

export const elapsedOf = (t: ActiveTimer | null): number => {
  if (!t) return 0;
  const live = t.isRunning && t.startedAt ? (Date.now() - new Date(t.startedAt).getTime()) / 1000 : 0;
  return Math.max(0, Math.floor(t.accumulatedSeconds + live));
};

const readGuest = (): ActiveTimer | null => {
  try { const r = localStorage.getItem(GUEST_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
};
const writeGuest = (t: ActiveTimer | null) => {
  if (!t) localStorage.removeItem(GUEST_KEY);
  else localStorage.setItem(GUEST_KEY, JSON.stringify(t));
};

const fromRow = (r: any): ActiveTimer | null => {
  if (!r || !r.subject_id) return null;
  return {
    subjectId: r.subject_id,
    startedAt: r.started_at ?? null,
    accumulatedSeconds: r.accumulated_seconds ?? 0,
    isRunning: !!r.is_running,
    sessionStartedAt: r.created_at ?? r.started_at ?? null,
  };
};

export function useSubjectTimer(topicOf?: (subjectId: string | null) => string | null) {
  const { user, isGuest } = useAuth();
  const instanceId = useId();
  const [timer, setTimer] = useState<ActiveTimer | null>(EMPTY);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ActiveTimer | null>(null);
  timerRef.current = timer;
  const topicRef = useRef(topicOf);
  topicRef.current = topicOf;

  // ---- load + realtime sync (server is the source of truth) ----
  useEffect(() => {
    if (isGuest) { setTimer(readGuest()); return; }
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await db.from('active_timers').select('*').eq('user_id', user.id).maybeSingle();
      if (!cancelled) setTimer(fromRow(data));
    };
    load();
    const channel = supabase
      .channel(`active-timer-${user.id}-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_timers', filter: `user_id=eq.${user.id}` },
        (payload: any) => setTimer(fromRow(payload.new)))
      .subscribe();
    const resync = () => load();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [user, isGuest, instanceId]);

  // ---- 1s repaint while running (display only; elapsed is derived) ----
  useEffect(() => {
    if (!timer?.isRunning) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.isRunning]);

  const persist = useCallback(async (next: ActiveTimer | null) => {
    setTimer(next);
    if (isGuest) { writeGuest(next); return; }
    if (!user) return;
    if (!next) {
      await db.from('active_timers').delete().eq('user_id', user.id);
      return;
    }
    await db.from('active_timers').upsert({
      user_id: user.id,
      subject_id: next.subjectId,
      started_at: next.startedAt,
      accumulated_seconds: next.accumulatedSeconds,
      is_running: next.isRunning,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [user, isGuest]);

  // ---- presence broadcast so group mates can see live study ----
  useEffect(() => {
    if (!user || isGuest) return;
    const push = () => publishStudyPresence({
      userId: user.id,
      isStudying: !!timer?.isRunning,
      mode: 'subject',
      topic: topicRef.current?.(timer?.subjectId ?? null) ?? null,
      startedAt: timer?.sessionStartedAt ?? timer?.startedAt ?? null,
    });
    push();
    if (!timer?.isRunning) return;
    const id = setInterval(push, 60_000);
    return () => clearInterval(id);
  }, [timer?.isRunning, timer?.subjectId, timer?.sessionStartedAt, timer?.startedAt, user, isGuest]);

  const start = useCallback(async (subjectId: string) => {
    const now = new Date().toISOString();
    await persist({ subjectId, startedAt: now, accumulatedSeconds: 0, isRunning: true, sessionStartedAt: now });
  }, [persist]);

  const pause = useCallback(async () => {
    const t = timerRef.current;
    if (!t || !t.isRunning) return;
    await persist({ ...t, accumulatedSeconds: elapsedOf(t), startedAt: null, isRunning: false });
  }, [persist]);

  const resume = useCallback(async () => {
    const t = timerRef.current;
    if (!t || t.isRunning) return;
    await persist({ ...t, startedAt: new Date().toISOString(), isRunning: true });
  }, [persist]);

  const stop = useCallback(async (): Promise<FinishedSession | null> => {
    const t = timerRef.current;
    if (!t) return null;
    const duration = elapsedOf(t);
    const endedAt = new Date().toISOString();
    const startedAt = t.sessionStartedAt ?? new Date(Date.now() - duration * 1000).toISOString();
    await persist(null);
    if (duration < 5) return null;
    return { subjectId: t.subjectId, durationSeconds: duration, startedAt, endedAt };
  }, [persist]);

  return {
    timer,
    elapsed: elapsedOf(timer),
    tick,
    isRunning: !!timer?.isRunning,
    activeSubjectId: timer?.subjectId ?? null,
    start,
    pause,
    resume,
    stop,
  };
}
