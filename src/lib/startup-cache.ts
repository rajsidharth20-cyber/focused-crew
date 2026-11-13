import type { Session } from '@supabase/supabase-js';
import type { PlannerState } from '@/hooks/use-planner-store';

/** Cached auth is a paint hint only; server authorization still uses validated JWTs. */
export function readStartupSession(storageKey: string): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value.access_token !== 'string' || !value.access_token ||
      typeof value.refresh_token !== 'string' || !value.refresh_token ||
      typeof value.user?.id !== 'string' || !value.user.id) return null;
    return value as Session;
  } catch { return null; }
}

export function plannerCacheKey(userId: string, today: string) {
  return `fc_planner_cache_${userId}_${today}`;
}

export function readPlannerSnapshot(userId: string | undefined, isGuest: boolean, today: string): PlannerState | null {
  try {
    const key = isGuest ? 'taskpilot_guest_data' : userId ? plannerCacheKey(userId, today) : null;
    if (!key) return null;
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (!data || !['subjects', 'weeklyTargets', 'dailyObjectives', 'commitments'].every(k => Array.isArray(data[k]))) return null;
    return {
      subjects: data.subjects,
      weeklyTargets: data.weeklyTargets.filter((t: PlannerState['weeklyTargets'][number]) => !t.deadline || t.deadline >= today),
      dailyObjectives: data.dailyObjectives.filter((o: PlannerState['dailyObjectives'][number]) => o.date === today && !o.isTemplate && !o.skipped),
      commitments: data.commitments.filter((c: PlannerState['commitments'][number]) => c.recurringDays?.length || c.date === today || (!c.date && !c.recurringDays)),
      events: Array.isArray(data.events) ? data.events : [],
      protocols: Array.isArray(data.protocols) ? data.protocols : [],
    };
  } catch { return null; }
}

export function writePlannerSnapshot(userId: string, today: string, snapshot: PlannerState) {
  try { localStorage.setItem(plannerCacheKey(userId, today), JSON.stringify(snapshot)); }
  catch { /* Cache quota/privacy failures must not prevent use or persistence. */ }
}