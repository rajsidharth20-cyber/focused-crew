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

export interface PlannerState {
  subjects: Subject[];
  weeklyTargets: WeeklyTarget[];
  dailyObjectives: DailyObjective[];
  commitments: Commitment[];
}

export function usePlannerStore() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([]);
  const [pastObjectives, setPastObjectives] = useState<DailyObjective[]>([]);
  const [pastWeeklyTargets, setPastWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchAll = async () => {
      const [sRes, wtRes, doRes, cRes, pastDoRes, pastWtRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', user.id),
        // Current weekly targets: no deadline or deadline >= today
        supabase.from('weekly_targets').select('*').eq('user_id', user.id)
          .or(`deadline.is.null,deadline.gte.${today}`),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).eq('date', today),
        supabase.from('commitments').select('*').eq('user_id', user.id).eq('date', today),
        // Past daily objectives: date < today and not completed, or completed but from past
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).lt('date', today),
        // Past weekly targets: deadline < today
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
  }, [user, today]);

  const addSubject = useCallback(async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase.from('subjects')
      .insert({ name, user_id: user.id }).select().single();
    if (!error && data) setSubjects(prev => [...prev, { id: data.id, name: data.name }]);
  }, [user]);

  const removeSubject = useCallback(async (id: string) => {
    await supabase.from('subjects').delete().eq('id', id);
    setSubjects(prev => prev.filter(s => s.id !== id));
    setWeeklyTargets(prev => prev.filter(t => t.subjectId !== id));
    setDailyObjectives(prev => prev.filter(o => o.subjectId !== id));
  }, []);

  const addWeeklyTarget = useCallback(async (subjectId: string, target: string, deadline?: string) => {
    if (!user) return;
    const { data, error } = await supabase.from('weekly_targets')
      .insert({ subject_id: subjectId, target, user_id: user.id, deadline: deadline || null }).select().single();
    if (!error && data) setWeeklyTargets(prev => [...prev, {
      id: data.id, subjectId: data.subject_id, target: data.target, completed: data.completed, deadline: data.deadline,
    }]);
  }, [user]);

  const toggleWeeklyTarget = useCallback(async (id: string) => {
    const all = [...weeklyTargets, ...pastWeeklyTargets];
    const t = all.find(t => t.id === id);
    if (!t) return;
    await supabase.from('weekly_targets').update({ completed: !t.completed }).eq('id', id);
    const updater = (prev: WeeklyTarget[]) => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setWeeklyTargets(updater);
    setPastWeeklyTargets(updater);
  }, [weeklyTargets, pastWeeklyTargets]);

  const removeWeeklyTarget = useCallback(async (id: string) => {
    await supabase.from('weekly_targets').delete().eq('id', id);
    setWeeklyTargets(prev => prev.filter(t => t.id !== id));
    setPastWeeklyTargets(prev => prev.filter(t => t.id !== id));
  }, []);

  const addDailyObjective = useCallback(async (subjectId: string, task: string, estimatedMinutes: number, deadline?: string) => {
    if (!user) return;
    const { data, error } = await supabase.from('daily_objectives')
      .insert({ subject_id: subjectId, task, estimated_minutes: estimatedMinutes, user_id: user.id, date: today, deadline: deadline || null })
      .select().single();
    if (!error && data) setDailyObjectives(prev => [...prev, {
      id: data.id, subjectId: data.subject_id, task: data.task,
      estimatedMinutes: data.estimated_minutes, completed: data.completed,
      progressNotes: data.progress_notes ?? [], date: data.date, deadline: data.deadline,
    }]);
  }, [user, today]);

  const toggleDailyObjective = useCallback(async (id: string) => {
    const all = [...dailyObjectives, ...pastObjectives];
    const o = all.find(o => o.id === id);
    if (!o) return;
    await supabase.from('daily_objectives').update({ completed: !o.completed }).eq('id', id);
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, completed: !o.completed } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
  }, [dailyObjectives, pastObjectives]);

  const addProgressNote = useCallback(async (id: string, note: string) => {
    const all = [...dailyObjectives, ...pastObjectives];
    const o = all.find(o => o.id === id);
    if (!o) return;
    const newNotes = [...o.progressNotes, note];
    await supabase.from('daily_objectives').update({ progress_notes: newNotes }).eq('id', id);
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, progressNotes: newNotes } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
  }, [dailyObjectives, pastObjectives]);

  const removeDailyObjective = useCallback(async (id: string) => {
    await supabase.from('daily_objectives').delete().eq('id', id);
    setDailyObjectives(prev => prev.filter(o => o.id !== id));
    setPastObjectives(prev => prev.filter(o => o.id !== id));
  }, []);

  const addCommitment = useCallback(async (title: string, startTime: string, endTime: string, type: Commitment['type']) => {
    if (!user) return;
    const { data, error } = await supabase.from('commitments')
      .insert({ title, start_time: startTime, end_time: endTime, type, user_id: user.id, date: today })
      .select().single();
    if (!error && data) setCommitments(prev => [...prev, {
      id: data.id, title: data.title, startTime: data.start_time,
      endTime: data.end_time, type: data.type as Commitment['type'],
    }]);
  }, [user, today]);

  const removeCommitment = useCallback(async (id: string) => {
    await supabase.from('commitments').delete().eq('id', id);
    setCommitments(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearDay = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      supabase.from('daily_objectives').delete().eq('user_id', user.id).eq('date', today),
      supabase.from('commitments').delete().eq('user_id', user.id).eq('date', today),
    ]);
    setDailyObjectives([]);
    setCommitments([]);
  }, [user, today]);

  return {
    subjects,
    weeklyTargets,
    pastWeeklyTargets,
    dailyObjectives,
    pastObjectives,
    commitments,
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
    clearDay,
  };
}
