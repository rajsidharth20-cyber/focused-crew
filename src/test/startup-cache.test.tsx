import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { readPlannerSnapshot, readStartupSession, writePlannerSnapshot } from '@/lib/startup-cache';
import { afterPaint } from '@/lib/after-paint';
import { getEffectiveToday } from '@/lib/day-boundary';

const mock = vi.hoisted(() => ({ resolve: null as null | ((result: { error: unknown }) => void), insert: vi.fn(), update: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'returning-user' }, isGuest: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'or', 'order']) query[method] = () => query;
  query.insert = (row: unknown) => { mock.insert(row); return new Promise(resolve => { mock.resolve = resolve; }); };
  query.update = (row: unknown) => { mock.update(row); const pending = new Promise(resolve => { mock.resolve = resolve; }); query.then = pending.then.bind(pending); return query; };
  return query;
} } }));
import { PlannerProvider, usePlannerStore } from '@/hooks/use-planner-store';

const snapshot = () => ({ subjects: [{ id: 'math', name: 'Math' }], weeklyTargets: [], dailyObjectives: [{ id: 'objective', subjectId: 'math', task: 'Practice', date: getEffectiveToday(), completed: false, progressNotes: [], estimatedMinutes: 30, deadline: null, priority: 'medium' as const, recurringDays: null, isTemplate: false, templateId: null, skipped: false }], commitments: [], events: [], protocols: [] });
afterEach(() => { localStorage.clear(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('cache-first startup', () => {
  it('accepts a returning session but rejects corrupt or missing credentials', () => {
    localStorage.setItem('session', JSON.stringify({ access_token: 'test', refresh_token: 'refresh', user: { id: 'user' } }));
    expect(readStartupSession('session')?.user.id).toBe('user');
    localStorage.setItem('session', JSON.stringify({ access_token: 'test', user: { id: 'user' } }));
    expect(readStartupSession('session')).toBeNull();
    localStorage.setItem('session', '{broken');
    expect(readStartupSession('session')).toBeNull();
  });
  it('isolates snapshots by account and effective day', () => {
    writePlannerSnapshot('returning-user', getEffectiveToday(), snapshot());
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.subjects[0].name).toBe('Math');
    expect(readPlannerSnapshot('another-user', false, getEffectiveToday())).toBeNull();
    expect(readPlannerSnapshot('returning-user', false, '2000-01-01')).toBeNull();
  });
  it('hydrates before the first render and rolls failed toggles back in state and storage', async () => {
    writePlannerSnapshot('returning-user', getEffectiveToday(), snapshot());
    const paints: boolean[] = [];
    const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider>{children}</PlannerProvider>;
    const { result } = renderHook(() => { const store = usePlannerStore(); paints.push(store.loading); return store; }, { wrapper });
    expect(paints[0]).toBe(false);
    let operation: Promise<void> | undefined;
    act(() => { operation = result.current.toggleDailyObjective('objective'); });
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.dailyObjectives[0].completed).toBe(true);
    await act(async () => { mock.resolve?.({ error: new Error('offline') }); await operation; });
    expect(result.current.dailyObjectives[0].completed).toBe(false);
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.dailyObjectives[0].completed).toBe(false);
  });
  it('paints and caches a new objective before persistence and removes only the failed addition', async () => {
    writePlannerSnapshot('returning-user', getEffectiveToday(), snapshot());
    const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider>{children}</PlannerProvider>;
    const { result } = renderHook(() => usePlannerStore(), { wrapper });
    let operation: Promise<unknown> | undefined;
    act(() => { operation = result.current.addDailyObjective('math', 'Read', 20).catch(() => {}); });
    expect(result.current.dailyObjectives).toHaveLength(2);
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.dailyObjectives).toHaveLength(2);
    await act(async () => { mock.resolve?.({ error: new Error('offline') }); await operation; });
    await waitFor(() => expect(result.current.dailyObjectives.map(o => o.task)).toEqual(['Practice']));
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.dailyObjectives).toHaveLength(1);
  });
  it('cancels deferred startup work on unmount', () => {
    vi.useFakeTimers();
    const work = vi.fn();
    afterPaint(work)();
    vi.runAllTimers();
    expect(work).not.toHaveBeenCalled();
    afterPaint(work);
    vi.runAllTimers();
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('caches weekly creation immediately and rolls back a failed save', async () => {
    writePlannerSnapshot('returning-user', getEffectiveToday(), snapshot());
    const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider>{children}</PlannerProvider>;
    const { result } = renderHook(() => usePlannerStore(), { wrapper });
    let operation: Promise<unknown> | undefined;
    act(() => { operation = result.current.addWeeklyTarget('math', 'Finish chapter').catch(() => {}); });
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.weeklyTargets[0].target).toBe('Finish chapter');
    await act(async () => { mock.resolve?.({ error: new Error('offline') }); await operation; });
    expect(result.current.weeklyTargets).toHaveLength(0);
    expect(readPlannerSnapshot('returning-user', false, getEffectiveToday())?.weeklyTargets).toHaveLength(0);
  });
});