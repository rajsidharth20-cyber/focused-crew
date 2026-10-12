import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const handlers: { sync?: () => void; status?: (status: string) => void } = {};
  const channel = {
    on: vi.fn(() => channel), subscribe: vi.fn((fn: (status: string) => void) => { handlers.status = fn; return channel; }),
    track: vi.fn().mockResolvedValue('ok'),
  };
  channel.on.mockImplementation((_type?: unknown, _filter?: unknown, fn?: () => void) => { handlers.sync = fn; return channel; });
  return { handlers, channel, create: vi.fn(() => channel), remove: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { channel: mock.create, removeChannel: mock.remove } }));
import { acquireStudyChannel } from '@/lib/study-presence-channel';

describe('shared study Presence', () => {
  beforeEach(() => vi.clearAllMocks());
  it('allows a timer reader to mount after the broadcaster subscribed', () => {
    const publish = vi.fn();
    const broadcaster = acquireStudyChannel('study:group:test', 'user', () => {}, publish);
    mock.handlers.status?.('SUBSCRIBED');
    const read = vi.fn();
    const reader = acquireStudyChannel('study:group:test', 'user', read);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.channel.on).toHaveBeenCalledTimes(1);
    expect(mock.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    mock.handlers.sync?.();
    expect(read).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
    reader.release();
    expect(mock.remove).not.toHaveBeenCalled();
    broadcaster.release();
    expect(mock.remove).toHaveBeenCalledTimes(1);
  });
});