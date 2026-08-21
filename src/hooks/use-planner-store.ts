import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveToday } from '@/lib/day-boundary';

export interface Subject {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
}

export const SUBJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

export interface WeeklyTarget {
  id: string;
  subjectId: string;
  target: string;
  completed: boolean;
  deadline: string | null;
}

export type Priority = 'high' | 'medium' | 'low';

export interface DailyObjective {
  id: string;
  subjectId: string;
  task: string;
  estimatedMinutes: number;
  completed: boolean;
  progressNotes: string[];
  date: string;
  deadline: string | null;
  priority: Priority;
  recurringDays: number[] | null;
  isTemplate: boolean;
  templateId: string | null;
}

export interface Commitment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'visit' | 'meeting' | 'other';
  recurringDays: number[] | null;
}

export interface PlannerEvent {
  id: string;
  title: string;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  recurringDays: number[] | null;
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
  const [objectiveTemplates, setObjectiveTemplates] = useState<DailyObjective[]>([]);
  const [pastWeeklyTargets, setPastWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [protocols, setProtocols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Memoize today so it stays stable across re-renders within the same effective day
  const [today] = useState(() => getEffectiveToday());

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
      const todayDow = new Date(today + 'T00:00:00').getDay();
      let allDO: DailyObjective[] = data.dailyObjectives || [];
      const templates = allDO.filter((o: DailyObjective) => o.isTemplate);
      // Materialize today's copies of recurring objectives
      const generated: DailyObjective[] = [];
      templates.forEach((t: DailyObjective) => {
        if (!t.recurringDays || !t.recurringDays.includes(todayDow)) return;
        const exists = allDO.some((o: DailyObjective) => o.templateId === t.id && o.date === today);
        if (exists) return;
        generated.push({
          ...t, id: crypto.randomUUID(), date: today, completed: false,
          progressNotes: [], isTemplate: false, templateId: t.id, recurringDays: t.recurringDays,
        });
      });
      if (generated.length) {
        allDO = [...allDO, ...generated];
        data.dailyObjectives = allDO;
        saveGuestData(data);
      }
      setObjectiveTemplates(templates);
      setDailyObjectives(allDO.filter((o: DailyObjective) => !o.isTemplate && o.date === today));
      setPastObjectives(allDO.filter((o: DailyObjective) => !o.isTemplate && o.date < today));
      setCommitments((data.commitments || []).filter((c: any) =>
        (c.recurringDays && c.recurringDays.includes(todayDow)) || c.date === today || (!c.date && !c.recurringDays)
      ));
      setEvents(data.events || []);
      setProtocols(data.protocols || []);
      setLoading(false);
      return;
    }

    if (!user) return;
    const cacheKey = `fc_planner_cache_${user.id}_${today}`;

    // Instant paint from the last snapshot while the network request runs.
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const c = JSON.parse(cached);
        setSubjects(c.subjects ?? []);
        setWeeklyTargets(c.weeklyTargets ?? []);
        setDailyObjectives(c.dailyObjectives ?? []);
        setCommitments(c.commitments ?? []);
        setEvents(c.events ?? []);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch {
      setLoading(true);
    }

    const fetchAll = async () => {
      const [sRes, wtRes, doRes, cRes, pastDoRes, pastWtRes, evRes, tplRes] = await Promise.all([

        supabase.from('subjects').select('*').eq('user_id', user.id),
        supabase.from('weekly_targets').select('*').eq('user_id', user.id)
          .or(`deadline.is.null,deadline.gte.${today}`),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).eq('date', today).eq('is_template', false),
        // Today's dated stops + every recurring stop (the UI filters by day/range).
        supabase.from('commitments').select('*').eq('user_id', user.id)
          .or(`date.eq.${today},recurring_days.not.is.null`),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).lt('date', today).eq('is_template', false),
        supabase.from('weekly_targets').select('*').eq('user_id', user.id).lt('deadline', today),
        supabase.from('events').select('*').eq('user_id', user.id)
          .or(`event_date.gte.${today},recurring_days.not.is.null`).order('event_date', { ascending: true, nullsFirst: false }),
        supabase.from('daily_objectives').select('*').eq('user_id', user.id).eq('is_template', true),
      ]);

      setSubjects((sRes.data ?? [])
        .map((s: any) => ({ id: s.id, name: s.name, color: s.color ?? undefined, sortOrder: s.sort_order ?? 0 }))
        .sort((a: Subject, b: Subject) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
      
      const mapWT = (t: any): WeeklyTarget => ({
        id: t.id, subjectId: t.subject_id, target: t.target, completed: t.completed, deadline: t.deadline,
      });
      setWeeklyTargets((wtRes.data ?? []).map(mapWT));
      setPastWeeklyTargets((pastWtRes.data ?? []).map(mapWT));

      const mapDO = (o: any): DailyObjective => ({
        id: o.id, subjectId: o.subject_id, task: o.task,
        estimatedMinutes: o.estimated_minutes, completed: o.completed,
        progressNotes: o.progress_notes ?? [], date: o.date, deadline: o.deadline,
        priority: (o.priority || 'medium') as Priority,
        recurringDays: o.recurring_days ?? null,
        isTemplate: !!o.is_template,
        templateId: o.template_id ?? null,
      });

      // Recurring objectives: create today's copy for each template that matches today.
      const templates = (tplRes.data ?? []).map(mapDO);
      setObjectiveTemplates(templates);
      const todayDow = new Date(today + 'T00:00:00').getDay();
      const todaysRows = (doRes.data ?? []).map(mapDO).filter(o => !o.isTemplate);
      const missing = templates.filter(t =>
        t.recurringDays?.includes(todayDow) && !todaysRows.some(o => o.templateId === t.id),
      );
      if (missing.length > 0) {
        // Ignore duplicates: another tab/mount may have materialised the same copy.
        const { data: created } = await supabase
          .from('daily_objectives')
          .upsert(
            missing.map(t => ({
              user_id: user.id, subject_id: t.subjectId, task: t.task,
              estimated_minutes: t.estimatedMinutes, date: today, deadline: null,
              priority: t.priority, progress_notes: [], template_id: t.id, is_template: false,
            })),
            { onConflict: 'user_id,template_id,date', ignoreDuplicates: true },
          )
          .select();
        (created ?? []).forEach((r: any) => todaysRows.push(mapDO(r)));
      }
      // Safety net: never show the same recurring task twice on one day.
      const seen = new Set<string>();
      const deduped = todaysRows.filter(o => {
        const key = o.templateId ? `t:${o.templateId}` : `i:${o.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setDailyObjectives(deduped);
      setPastObjectives((pastDoRes.data ?? []).map(mapDO).filter(o => !o.isTemplate));

      const nextCommitments = (cRes.data ?? []).map((c: any) => ({
        id: c.id, title: c.title, startTime: c.start_time,
        endTime: c.end_time, type: c.type as Commitment['type'],
        recurringDays: c.recurring_days ?? null,
      }));
      setCommitments(nextCommitments);

      const nextEvents = (evRes.data ?? []).map((e: any) => ({
        id: e.id, title: e.title, eventDate: e.event_date,
        startTime: e.start_time, endTime: e.end_time, description: e.description,
        recurringDays: e.recurring_days ?? null,
      }));
      setEvents(nextEvents);
      setLoading(false);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          subjects: (sRes.data ?? [])
            .map((s: any) => ({ id: s.id, name: s.name, color: s.color ?? undefined, sortOrder: s.sort_order ?? 0 }))
            .sort((a: Subject, b: Subject) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
          weeklyTargets: (wtRes.data ?? []).map(mapWT),
          dailyObjectives: deduped,
          commitments: nextCommitments,
          events: nextEvents,
        }));
      } catch { /* cache is best-effort */ }
    };


    fetchAll();
  }, [user, isGuest, today, getGuestData]);

  const addSubject = useCallback(async (name: string, color?: string) => {
    const pick = color || SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)];
    if (isGuest) {
      const id = crypto.randomUUID();
      setSubjects(prev => {
        const updated = [...prev, { id, name, color: pick, sortOrder: prev.length }];
        const data = getGuestData(); data.subjects = updated; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await (supabase.from('subjects') as any)
      .insert({ name, user_id: user.id, color: pick, sort_order: subjects.length }).select().single();
    if (!error && data) setSubjects(prev => [...prev, { id: data.id, name: data.name, color: data.color, sortOrder: data.sort_order }]);
  }, [user, isGuest, getGuestData, saveGuestData, subjects.length]);

  const updateSubject = useCallback(async (id: string, patch: { name?: string; color?: string }) => {
    setSubjects(prev => {
      const u = prev.map(s => s.id === id ? { ...s, ...patch } : s);
      if (isGuest) { const d = getGuestData(); d.subjects = u; saveGuestData(d); }
      return u;
    });
    if (!isGuest) await (supabase.from('subjects') as any).update(patch).eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const reorderSubjects = useCallback(async (ordered: Subject[]) => {
    const withOrder = ordered.map((s, i) => ({ ...s, sortOrder: i }));
    setSubjects(withOrder);
    if (isGuest) { const d = getGuestData(); d.subjects = withOrder; saveGuestData(d); return; }
    await Promise.all(withOrder.map(s => (supabase.from('subjects') as any).update({ sort_order: s.sortOrder }).eq('id', s.id)));
  }, [isGuest, getGuestData, saveGuestData]);

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

  const addDailyObjective = useCallback(async (subjectId: string, task: string, estimatedMinutes: number, deadline?: string, priority: Priority = 'medium', initialNote?: string, recurringDays?: number[]) => {
    const rec = recurringDays && recurringDays.length ? recurringDays : null;
    const todayDow = new Date(today + 'T00:00:00').getDay();
    const initialNotes = initialNote && initialNote.trim()
      ? [JSON.stringify({ text: initialNote.trim(), timestamp: new Date().toISOString() })]
      : [];
    if (isGuest) {
      const base = { subjectId, task, estimatedMinutes, completed: false, progressNotes: initialNotes, deadline: deadline || null, priority };
      const data = getGuestData();
      const rows: DailyObjective[] = [];
      let template: DailyObjective | null = null;
      if (rec) {
        template = { ...base, id: crypto.randomUUID(), date: today, recurringDays: rec, isTemplate: true, templateId: null };
        rows.push(template);
        setObjectiveTemplates(prev => [...prev, template!]);
      }
      let instance: DailyObjective | null = null;
      if (!rec || rec.includes(todayDow)) {
        instance = { ...base, id: crypto.randomUUID(), date: today, recurringDays: rec, isTemplate: false, templateId: template?.id ?? null };
        rows.push(instance);
        setDailyObjectives(prev => [...prev, instance!]);
      }
      data.dailyObjectives = [...(data.dailyObjectives || []), ...rows];
      saveGuestData(data);
      return;
    }
    if (!user) return;
    const map = (d: any): DailyObjective => ({
      id: d.id, subjectId: d.subject_id, task: d.task,
      estimatedMinutes: d.estimated_minutes, completed: d.completed,
      progressNotes: d.progress_notes ?? [], date: d.date, deadline: d.deadline,
      priority: (d.priority || 'medium') as Priority,
      recurringDays: d.recurring_days ?? null,
      isTemplate: !!d.is_template,
      templateId: d.template_id ?? null,
    });

    let templateId: string | null = null;
    if (rec) {
      const { data: tpl } = await supabase.from('daily_objectives')
        .insert({ subject_id: subjectId, task, estimated_minutes: estimatedMinutes, user_id: user.id, date: today, deadline: null, priority, progress_notes: [], recurring_days: rec, is_template: true })
        .select().single();
      if (tpl) {
        templateId = tpl.id;
        setObjectiveTemplates(prev => [...prev, map(tpl)]);
      }
    }

    if (rec && !rec.includes(todayDow)) return;

    const { data, error } = await supabase.from('daily_objectives')
      .insert({ subject_id: subjectId, task, estimated_minutes: estimatedMinutes, user_id: user.id, date: today, deadline: deadline || null, priority, progress_notes: initialNotes, template_id: templateId })
      .select().single();
    if (!error && data) setDailyObjectives(prev => [...prev, map(data)]);
  }, [user, today, isGuest, getGuestData, saveGuestData]);

  const removeObjectiveTemplate = useCallback(async (id: string) => {
    setObjectiveTemplates(prev => prev.filter(t => t.id !== id));
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).filter((o: DailyObjective) => o.id !== id);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').delete().eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

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
    const noteEntry = JSON.stringify({ text: note, timestamp: new Date().toISOString() });
    const newNotes = [...o.progressNotes, noteEntry];
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

  const updateProgressNotes = useCallback(async (id: string, notes: string[]) => {
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, progressNotes: notes } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).map((o: DailyObjective) => o.id === id ? { ...o, progressNotes: notes } : o);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').update({ progress_notes: notes }).eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const updateObjectivePriority = useCallback(async (id: string, priority: Priority) => {
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, priority } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).map((o: DailyObjective) => o.id === id ? { ...o, priority } : o);
      saveGuestData(data);
      return;
    }
    await supabase.from('daily_objectives').update({ priority }).eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  const updateDailyObjective = useCallback(async (
    id: string,
    patch: { task?: string; estimatedMinutes?: number; subjectId?: string; deadline?: string | null },
  ) => {
    const updater = (prev: DailyObjective[]) => prev.map(o => o.id === id ? { ...o, ...patch } : o);
    setDailyObjectives(updater);
    setPastObjectives(updater);
    if (isGuest) {
      const data = getGuestData();
      data.dailyObjectives = (data.dailyObjectives || []).map((o: DailyObjective) => o.id === id ? { ...o, ...patch } : o);
      saveGuestData(data);
      return;
    }
    const row: Record<string, any> = {};
    if (patch.task !== undefined) row.task = patch.task;
    if (patch.estimatedMinutes !== undefined) row.estimated_minutes = patch.estimatedMinutes;
    if (patch.subjectId !== undefined) row.subject_id = patch.subjectId;
    if (patch.deadline !== undefined) row.deadline = patch.deadline;
    if (Object.keys(row).length === 0) return;
    await (supabase.from('daily_objectives') as any).update(row).eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

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

  const carryForwardObjective = useCallback(async (id: string, targetDate?: string) => {
    const newDate = targetDate || (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    })();
    
    const allObjs = [...dailyObjectives, ...pastObjectives];
    const obj = allObjs.find(o => o.id === id);
    if (!obj) return;

    // Remove from current lists
    setDailyObjectives(prev => prev.filter(o => o.id !== id));
    setPastObjectives(prev => prev.filter(o => o.id !== id));

    if (isGuest) {
      const data = getGuestData();
      const updated = (data.dailyObjectives || []).map((o: DailyObjective) =>
        o.id === id ? { ...o, date: newDate, completed: false } : o
      );
      data.dailyObjectives = updated;
      saveGuestData(data);
      // If target date is today, add back to current
      if (newDate === today) {
        setDailyObjectives(prev => [...prev, { ...obj, date: newDate, completed: false }]);
      }
      return;
    }
    
    await supabase.from('daily_objectives').update({ date: newDate, completed: false }).eq('id', id);
    if (newDate === today) {
      setDailyObjectives(prev => [...prev, { ...obj, date: newDate, completed: false }]);
    }
  }, [dailyObjectives, pastObjectives, today, isGuest, getGuestData, saveGuestData]);

  const addCommitment = useCallback(async (title: string, startTime: string, endTime: string, type: Commitment['type'], recurringDays?: number[]) => {
    const rec = recurringDays && recurringDays.length ? recurringDays : null;
    const todayDow = new Date(today + 'T00:00:00').getDay();
    const appliesToday = !rec || rec.includes(todayDow);
    if (isGuest) {
      const newC = { id: crypto.randomUUID(), title, startTime, endTime, type, date: rec ? null : today, recurringDays: rec };
      const data = getGuestData(); data.commitments = [...(data.commitments || []), newC]; saveGuestData(data);
      if (appliesToday) setCommitments(prev => [...prev, newC]);
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('commitments')
      .insert({ title, start_time: startTime, end_time: endTime, type, user_id: user.id, date: rec ? null : today, recurring_days: rec })
      .select().single();
    if (!error && data && appliesToday) setCommitments(prev => [...prev, {
      id: data.id, title: data.title, startTime: data.start_time,
      endTime: data.end_time, type: data.type as Commitment['type'],
      recurringDays: data.recurring_days ?? null,
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

  const addEvent = useCallback(async (title: string, eventDate: string | null, startTime?: string, endTime?: string, description?: string, recurringDays?: number[]) => {
    const rec = recurringDays && recurringDays.length ? recurringDays : null;
    const finalDate = rec ? null : eventDate;
    const sortEvents = (arr: PlannerEvent[]) => [...arr].sort((a, b) => (a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
    if (isGuest) {
      const newE: PlannerEvent = { id: crypto.randomUUID(), title, eventDate: finalDate, startTime: startTime || null, endTime: endTime || null, description: description || null, recurringDays: rec };
      setEvents(prev => {
        const updated = sortEvents([...prev, newE]);
        const data = getGuestData(); data.events = [...(data.events || []), newE]; saveGuestData(data);
        return updated;
      });
      return;
    }
    if (!user) return;
    const { data, error } = await supabase.from('events')
      .insert({ title, event_date: finalDate, start_time: startTime || null, end_time: endTime || null, description: description || null, user_id: user.id, recurring_days: rec })
      .select().single();
    if (!error && data) setEvents(prev => sortEvents([...prev, {
      id: data.id, title: data.title, eventDate: data.event_date,
      startTime: data.start_time, endTime: data.end_time, description: data.description,
      recurringDays: data.recurring_days ?? null,
    }]));
  }, [user, isGuest, getGuestData, saveGuestData]);

  const removeEvent = useCallback(async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (isGuest) {
      const data = getGuestData();
      data.events = (data.events || []).filter((e: any) => e.id !== id);
      saveGuestData(data);
      return;
    }
    await supabase.from('events').delete().eq('id', id);
  }, [isGuest, getGuestData, saveGuestData]);

  return {
    subjects,
    weeklyTargets,
    pastWeeklyTargets,
    dailyObjectives,
    pastObjectives,
    objectiveTemplates,
    commitments,
    protocols,
    events,
    loading,
    addSubject,
    updateSubject,
    reorderSubjects,
    removeSubject,
    addWeeklyTarget,
    toggleWeeklyTarget,
    removeWeeklyTarget,
    addDailyObjective,
    toggleDailyObjective,
    addProgressNote,
    updateProgressNotes,
    updateObjectivePriority,
    updateDailyObjective,
    removeDailyObjective,
    removeObjectiveTemplate,
    addCommitment,
    removeCommitment,
    addProtocol,
    removeProtocol,
    addEvent,
    removeEvent,
    carryForwardObjective,
    clearDay,
  };
}
