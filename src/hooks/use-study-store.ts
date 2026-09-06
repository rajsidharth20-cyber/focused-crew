import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
type Snapshot = { tags: StudyTag[]; sessions: StudySession[]; at: number };
const memCache = new Map<string, Snapshot>();
const pendingLoads = new Map<string, Promise<Snapshot>>();
const FRESH_MS = 30 * 1000;
const lsKey = (uid: string) => `fc_study_cache_${uid}`;

function readSnapshot(uid: string): Snapshot | null {
  const m = memCache.get(uid);
  if (m) return m;
  try {
    const raw = localStorage.getItem(lsKey(uid));
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    memCache.set(uid, s);
    return s;
  } catch { return null; }
}

function writeSnapshot(uid: string, tags: StudyTag[], sessions: StudySession[]) {
  const s: Snapshot = { tags, sessions, at: Date.now() };
  memCache.set(uid, s);
  try { localStorage.setItem(lsKey(uid), JSON.stringify(s)); } catch { /* quota */ }
  return s;
}

function fetchSnapshot(uid: string): Promise<Snapshot> {
  const pending = pendingLoads.get(uid);
  if (pending) return pending;
  const p = Promise.all([
    db.from('study_tags').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
    db.from('study_sessions').select('*').eq('user_id', uid).order('started_at', { ascending: false }),
  ]).then(([tRes, sRes]: any[]) => {
    if (tRes.error || sRes.error) {
      const prev = readSnapshot(uid);
      if (prev) return prev;
      throw tRes.error ?? sRes.error;
    }
    return writeSnapshot(uid, (tRes.data ?? []).map(mapTag), (sRes.data ?? []).map(mapSession));
  }).finally(() => { pendingLoads.delete(uid); });
  pendingLoads.set(uid, p);
  return p;
}

export function useStudyStore() {
  const { user, isGuest } = useAuth();
  const initial = !isGuest && user ? readSnapshot(user.id) : null;
  const [tags, setTags] = useState<StudyTag[]>(initial?.tags ?? []);
  const [sessions, setSessions] = useState<StudySession[]>(initial?.sessions ?? []);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isGuest) {
        setTags(readLS<StudyTag>(GUEST_TAGS));
        setSessions(readLS<StudySession>(GUEST_SESSIONS));
        setLoading(false);
        return;
      }
      if (!user) return;
      const cached = readSnapshot(user.id);
      if (cached) {
        setTags(cached.tags);
        setSessions(cached.sessions);
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
    writeSnapshot(user.id, tags, sessions).at = cur?.at ?? Date.now();
  }, [tags, sessions, user, isGuest, loading]);

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

  return { tags, sessions, loading, addTag, updateTag, removeTag, addSession, updateSession, removeSession };
}
