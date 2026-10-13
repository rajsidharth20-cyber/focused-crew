import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recentStudyCutoff, mergeStudySessions } from '@/lib/study-history';
import { useStreak } from '@/hooks/use-streak';
import { useTimerElapsed } from '@/hooks/use-timer-elapsed';
import { useSubjectTimer, type ActiveTimer } from '@/hooks/use-subject-timer';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isGuest: true }) }));
vi.mock('@/hooks/use-study-presence', () => ({ useBroadcastStudyPresence: vi.fn() }));

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('study performance', () => {
  it('starts the recent window at midnight 30 days ago', () => {
    const now = new Date(2026, 9, 13, 18, 30);
    const cutoff = new Date(recentStudyCutoff(now));
    expect([cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate(), cutoff.getHours()]).toEqual([2026, 8, 13, 0]);
  });
  it('deduplicates historical rows and preserves newer edits', () => {
    expect(mergeStudySessions([{ id: 'a', startedAt: '2026-09-01', topic: 'old' }], [{ id: 'a', startedAt: '2026-09-01', topic: 'edited' }, { id: 'b', startedAt: '2026-10-01', topic: 'new' }])).toEqual([
      { id: 'b', startedAt: '2026-10-01', topic: 'new' }, { id: 'a', startedAt: '2026-09-01', topic: 'edited' },
    ]);
  });
  it('preserves a 60-day streak using compact older day totals', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 12));
    const totals: Record<string, number> = {};
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 9, 13 - i, 12);
      totals[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = 1800;
    }
    const { result } = renderHook(() => useStreak([], totals));
    expect(result.current.streak).toBe(60);
    expect(result.current.todayMinutes).toBe(30);
  });
  it('updates only the clock display while the subject timer owner stays stable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    const timer: ActiveTimer = { subjectId: 'math', startedAt: new Date().toISOString(), sessionStartedAt: new Date().toISOString(), accumulatedSeconds: 0, isRunning: true };
    localStorage.setItem('taskpilot_active_subject_timer_v1', JSON.stringify(timer));
    let ownerRenders = 0;
    function Clock({ timer }: { timer: ActiveTimer | null }) { return <span data-testid="clock">{useTimerElapsed(timer)}</span>; }
    function Owner() {
      ownerRenders++;
      const subject = useSubjectTimer();
      return <Clock timer={subject.timer} />;
    }
    render(<Owner />);
    const baseline = ownerRenders;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('clock').textContent).toBe('5');
    expect(ownerRenders).toBe(baseline);
  });
});