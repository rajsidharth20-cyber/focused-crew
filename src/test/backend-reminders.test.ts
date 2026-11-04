import { describe, it, expect, beforeEach, vi } from 'vitest';
import { countObjectives, dailyReminders, dueStage, plannerDay, scheduleReminders, zonedToUtc } from '../../supabase/functions/process-reminders/logic';
import { buildFcmMessage, classifyFcmError, safeAppPath } from '../../supabase/functions/_shared/fcm';
import { claimNotification } from '../lib/notification-dedupe';
import { waitForWorkerActive } from '../lib/service-worker-active';

const item = { id: 'event-1', title: 'Study', date: '2026-11-03', start_time: '20:00', recurring_days: null };
const now = new Date('2026-11-03T14:15:00Z'); // 19:45 Kolkata
const daily = (seconds = 0, hour = 20, open = 1) => dailyReminders({ userId: 'u', now, tz: 'Asia/Kolkata', dayStartHour: 3, studiedSeconds: seconds, totalObjectives: 1, openObjectives: open }, '2026-11-03', hour);

describe('backend reminder rules', () => {
  it('A: evaluates a 15-minute commitment without a browser timer', () => {
    const result = scheduleReminders('u', 'schedule', [item], now, 'Asia/Kolkata');
    expect(result).toHaveLength(1);
    expect(result[0].dedupe_key).toBe('u:schedule_reminders:schedule-event-1-2026-11-03-2000-15');
  });
  it('B: stable identity across invocations; editing time re-arms', () => {
    const first = scheduleReminders('u', 'event', [item], now, 'Asia/Kolkata')[0];
    expect(scheduleReminders('u', 'event', [item], now, 'Asia/Kolkata')[0].dedupe_key).toBe(first.dedupe_key);
    expect(scheduleReminders('u', 'event', [{ ...item, start_time: '20:05' }], now, 'Asia/Kolkata')[0].dedupe_key).not.toBe(first.dedupe_key);
  });
  it('D: thirty study minutes suppresses streak-risk reminders', () => {
    expect(daily(1800).some(r => r.category === 'streak_reminders')).toBe(false);
    expect(daily(1740).some(r => r.category === 'streak_reminders')).toBe(true);
  });
  it('E: timezone shifts and DST conversion use local wall time', () => {
    expect(zonedToUtc('2026-11-03', '20:00', 'Asia/Kolkata')?.toISOString()).toBe('2026-11-03T14:30:00.000Z');
    expect(zonedToUtc('2026-07-03', '20:00', 'America/New_York')?.toISOString()).toBe('2026-07-04T00:00:00.000Z');
    expect(zonedToUtc('2026-03-08', '02:30', 'America/New_York')).toBeNull();
  });
  it('G: invalid-token errors differ from temporary provider failures', () => {
    expect(classifyFcmError(404, 'UNREGISTERED')).toBe('invalid_token');
    expect(classifyFcmError(503, 'unavailable')).toBe('transient');
    expect(classifyFcmError(400, 'INVALID_ARGUMENT invalid title')).toBe('fatal');
  });
  it('J: deleted events and invalid timestamps cannot generate reminders', () => {
    expect(scheduleReminders('u', 'event', [], now, 'Asia/Kolkata')).toEqual([]);
    expect(scheduleReminders('u', 'event', [{ ...item, start_time: 'invalid' }], now, 'Asia/Kolkata')).toEqual([]);
  });
  it('K: before 3 AM belongs to previous planner day', () => {
    const day = plannerDay(new Date('2026-11-03T21:00:00Z'), 'Asia/Kolkata', 3);
    expect(day.day).toBe('2026-11-03');
    expect(day.start.toISOString()).toBe('2026-11-02T21:30:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-03T21:30:00.000Z');
  });
  it('preserves afternoon study threshold and completed-objective behavior', () => {
    expect(daily(0, 15).some(r => r.category === 'study_reminders')).toBe(false);
    expect(daily(0, 16).some(r => r.category === 'study_reminders')).toBe(true);
    expect(daily(900, 16).some(r => r.category === 'study_reminders')).toBe(false);
    expect(daily(0, 16, 0).map(r => r.category)).toEqual(['goal_completion']);
  });
  it('preserves 30/15/start stages and drops stale starts after ten minutes', () => {
    const start = new Date('2026-11-03T15:00:00Z');
    expect(dueStage(start, new Date('2026-11-03T14:30:00Z'))).toBe('30');
    expect(dueStage(start, new Date('2026-11-03T14:45:00Z'))).toBe('15');
    expect(dueStage(start, start)).toBe('now');
    expect(dueStage(start, new Date('2026-11-03T15:10:00Z'))).toBeNull();
  });
  it('counts recurring objectives once and respects skipped instances', () => {
    const template = { id: 't', date: '2026-11-01', completed: false, skipped: false, is_template: true, template_id: null, recurring_days: [2] };
    expect(countObjectives([template], '2026-11-03')).toEqual({ total: 1, open: 1 });
    expect(countObjectives([template, { ...template, id: 'i', date: '2026-11-03', is_template: false, template_id: 't', completed: true }], '2026-11-03')).toEqual({ total: 1, open: 0 });
    expect(countObjectives([template, { ...template, id: 'i', date: '2026-11-03', is_template: false, template_id: 't', skipped: true }], '2026-11-03')).toEqual({ total: 0, open: 0 });
  });
  it('uses one data-only worker notification with bounded TTL and safe links', () => {
    const payload = buildFcmMessage('test-device', { title: 'Study', body: 'Ready', category: 'study_reminders', url: 'https://evil.invalid', tag: 'r', ttlSeconds: 600 });
    expect(payload.message).not.toHaveProperty('notification');
    expect(payload.message.data.url).toBe('/');
    expect(payload.message.webpush.headers).toEqual({ Urgency: 'high', TTL: '600' });
    expect(safeAppPath('//evil.invalid')).toBe('/');
  });
});

describe('foreground notifications and worker activation', () => {
  beforeEach(() => localStorage.clear());
  it('N: deduplicates a foreground message across mounted consumers', () => {
    expect(claimNotification('same', 100000)).toBe(true);
    expect(claimNotification('same', 100001)).toBe(false);
    expect(claimNotification('other', 100001)).toBe(true);
  });
  it('waits for the FCM registration without depending on a root worker', async () => {
    await expect(waitForWorkerActive({ active: { state: 'activated' } } as ServiceWorkerRegistration)).resolves.toBeUndefined();
  });
  it('times out worker activation rather than hanging notification setup', async () => {
    vi.useFakeTimers();
    const worker = new EventTarget();
    Object.assign(worker, { state: 'installing' });
    const waiting = waitForWorkerActive({ installing: worker } as unknown as ServiceWorkerRegistration, 50);
    const assertion = expect(waiting).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    vi.useRealTimers();
  });
});

describe('event reminder delivery window', () => {
  it('keeps event and schedule pushes deliverable for at least an hour', () => {
    const now = new Date('2026-11-04T14:20:00Z');
    const [r] = scheduleReminders('u', 'event', [{ id: 'e', title: 'Testing', start_time: '19:47', date: '2026-11-04', recurring_days: null }], now, 'Asia/Kolkata');
    expect(r.ttlSeconds).toBeGreaterThanOrEqual(3600);
  });
});
