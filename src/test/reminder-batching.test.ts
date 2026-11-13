import { describe, expect, it } from 'vitest';
import { exhaustedReminderUsers } from '../../supabase/functions/process-reminders/batching';

describe('reminder user pagination', () => {
  it('resumes after a time-limited partial final page instead of starving later users', () => {
    expect(exhaustedReminderUsers(99, 4)).toBe(false);
  });
  it('restarts the next pass only after processing the entire final page', () => {
    expect(exhaustedReminderUsers(99, 99)).toBe(true);
    expect(exhaustedReminderUsers(100, 100)).toBe(false);
    expect(exhaustedReminderUsers(0, 0)).toBe(true);
  });
});