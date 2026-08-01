import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StudySession } from '@/hooks/use-study-store';

const KEY = 'taskpilot_streak_v1';
const MAX_RESTORES = 2;

interface StreakConfig {
  thresholdMinutes: number;
  restoredDates: string[]; // YYYY-MM-DD dates the user has redeemed a restore for
}

const load = (): StreakConfig => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        thresholdMinutes: typeof p.thresholdMinutes === 'number' ? p.thresholdMinutes : 30,
        restoredDates: Array.isArray(p.restoredDates) ? p.restoredDates : [],
      };
    }
  } catch {}
  return { thresholdMinutes: 30, restoredDates: [] };
};

const save = (c: StreakConfig) => localStorage.setItem(KEY, JSON.stringify(c));

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};

export function useStreak(sessions: StudySession[]) {
  const [config, setConfig] = useState<StreakConfig>(() => load());

  useEffect(() => { save(config); }, [config]);

  const minutesByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const k = dayKey(new Date(s.startedAt));
      m.set(k, (m.get(k) ?? 0) + s.durationSeconds / 60);
    }
    return m;
  }, [sessions]);

  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const todayMin = minutesByDay.get(today) ?? 0;
  const metToday = todayMin >= config.thresholdMinutes;

  // Compute streak walking back from the most recent qualifying day.
  const { streak, missedRecent } = useMemo(() => {
    const threshold = config.thresholdMinutes;
    const restored = new Set(config.restoredDates);
    // Anchor: today if met, else yesterday (grace) if met, else 0.
    let cursor = new Date();
    let count = 0;
    let anchored = false;
    const qualifies = (d: Date) => {
      const k = dayKey(d);
      return (minutesByDay.get(k) ?? 0) >= threshold || restored.has(k);
    };
    if (qualifies(cursor)) {
      anchored = true;
    } else {
      cursor = addDays(cursor, -1);
      if (qualifies(cursor)) anchored = true;
    }
    if (!anchored) {
      // find recent missed candidates (yesterday & day-before) for possible restore
      const missed: string[] = [];
      for (let i = 0; i < 2; i++) {
        const d = dayKey(addDays(new Date(), -1 - i));
        if ((minutesByDay.get(d) ?? 0) < threshold && !restored.has(d)) missed.push(d);
      }
      return { streak: 0, missedRecent: missed };
    }
    while (true) {
      const k = dayKey(cursor);
      const met = (minutesByDay.get(k) ?? 0) >= threshold;
      if (met || restored.has(k)) {
        count++;
        cursor = addDays(cursor, -1);
      } else break;
    }
    return { streak: count, missedRecent: [] as string[] };
  }, [minutesByDay, config]);

  const setThreshold = useCallback((n: number) => {
    setConfig(c => ({ ...c, thresholdMinutes: Math.max(1, Math.round(n)) }));
  }, []);

  const restoresLeft = Math.max(0, MAX_RESTORES - config.restoredDates.length);

  const restore = useCallback((dateKey: string) => {
    setConfig(c => {
      if (c.restoredDates.includes(dateKey)) return c;
      if (c.restoredDates.length >= MAX_RESTORES) return c;
      return { ...c, restoredDates: [...c.restoredDates, dateKey] };
    });
  }, []);

  const clearRestores = useCallback(() => {
    setConfig(c => ({ ...c, restoredDates: [] }));
  }, []);

  return {
    streak,
    thresholdMinutes: config.thresholdMinutes,
    setThreshold,
    todayMinutes: Math.round(todayMin),
    metToday,
    restoresLeft,
    restoredDates: config.restoredDates,
    missedRecent, // dates that could be restored to save the streak
    restore,
    clearRestores,
    today,
    yesterday,
  };
}
