import type { PushMessage, SendOutcome } from './fcm.ts';

/** Reuse atomic delivery claims so a log entry never implies an unattempted send. */
export async function deliverChatPush(db: any, userId: string, message: PushMessage, send: (token: string) => Promise<{ outcome: SendOutcome; status: number }>) {
  const { data: devices, error: tokenError } = await db.from('push_tokens').select('id,token').eq('user_id', userId);
  if (tokenError) throw new Error('device_lookup_failed');
  if (!devices?.length) return { sent: 0, failed: 0, noDevices: 1, deduplicated: 0 };
  const claimId = crypto.randomUUID();
  const { data: claims, error: claimError } = await db.rpc('claim_reminder_batch', { _claim_id: claimId, _items: [{ user_id: userId, category: message.category, title: message.title, body: message.body, url: message.url, dedupe_key: message.tag }] });
  if (claimError) throw new Error('notification_claim_failed');
  if (!claims?.length) return { sent: 0, failed: 0, noDevices: 0, deduplicated: 1 };
  const delivered = new Set<string>(claims[0].delivered_device_ids ?? []);
  let sent = 0;
  let failed = 0;
  for (const device of devices) {
    if (delivered.has(device.id)) continue;
    const result = await send(device.token);
    if (result.outcome === 'ok') {
      const { error } = await db.rpc('record_reminder_device', { _key: message.tag, _claim_id: claimId, _device_id: device.id });
      if (error) throw new Error('device_record_failed');
      delivered.add(device.id);
      sent++;
    } else if (result.outcome === 'invalid_token') {
      const { error } = await db.from('push_tokens').delete().eq('id', device.id).eq('user_id', userId);
      if (error) throw new Error('invalid_device_cleanup_failed');
    } else {
      failed++;
      console.warn(JSON.stringify({ event: 'chat_push_device_failed', status: result.status, outcome: result.outcome }));
    }
  }
  const { error: finishError } = await db.rpc('finish_reminder_batch', { _claim_id: claimId, _results: [{ dedupe_key: message.tag, status: failed ? 'failed' : delivered.size ? 'sent' : 'skipped', error: failed ? 'fcm_delivery_incomplete' : null }] });
  if (finishError) throw new Error('notification_finish_failed');
  return { sent, failed, noDevices: 0, deduplicated: 0 };
}