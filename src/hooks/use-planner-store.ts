import { useState, useCallback } from 'react';

export interface Subject {
  id: string;
  name: string;
}

export interface WeeklyTarget {
  id: string;
  subjectId: string;
  target: string;
  completed: boolean;
}

export interface DailyObjective {
  id: string;
  subjectId: string;
  task: string;
  estimatedMinutes: number;
  completed: boolean;
  progressNotes: string[];
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

const genId = () => Math.random().toString(36).slice(2, 10);

const initialState: PlannerState = {
  subjects: [],
  weeklyTargets: [],
  dailyObjectives: [],
  commitments: [],
};

export function usePlannerStore() {
  const [state, setState] = useState<PlannerState>(() => {
    const saved = localStorage.getItem('planner-state');
    return saved ? JSON.parse(saved) : initialState;
  });

  const persist = useCallback((newState: PlannerState) => {
    setState(newState);
    localStorage.setItem('planner-state', JSON.stringify(newState));
  }, []);

  const addSubject = (name: string) => {
    const newState = { ...state, subjects: [...state.subjects, { id: genId(), name }] };
    persist(newState);
  };

  const removeSubject = (id: string) => {
    const newState = {
      ...state,
      subjects: state.subjects.filter(s => s.id !== id),
      weeklyTargets: state.weeklyTargets.filter(t => t.subjectId !== id),
      dailyObjectives: state.dailyObjectives.filter(o => o.subjectId !== id),
    };
    persist(newState);
  };

  const addWeeklyTarget = (subjectId: string, target: string) => {
    const newState = {
      ...state,
      weeklyTargets: [...state.weeklyTargets, { id: genId(), subjectId, target, completed: false }],
    };
    persist(newState);
  };

  const toggleWeeklyTarget = (id: string) => {
    const newState = {
      ...state,
      weeklyTargets: state.weeklyTargets.map(t => t.id === id ? { ...t, completed: !t.completed } : t),
    };
    persist(newState);
  };

  const removeWeeklyTarget = (id: string) => {
    const newState = { ...state, weeklyTargets: state.weeklyTargets.filter(t => t.id !== id) };
    persist(newState);
  };

  const addDailyObjective = (subjectId: string, task: string, estimatedMinutes: number) => {
    const newState = {
      ...state,
      dailyObjectives: [...state.dailyObjectives, { id: genId(), subjectId, task, estimatedMinutes, completed: false, progressNotes: [] }],
    };
    persist(newState);
  };

  const toggleDailyObjective = (id: string) => {
    const newState = {
      ...state,
      dailyObjectives: state.dailyObjectives.map(o => o.id === id ? { ...o, completed: !o.completed } : o),
    };
    persist(newState);
  };

  const addProgressNote = (id: string, note: string) => {
    const newState = {
      ...state,
      dailyObjectives: state.dailyObjectives.map(o =>
        o.id === id ? { ...o, progressNotes: [...o.progressNotes, note] } : o
      ),
    };
    persist(newState);
  };

  const removeDailyObjective = (id: string) => {
    const newState = { ...state, dailyObjectives: state.dailyObjectives.filter(o => o.id !== id) };
    persist(newState);
  };

  const addCommitment = (title: string, startTime: string, endTime: string, type: Commitment['type']) => {
    const newState = {
      ...state,
      commitments: [...state.commitments, { id: genId(), title, startTime, endTime, type }],
    };
    persist(newState);
  };

  const removeCommitment = (id: string) => {
    const newState = { ...state, commitments: state.commitments.filter(c => c.id !== id) };
    persist(newState);
  };

  const clearDay = () => {
    const newState = { ...state, dailyObjectives: [], commitments: [] };
    persist(newState);
  };

  return {
    ...state,
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
