import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Subject {
  id: string;
  name: string;
}

export interface WeeklyTarget {
  id: string;
  subjectId: string;
  target: string;
  completed: boolean;
  deadline: string | null;
}

export interface DailyObjective {
  id: string;
  subjectId: string;
  task: string;
  estimatedMinutes: number;
  completed: boolean;
  progressNotes: string[];
  date: string;
  deadline: string | null;
}

export interface Commitment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'visit' | 'meeting' | 'other';
}

export interface PlannerEvent {
  id: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
}

export interface PlannerState {
  subjects: Subject[];
  weeklyTargets: WeeklyTarget[];
  dailyObjectives: DailyObjective[];
  commitments: Commitment[];
  protocols: string[];
  events: PlannerEvent[];
}

export function usePlannerStore() {
  const { user, isGuest } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([]);
  const [pastObjectives, setPastObjectives] = useState<DailyObjective[]>([]);
  const [pastWeeklyTargets, setPastWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [protocols, setProtocols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  // Guest mode: localStorage helpers
  const getGuestData = useCallback(() => {
    try {
      const raw = localStorage.getItem('taskpilot_guest_data');
      return raw ? JSON.parse(raw) : { subjects: [], weeklyTargets: [], dailyObjectives: [], commitments: [] };
    } catch { return { subjects: [], weeklyTargets: [], dailyObjectives: [], commitments: [] }; }
  }, []);

  const saveGuestData = useCallback((data: any) => {
    localStorage.setItem('taskpilot_guest_data', JSON.stringify(data));
  }, []);

  useEffect(() => {
    if (isGuest) {
      const data = getGuestData();
      setSubjects(data.subjects || []);
      const allWT = data.weeklyTargets || [];
      setWeeklyTargets(allWT.filter((t: WeeklyTarget) => !t.deadline || t.deadline >= today));
      setPastWeeklyTargets(allWT.filter((t: WeeklyTarget) => t.deadline && t.deadline < today));
      const allDO = data.dailyObjectives || [];
      setDailyObjectives(allDO.filter((o: DailyObjective) => o.date === today));
      setPastObjectives(allDO.filter((o: DailyObjective) => o.date < today));
      setCommitments((data.commitments || []).filter((c: any) => c.date === today || !c.date));
      setProtocols(data.protocols || []);
      setLoading(false);
      return;
    }

    if (!user) return;
    setLoading(true);

    const fetchAll = async () => {
      const [sRes, wtRes, doRes, cRes, pastDoRes, pastWtRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', user.id),
        supabase.from('weekly_targets').select('*').eq('user_id', user.id)
          .or(`deadline.is.null,deadline.gte.${today}`),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).eq('date', today),
        supabase.from('commitments').select('*').eq('user_id', user.id).eq('date', today),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).lt('date', today),
        supabase.from('weekly_targets').select('*').eq('user_id', user.id).lt('deadline', today),
      ]);

      setSubjects((sRes.data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
      
      const mapWT = (t: any): WeeklyTarget => ({
        id: t.id, subjectId: t.subject_id, target: t.target, completed: t.completed, deadline: t.deadline,
      });
      setWeeklyTargets((wtRes.data ?? []).map(mapWT));
      setPastWeeklyTargets((pastWtRes.data ?? []).map(mapWT));

      const mapDO = (o: any): DailyObjective => ({
        id: o.id, subjectId: o.subject_id, task: o.task,
        estimatedMinutes: o.estimated_minutes, completed: o.completed,
        progressNotes: o.progress_notes ?? [], date: o.date, deadline: o.deadline,
      });
      setDailyObjectives((doRes.data ?? []).map(mapDO));
      setPastObjectives((pastDoRes.data ?? []).map(mapDO));

      setCommitments((cRes.data ?? []).map((c: any) => ({
        id: c.id, title: c.title, startTime: c.start_time,
        endTime: c.end_time, type: c.type as Commitment['type'],
      })));
      setLoading(false);
    };

    fetchAll();
  }, [user, isGuest, today, getGuestData]);

  const addSubject = useCallback(async (name: string) => {
    if (isGuest) {
      const id = crypto.randomUUID();
      const newSubject = { id, name };
      setSubjects(prev => {
        const updated = [...prev, newSubject];
        const data = getGuestData(); data.subjects = updated; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('subjects')
      .insert({ name, user_id: user.id }).select().single();
    if (!error && data) setSubjects(prev => [...prev, { id: data.id, name: data.name }]);
  }, [user, isGuest, getGuestData, saveGuestData]);

  const removeSubject = useCallback(async (id: string) => {
    if (isGuest) {
      setSubjects(prev => { const u = prev.filter(s => s.id !== id); const d = getGuestData(); d.subjects = u; saveGuestData(d); return u; });
      setWeeklyTargets(prev => { const u = prev.filter(t => t.subjectId !== id); const d = getGuestData(); d.weeklyTargets = [...u, ...getGuestData().weeklyTargets?.filter((t: WeeklyTarget) => t.subjectId !== id) || []]; saveGuestData(d); return u; });
      setDailyObjectives(prev => { const u = prev.filter(o => o.subjectId !== id); return u; });
      return;
    }
    await supabase.from('subjects').delete().eq('id', id);
    setSubjects(prev => prev.filter(s => s.id !== id));
    setWeeklyTargets(prev => prev.filter(t => t.subjectId !== id));
    setDailyObjectives(prev => prev.filter(o => o.subjectId !== id));
  }, [isGuest, getGuestData, saveGuestData]);

  const addWeeklyTarget = useCallback(async (subjectId: string, target: string, deadline?: string) => {
    if (isGuest) {
      const newT: WeeklyTarget = { id: crypto.randomUUID(), subjectId, target, completed: false, deadline: deadline || null };
      setWeeklyTargets(prev => {
        const updated = [...prev, newT];
        const data = getGuestData(); data.weeklyTargets = [...(data.weeklyTargets || []), newT]; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('weekly_targets')
      .insert({ subject_id: subjectId, target, user_id: user.id, deadline: deadline || null }).select().single();
    if (!error && data) setWeeklyTargets(prev => [...prev, {
      id: data.id, subjectId: data.subject_id, target: data.target, completed: data.completed, deadline: data.deadline,
    }]);
  }, [user, isGuest, getGuestData, saveGuestData]);

  const toggleWeeklyTarget = useCallback(async (id: string) => {
    const all = [...weeklyTargets, ...pastWeeklyTargets];
    const t = all.find(t => t.id === id);
    if (!t) return;
    const updater = (prev: WeeklyTarget[]) => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setWeeklyTargets(updater);
    setPastWeeklyTargets(updater);
    if (isGuest) {
      const data = getGuestData();
      data.weeklyTargets = (data.weeklyTargets || []).map((t: WeeklyTarget) => t.id === id ? { ...t, completed: !t.completed } : t);
      saveGuestData(data);
      return;
    }
    await supabase.from('weekly_targets').update({ completed: !t.completed }).eq('id', id);
  }, [weeklyTargets, pastWeeklyTargets, isGuest, getGuestData, saveGuestData]);

  const removeWeeklyTarget = useCallback(async (id: string) => {
    setWeeklyTargets(prev => prev.filter(t => t.id !== id));
    setPastWeeklyTargets(prev => prev.filter(t => t.id !== id));
    if (isGuest) {
      const data = getGuestData();
      data.weeklyTargets = (data.weeklyTargets || []).filter((t: WeeklyTarget) => t.id !== id);
      saveGuestData(data);
      return;
    }
    await supabase.from('weekly_targets').delete().eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const addDailyObjective = useCallback(async (subjectId: string, task: string, estimatedMinutes: number, deadline?: string) => {
    if (isGuest) {
      const newO: DailyObjective = { id: crypto.randomUUID(), subjectId, task, estimatedMinutes, completed: false, progressNotes: [], date: today, deadline: deadline || null };
      setDailyObjectives(prev => {
        const updated = [...prev, newO];
        const data = getGuestData(); data.dailyObjectives = [...(data.dailyObjectives || []), newO]; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('daily_objectives')
      .insert({ subject_id: subjectId, task, estimated_minutes: estimatedMinutes, user_id: user.id, date: today, deadline: deadline || null })
      .select().single();
    if (!error && data) setDailyObjectives(prev => [...prev, {
      id: data.id, subjectId: data.subject_id, task: data.task,
      estimatedMinutes: data.estimated_minutes, completed: data.completed,
      progressNotes: data.progress_notes ?? [], date: data.date, deadline: data.deadline,
    }]);
  }, [user, today, isGuest, getGuestData, saveGuestData]);

  const toggleDailyObjective = useCallback(async (id: string) => {
    const all = [...dailyObjectives, ...pastObjectives];
    const o = all.find(o => o.id === id);
    if (!o) return;
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, completed: !o.completed } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).map((o: DailyObjective) => o.id === id ? { ...o, completed: !o.completed } : o);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').update({ completed: !o.completed }).eq('id', id);
  }, [dailyObjectives, pastObjectives, isGuest, getGuestData, saveGuestData]);

  const addProgressNote = useCallback(async (id: string, note: string) => {
    const all = [...dailyObjectives, ...pastObjectives];
    const o = all.find(o => o.id === id);
    if (!o) return;
    const newNotes = [...o.progressNotes, note];
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, progressNotes: newNotes } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).map((o: DailyObjective) => o.id === id ? { ...o, progressNotes: newNotes } : o);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').update({ progress_notes: newNotes }).eq('id', id);
  }, [dailyObjectives, pastObjectives, isGuest, getGuestData, saveGuestData]);

  const removeDailyObjective = useCallback(async (id: string) => {
    setDailyObjectives(prev => prev.filter(o => o.id !== id));
    setPastObjectives(prev => prev.filter(o => o.id !== id));
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).filter((o: DailyObjective) => o.id !== id);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').delete().eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const addCommitment = useCallback(async (title: string, startTime: string, endTime: string, type: Commitment['type']) => {
    if (isGuest) {
      const newC = { id: crypto.randomUUID(), title, startTime, endTime, type, date: today };
      setCommitments(prev => {
        const updated = [...prev, newC];
        const data = getGuestData(); data.commitments = [...(data.commitments || []), newC]; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('commitments')
      .insert({ title, start_time: startTime, end_time: endTime, type, user_id: user.id, date: today })
      .select().single();
    if (!error && data) setCommitments(prev => [...prev, {
      id: data.id, title: data.title, startTime: data.start_time,
      endTime: data.end_time, type: data.type as Commitment['type'],
    }]);
  }, [user, today, isGuest, getGuestData, saveGuestData]);

  const removeCommitment = useCallback(async (id: string) => {
    setCommitments(prev => prev.filter(c => c.id !== id));
    if (isGuest) {
      const data = getGuestData();
      data.commitments = (data.commitments || []).filter((c: any) => c.id !== id);
      saveGuestData(data);
      return;
    }
    await supabase.from('commitments').delete().eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const addProtocol = useCallback((protocol: string) => {
    setProtocols(prev => {
      const updated = [...prev, protocol];
      if (isGuest) {
        const data = getGuestData(); data.protocols = updated; saveGuestData(data);
      } else {
        // For authenticated users, store in localStorage keyed by user id
        if (user) localStorage.setItem(`taskpilot_protocols_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [isGuest, user, getGuestData, saveGuestData]);

  const removeProtocol = useCallback((index: number) => {
    setProtocols(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (isGuest) {
        const data = getGuestData(); data.protocols = updated; saveGuestData(data);
      } else {
        if (user) localStorage.setItem(`taskpilot_protocols_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [isGuest, user, getGuestData, saveGuestData]);

  // Load protocols for authenticated users
  useEffect(() => {
    if (!isGuest && user) {
      try {
        const raw = localStorage.getItem(`taskpilot_protocols_${user.id}`);
        if (raw) setProtocols(JSON.parse(raw));
      } catch {}
    }
  }, [user, isGuest]);

  const clearDay = useCallback(async () => {
    setDailyObjectives([]);
    setCommitments([]);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).filter((o: DailyObjective) => o.date !== today);
      data.commitments = (data.commitments || []).filter((c: any) => c.date !== today);
      saveGuestData(data);
      return;
    }
    if (!user) return;
    await Promise.all([
      supabase.from('daily_objectives').delete().eq('user_id', user.id).eq('date', today),
      supabase.from('commitments').delete().eq('user_id', user.id).eq('date', today),
    ]);
  }, [user, today, isGuest, getGuestData, saveGuestData]);

  return {
    subjects,
    weeklyTargets,
    pastWeeklyTargets,
    dailyObjectives,
    pastObjectives,
    commitments,
    protocols,
    loading,
    addSubject,
    removeSubject,
    addWeeklyTarget,
    toggleWeeklyTarget,
    removeWeeklyTarget,
    addDailyObjective,
    toggleDailyObjective,
    addProgressNote,
    removeDailyObjective,
    addCommitment,
    removeCommitment,
    addProtocol,
    removeProtocol,
    clearDay,
  };
}
