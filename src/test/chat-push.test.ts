import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { sendPush } from '../lib/push';

describe('chat push requests', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reports a rejected notification rather than silently succeeding', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke.mockResolvedValue({ data: null, error: new Error('Unauthorized') });
    await sendPush({ userIds: ['recipient'], category: 'direct_messages', title: 'Message', body: 'Hello', url: '/chat/sender', dedupeKey: 'message-1' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});