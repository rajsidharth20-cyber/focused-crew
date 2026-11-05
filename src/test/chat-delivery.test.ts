import { describe, expect, it, vi } from 'vitest';
import { deliverChatPush } from '../../supabase/functions/_shared/chat-delivery';

const message = { title: 'Message', body: 'Hello', url: '/chat/sender', category: 'direct_messages', tag: 'recipient:message-1' };
function database(devices: { id: string; token: string }[], delivered: string[] = []) {
  const remove = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
  const rpc = vi.fn(async (name: string) => ({ data: name === 'claim_reminder_batch' ? [{ delivered_device_ids: delivered }] : null, error: null }));
  return { rpc, remove, from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: devices, error: null }) }), delete: remove })) };
}
describe('chat delivery tracking', () => {
  it('does not claim or mark delivery sent when a recipient has no registered devices', async () => {
    const db = database([]);
    expect(await deliverChatPush(db, 'recipient', message, vi.fn())).toEqual({ sent: 0, failed: 0, noDevices: 1, deduplicated: 0 });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('records successful devices and never sends again to an already delivered device', async () => {
    const db = database([{ id: 'old', token: 'old-token' }, { id: 'new', token: 'new-token' }], ['old']);
    const send = vi.fn().mockResolvedValue({ outcome: 'ok', status: 200 });
    expect((await deliverChatPush(db, 'recipient', message, send)).sent).toBe(1);
    expect(send).toHaveBeenCalledExactlyOnceWith('new-token');
    expect(db.rpc).toHaveBeenCalledWith('record_reminder_device', expect.objectContaining({ _device_id: 'new' }));
    expect(db.rpc).toHaveBeenCalledWith('finish_reminder_batch', expect.objectContaining({ _results: [expect.objectContaining({ status: 'sent' })] }));
  });
  it('keeps temporary failures retryable and does not remove valid devices', async () => {
    const db = database([{ id: 'valid', token: 'test-token' }]);
    const result = await deliverChatPush(db, 'recipient', message, async () => ({ outcome: 'transient', status: 503 }));
    expect(result.failed).toBe(1);
    expect(db.remove).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith('finish_reminder_batch', expect.objectContaining({ _results: [expect.objectContaining({ status: 'failed' })] }));
  });
  it('removes an invalid token without blocking the other device', async () => {
    const db = database([{ id: 'bad', token: 'bad-token' }, { id: 'good', token: 'good-token' }]);
    const result = await deliverChatPush(db, 'recipient', message, async token => token === 'bad-token' ? { outcome: 'invalid_token', status: 404 } : { outcome: 'ok', status: 200 });
    expect(result.sent).toBe(1);
    expect(db.remove).toHaveBeenCalledOnce();
  });
});