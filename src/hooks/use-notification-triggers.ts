import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sendPush } from '@/lib/push';

const localDay = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Self-notifications: goal completion, study reminders and streak reminders.
 * Every send is deduped per day by the edge function, so re-running is safe.
 */
export function useNotificationTriggers() {
  const { user, isGuest } = useAuth();

  useEffect(() => {
    if (!user || isGuest) return;
    let cancelled = false;

    const run = async () => {
      const today = localDay();
      const hour = new Date().getHours();

      const [{ data: objectives }, { data: sessions }] = await Promise.all([
        supabase.from('daily_objectives').select('id, completed, task').eq('user_id', user.id).eq('date', today),
        supabase.from('study_sessions').select('duration_seconds').eq('user_id', user.id).gte('started_at', `${today}T00:00:00`),
      ]);
      if (cancelled) return;

      const objs = objectives ?? [];
      const studiedMinutes = Math.round((sessions ?? []).reduce((s, x: any) => s + (x.duration_seconds ?? 0), 0) / 60);

      // Goal completion — every objective for today is done.
      if (objs.length > 0 && objs.every((o: any) => o.completed)) {
        await sendPush({
          userIds: [user.id],
          category: 'goal_completion',
          title: 'All objectives cleared ✈️',
          body: `You completed all ${objs.length} objectives today. Nice flying.`,
          url: '/',
          dedupeKey: `goals-${today}`,
        });
      }

      // Study reminder — planned work still open in the afternoon.
      if (hour >= 16 && studiedMinutes < 15 && objs.some((o: any) => !o.completed)) {
        await sendPush({
          userIds: [user.id],
          category: 'study_reminders',
          title: 'Time to get moving',
          body: `${objs.filter((o: any) => !o.completed).length} objectives are still open today.`,
          url: '/study',
          dedupeKey: `study-${today}`,
        });
      }

      // Streak reminder — late in the day and the streak threshold is not met.
      if (hour >= 20 && studiedMinutes < 30) {
        await sendPush({
          userIds: [user.id],
          category: 'streak_reminders',
          title: 'Your streak is at risk 🔥',
          body: `Only ${studiedMinutes} min studied today. A short session keeps it alive.`,
          url: '/study',
          dedupeKey: `streak-${today}`,
        });
      }
    };

    run().catch((e) => console.error('[push triggers]', e));
    const id = window.setInterval(() => run().catch(() => {}), 30 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [user, isGuest]);
}
