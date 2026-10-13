import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SESSION_COLUMNS, recentStudyCutoff, mergeStudySessions } from '@/lib/study-history';

export interface StudyTag {
  id: string;
  name: string;
  color: string;
}

export type StudySessionType = 'pomodoro' | 'stopwatch' | 'manual';

export interface StudySession {
  id: string;
  tagId: string | null;
  subjectId: string | null;
  topic: string | null;
  type: StudySessionType;
  durationSeconds: number;
  plannedSeconds: number | null;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  delayMinutes: number | null;
}

const db = supabase as any;
const GUEST_TAGS = 'taskpilot_guest_study_tags';
const GUEST_SESSIONS = 'taskpilot_guest_study_sessions';

const readLS = <T,>(k: string): T[] => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : []; } catch { return []; }
};
const writeLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const mapTag = (r: any): StudyTag => ({ id: r.id, name: r.name, color: r.color });
const mapSession = (r: any): StudySession => ({
  id: r.id,
  tagId: r.tag_id ?? null,
  subjectId: r.subject_id ?? null,
  topic: r.topic ?? null,
  type: (r.type ?? 'stopwatch') as StudySessionType,
  durationSeconds: r.duration_seconds ?? 0,
  plannedSeconds: r.planned_seconds ?? null,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  notes: r.notes ?? null,
  delayMinutes: r.delay_minutes ?? null,
});

// Shared in-memory cache so every screen using this hook shows data instantly
// (stale-while-revalidate) instead of re-downloading everything on mount.
type Snapshot = { tags: StudyTag[]; sessions: StudySession[]; at: number; cutoff: string; olderDayTotals: Record<string, number>; historyLoaded?: boolean };
const memCache = new Map<string, Snapshot>();
const pendingLoads = new Map<string, Promise<Snapshot>>();
const FRESH_MS = 30 * 1000;
const lsKey = (uid: string) => `fc_study_recent_v2_${uid}`;
const snapshotListeners = new Map<string, Set<(snapshot: Snapshot) => void>>();
const pendingHistory = new Map<string, Promise<StudySession[]>>();
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

function readSnapshot(uid: string): Snapshot | null {
  const m = memCache.get(uid);
  if (m) return m;
  try {
    const raw = localStorage.getItem(lsKey(uid));
    if (!raw) return null;
    if (raw.length > 500_000) return null;
    const s = JSON.parse(raw) as Snapshot;
    memCache.set(uid, s);
    return s;
  } catch { return null; }
}

function writeSnapshot(uid: string, tags: StudyTag[], sessions: StudySession[], extra: Partial<Snapshot> = {}) {
  const s: Snapshot = { cutoff: recentStudyCutoff(), olderDayTotals: {}, ...memCache.get(uid), tags, sessions, at: Date.now(), ...extra };
  memCache.set(uid, s);
  snapshotListeners.get(uid)?.forEach(listener => listener(s));
  const pending = pendingSaves.get(uid);
  if (pending) clearTimeout(pending);
  pendingSaves.set(uid, setTimeout(() => {
    pendingSaves.delete(uid);
    // Detailed history stays in memory only; disk paint cache is intentionally small.
    const recent = s.sessions.filter(row => row.startedAt >= s.cutoff).slice(0, 250);
    const raw = JSON.stringify({ ...s, sessions: recent, historyLoaded: false, at: 0 });
    if (raw.length < 500_000) {
      try { localStorage.setItem(lsKey(uid), raw); } catch { /* quota */ }
    }
  }, 200));
  return s;
}

async function fetchSessions(uid: string, cutoff: string, older = false): Promise<StudySession[]> {
  const rows: StudySession[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('study_sessions').select(SESSION_COLUMNS).eq('user_id', uid);
    query = older ? query.lt('started_at', cutoff) : query.gte('started_at', cutoff);
    const { data, error } = await query.order('started_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []).map(mapSession));
    if (!data || data.length < 500) break;
  }
  return rows;
}

async function fetchOlderTotals(uid: string, cutoff: string) {
  const totals: Record<string, number> = {};
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('study_day_totals', {
      _before: cutoff, _timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) totals[row.day] = row.seconds;
    if (!data || data.length < 500) break;
  }
  const current = memCache.get(uid);
  if (current && current.cutoff === cutoff && !current.historyLoaded) {
    writeSnapshot(uid, current.tags, current.sessions, { olderDayTotals: totals, at: current.at });
  }
}

function fetchSnapshot(uid: string): Promise<Snapshot> {
  const pending = pendingLoads.get(uid);
  if (pending) return pending;
  const cutoff = recentStudyCutoff();
  const p = Promise.all([
    supabase.from('study_tags').select('id, name, color').eq('user_id', uid).order('created_at', { ascending: true }),
    fetchSessions(uid, cutoff),
  ]).then(([tRes, rows]) => {
    if (tRes.error) {
      const prev = readSnapshot(uid);
      if (prev) return prev;
      throw tRes.error;
    }
    const previous = memCache.get(uid);
    const sessions = previous?.historyLoaded ? mergeStudySessions(previous.sessions.filter(row => row.startedAt < cutoff), rows) : rows;
    const snapshot = writeSnapshot(uid, (tRes.data ?? []).map(mapTag), sessions, {
      cutoff, historyLoaded: !!previous?.historyLoaded,
      olderDayTotals: previous?.historyLoaded ? {} : previous?.olderDayTotals ?? {},
    });
    if (!snapshot.historyLoaded) void fetchOlderTotals(uid, cutoff).catch(error => console.error('[study-store] streak totals failed', error));
    return snapshot;
  }).finally(() => { pendingLoads.delete(uid); });
  pendingLoads.set(uid, p);
  return p;
}

export function useStudyStore() {
  const { user, isGuest } = useAuth();
  const [initial] = useState(() => !isGuest && user ? readSnapshot(user.id) : null);
  const [tags, setTags] = useState<StudyTag[]>(initial?.tags ?? []);
  const [sessions, setSessions] = useState<StudySession[]>(initial?.sessions ?? []);
  const [loading, setLoading] = useState(!initial);
  const [olderDayTotals, setOlderDayTotals] = useState<Record<string, number>>(initial?.olderDayTotals ?? {});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const delivered = useRef({ tags: initial?.tags, sessions: initial?.sessions });

  useEffect(() => {
    if (!user || isGuest) return;
    const listeners = snapshotListeners.get(user.id) ?? new Set();
    const listener = (s: Snapshot) => {
      delivered.current = { tags: s.tags, sessions: s.sessions };
      setTags(s.tags); setSessions(s.sessions); setOlderDayTotals(s.olderDayTotals); setHistoryLoaded(!!s.historyLoaded);
    };
    listeners.add(listener);
    snapshotListeners.set(user.id, listeners);
    return () => { listeners.delete(listener); };
  }, [user?.id, isGuest]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isGuest) {
        setTags(readLS<StudyTag>(GUEST_TAGS));
        setSessions(readLS<StudySession>(GUEST_SESSIONS));
        setHistoryLoaded(true);
        setLoading(false);
        return;
      }
      if (!user) return;
      const cached = readSnapshot(user.id);
      if (cached) {
        delivered.current = { tags: cached.tags, sessions: cached.sessions };
        setTags(cached.tags);
        setSessions(cached.sessions);
        setOlderDayTotals(cached.olderDayTotals);
        setHistoryLoaded(!!cached.historyLoaded);
        setLoading(false);
        if (Date.now() - cached.at < FRESH_MS) return;
      } else {
        setLoading(true);
      }
      try {
        const snap = await fetchSnapshot(user.id);
        if (cancelled) return;
        setTags(snap.tags);
        setSessions(snap.sessions);
      } catch (e) {
        console.error('[study-store] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, isGuest]);

  // Keep the shared cache in step with local edits so other screens see them.
  useEffect(() => {
    if (isGuest || !user || loading) return;
    const cur = memCache.get(user.id);
    if (delivered.current.tags === tags && delivered.current.sessions === sessions) return;
    if (cur?.tags === tags && cur.sessions === sessions) return;
    writeSnapshot(user.id, tags, sessions, { at: cur?.at ?? Date.now() });
  }, [tags, sessions, user, isGuest, loading]);

  const loadHistory = useCallback(async (): Promise<StudySession[]> => {
    if (isGuest) return readLS<StudySession>(GUEST_SESSIONS);
    if (!user) return [];
    const current = memCache.get(user.id) ?? await fetchSnapshot(user.id);
    if (current.historyLoaded) return current.sessions;
    setHistoryLoading(true);
    let promise = pendingHistory.get(user.id);
    if (!promise) {
      promise = fetchSessions(user.id, current.cutoff, true).then(older => {
        const latest = memCache.get(user.id) ?? current;
        const all = mergeStudySessions(older, latest.sessions);
        writeSnapshot(user.id, latest.tags, all, { historyLoaded: true, olderDayTotals: {} });
        return all;
      }).finally(() => pendingHistory.delete(user.id));
      pendingHistory.set(user.id, promise);
    }
    try { return await promise; } finally { setHistoryLoading(false); }
  }, [user?.id, isGuest]);

  const addTag = useCallback(async (name: string, color: string) => {
    if (isGuest) {
      const t: StudyTag = { id: crypto.randomUUID(), name, color };
      setTags(prev => { const u = [...prev, t]; writeLS(GUEST_TAGS, u); return u; });
      return t;
    }
    if (!user) return null;
    const { data, error } = await db.from('study_tags').insert({ user_id: user.id, name, color }).select().single();
    if (error || !data) return null;
    const t = mapTag(data);
    setTags(prev => [...prev, t]);
    return t;
  }, [user, isGuest]);

  const updateTag = useCallback(async (id: string, patch: Partial<Pick<StudyTag,'name'|'color'>>) => {
    setTags(prev => {
      const u = prev.map(t => t.id === id ? { ...t, ...patch } : t);
      if (isGuest) writeLS(GUEST_TAGS, u);
      return u;
    });
    if (!isGuest) await db.from('study_tags').update({ name: patch.name, color: patch.color }).eq('id', id);
  }, [isGuest]);

  const removeTag = useCallback(async (id: string) => {
    setTags(prev => { const u = prev.filter(t => t.id !== id); if (isGuest) writeLS(GUEST_TAGS, u); return u; });
    setSessions(prev => {
      const u = prev.map(s => s.tagId === id ? { ...s, tagId: null } : s);
      if (isGuest) writeLS(GUEST_SESSIONS, u);
      return u;
    });
    if (!isGuest) await db.from('study_tags').delete().eq('id', id);
  }, [isGuest]);

  const addSession = useCallback(async (input: {
    tagId?: string | null;
    subjectId?: string | null;
    topic?: string | null;
    type: StudySessionType;
    durationSeconds: number;
    plannedSeconds?: number | null;
    startedAt: string;
    endedAt: string;
    notes?: string | null;
    delayMinutes?: number | null;
  }): Promise<StudySession | null> => {
    if (isGuest) {
      const s: StudySession = {
        id: crypto.randomUUID(),
        tagId: input.tagId ?? null,
        subjectId: input.subjectId ?? null,
        topic: input.topic ?? null,
        type: input.type,
        durationSeconds: input.durationSeconds,
        plannedSeconds: input.plannedSeconds ?? null,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        notes: input.notes ?? null,
        delayMinutes: input.delayMinutes ?? null,
      };
      setSessions(prev => { const u = [s, ...prev]; writeLS(GUEST_SESSIONS, u); return u; });
      return s;
    }
    if (!user) return null;
    const { data, error } = await db.from('study_sessions').insert({
      user_id: user.id,
      tag_id: input.tagId ?? null,
      subject_id: input.subjectId ?? null,
      topic: input.topic ?? null,
      type: input.type,
      duration_seconds: input.durationSeconds,
      planned_seconds: input.plannedSeconds ?? null,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      notes: input.notes ?? null,
      delay_minutes: input.delayMinutes ?? null,
    }).select().single();
    if (error || !data) return null;
    const saved = mapSession(data);
    setSessions(prev => [saved, ...prev]);
    return saved;
  }, [user, isGuest]);

  const updateSession = useCallback(async (id: string, patch: Partial<Pick<StudySession, 'tagId' | 'subjectId' | 'topic' | 'notes' | 'delayMinutes'>>) => {
    setSessions(prev => {
      const u = prev.map(s => s.id === id ? { ...s, ...patch } : s);
      if (isGuest) writeLS(GUEST_SESSIONS, u);
      return u;
    });
    if (!isGuest) {
      const dbPatch: any = {};
      if ('tagId' in patch) dbPatch.tag_id = patch.tagId ?? null;
      if ('subjectId' in patch) dbPatch.subject_id = patch.subjectId ?? null;
      if ('topic' in patch) dbPatch.topic = patch.topic ?? null;
      if ('notes' in patch) dbPatch.notes = patch.notes ?? null;
      if ('delayMinutes' in patch) dbPatch.delay_minutes = patch.delayMinutes ?? null;
      await db.from('study_sessions').update(dbPatch).eq('id', id);
    }
  }, [isGuest]);

  const removeSession = useCallback(async (id: string) => {
    setSessions(prev => { const u = prev.filter(s => s.id !== id); if (isGuest) writeLS(GUEST_SESSIONS, u); return u; });
    if (!isGuest) await db.from('study_sessions').delete().eq('id', id);
  }, [isGuest]);

  return { tags, sessions, loading, olderDayTotals, historyLoaded, historyLoading, loadHistory, addTag, updateTag, removeTag, addSession, updateSession, removeSession };
}
