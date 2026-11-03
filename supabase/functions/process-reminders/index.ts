import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { loadServiceAccount, sendToToken } from '../_shared/fcm.ts';
import { countObjectives, dailyReminders, plannerDay, scheduleReminders, validTz, type ScheduledItem, type ObjectiveRow, type Reminder } from './logic.ts';

type UserBatch = {
  user: { id: string; timezone: string; day_start_hour: number };
  prefs: Record<string, boolean> | null;
  tokens: { id: string; token: string }[];
  events: ScheduledItem[]; commitments: ScheduledItem[]; objectives: ObjectiveRow[];
  studied_seconds: number; active: boolean;
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = req.headers.get('x-reminder-secret');
  if (!secret || secret.length > 256) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Service unavailable' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: authorized, error: authError } = await db.rpc('verify_reminder_cron_secret', { _secret: secret });
  if (authError || authorized !== true) return json({ error: 'Unauthorized' }, 401);
  // No caller-supplied users, times, messages or destinations are accepted.
  const text = await req.text();
  if (text.length > 2 && text.trim() !== '{}') return json({ error: 'Body must be empty' }, 400);
  const runId = crypto.randomUUID();
  const started = Date.now();
  const metrics = { users: 0, eligible: 0, attempted: 0, successful: 0, failed: 0, invalid_tokens: 0, deduplicated: 0, duration_ms: 0 };
  let cursor: string | null = null;
  let acquired = false;
  try {
    const sa = loadServiceAccount();
    const { data: lock, error } = await db.rpc('begin_reminder_run', { _owner: runId });
    if (error) throw new Error('lock_unavailable');
    if (!lock?.acquired) return json({ skipped: 'already_running' });
    acquired = true;
    cursor = lock.cursor;
    // At most 1,000 users and 90 seconds per invocation; cursor resumes fairly.
    for (let page = 0; page < 10 && Date.now() - started < 90_000; page++) {
      const { data, error: readError } = await db.rpc('reminder_user_batch', { _after: cursor, _limit: 100 });
      if (readError) throw new Error('batch_read_failed');
      const users = data as UserBatch[];
      if (!users.length) { cursor = null; break; }
      // Four users at a time; each user sends sequentially to bounded devices.
      for (let offset = 0; offset < users.length; offset += 4) {
        if (Date.now() - started >= 90_000) break;
        const slice = users.slice(offset, offset + 4);
        await Promise.all(slice.map(async (u) => {
          metrics.users++;
          try {
            const now = new Date();
            const tz = validTz(u.user.timezone);
            const day = plannerDay(now, tz, u.user.day_start_hour);
            const objectives = countObjectives(u.objectives, day.day);
            let candidates: Reminder[] = [
              ...scheduleReminders(u.user.id, 'event', u.events, now, tz),
              ...scheduleReminders(u.user.id, 'schedule', u.commitments, now, tz),
              ...dailyReminders({ userId: u.user.id, now, tz, dayStartHour: u.user.day_start_hour, studiedSeconds: Number(u.studied_seconds), totalObjectives: objectives.total, openObjectives: objectives.open }, day.day, day.localHour),
            ];
            candidates = candidates.filter(r => u.prefs?.push_enabled !== false && u.prefs?.[r.category] !== false && !(u.active && ['study_reminders', 'streak_reminders'].includes(r.category))).slice(0, 100);
            metrics.eligible += candidates.length;
            if (!candidates.length) return;
            const { data: claims, error: claimError } = await db.rpc('claim_reminder_batch', { _items: candidates, _claim_id: runId });
            if (claimError) throw new Error('claim_failed');
            const claimed = new Map<string, Set<string>>((claims ?? []).map((c: { dedupe_key: string; delivered_device_ids: string[] }) => [c.dedupe_key, new Set(c.delivered_device_ids)]));
            metrics.deduplicated += candidates.length - claimed.size;
            const results: { dedupe_key: string; status: string; error: string | null }[] = [];
            for (const r of candidates) {
              const delivered = claimed.get(r.dedupe_key);
              if (!delivered) continue;
              let retry = false;
              let anySuccess = delivered.size > 0;
              for (const device of u.tokens) {
                if (delivered.has(device.id)) continue;
                if (Date.now() - started >= 110_000) { retry = true; break; }
                metrics.attempted++;
                const result = await sendToToken(sa, device.token, { ...r, tag: r.dedupe_key });
                if (result.outcome === 'ok') {
                  metrics.successful++;
                  anySuccess = true;
                  const { error: recordError } = await db.rpc('record_reminder_device', { _key: r.dedupe_key, _claim_id: runId, _device_id: device.id });
                  if (recordError) throw new Error('device_record_failed');
                } else if (result.outcome === 'invalid_token') {
                  metrics.invalid_tokens++;
                  await db.from('push_tokens').delete().eq('id', device.id);
                } else {
                  metrics.failed++;
                  retry = true;
                }
              }
              results.push({ dedupe_key: r.dedupe_key, status: retry ? 'failed' : anySuccess ? 'sent' : 'skipped', error: retry ? 'fcm_delivery_incomplete' : null });
            }
            const { error: finishError } = await db.rpc('finish_reminder_batch', { _results: results, _claim_id: runId });
            if (finishError) throw new Error('finish_failed');
          } catch {
            metrics.failed++;
            // No personal content, token, credential or raw provider response.
            console.warn(JSON.stringify({ event: 'reminder_user_failed', run_id: runId }));
          }
        }));
        cursor = slice.at(-1)?.user.id ?? cursor;
      }
      if (users.length < 100) { cursor = null; break; }
    }
    metrics.duration_ms = Date.now() - started;
    console.log(JSON.stringify({ event: 'reminder_run', run_id: runId, ...metrics }));
    return json(metrics);
  } catch {
    console.error(JSON.stringify({ event: 'reminder_run_failed', run_id: runId, duration_ms: Date.now() - started }));
    return json({ error: 'Reminder processing failed' }, 500);
  } finally {
    if (acquired) await db.rpc('end_reminder_run', { _owner: runId, _cursor: cursor });
  }
});