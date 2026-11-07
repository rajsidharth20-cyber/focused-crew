import { describe, expect, it, vi } from 'vitest';
import { saveNotificationPreference } from '../lib/notification-preferences';

const defaults = {
  push_enabled: true,
  direct_messages: true,
  group_messages: true,
  friend_requests: true,
  group_invites: true,
  study_reminders: true,
  streak_reminders: true,
  goal_completion: true,
  mentions: true,
  schedule_reminders: true,
  event_reminders: true,
};

describe('saving notification preferences', () => {
  it('updates only the selected preference on an existing row', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { user_id: 'user-1' }, error: null }) }) }),
    }));
    const insert = vi.fn();
    const db = { from: () => ({ update, insert }) };

    await saveNotificationPreference(db, 'user-1', 'group_messages', false, defaults);

    expect(update).toHaveBeenCalledWith({ group_messages: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a complete default row when no preference row exists', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }));
    const insert = vi.fn(async () => ({ error: null }));
    const db = { from: () => ({ update, insert }) };

    await saveNotificationPreference(db, 'user-1', 'direct_messages', false, defaults);

    expect(insert).toHaveBeenCalledWith({ ...defaults, user_id: 'user-1', direct_messages: false });
  });
});