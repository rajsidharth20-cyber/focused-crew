import { useEffect, useRef } from 'react';
import type { PlannerEvent, Commitment } from '@/hooks/use-planner-store';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sendPush } from '@/lib/push';

const localDay = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * In-app + push reminders for events and scheduled commitments (classes, visits…).
 * Fires at 30 min, 15 min and at start time. Every send is deduped per day.
 */
export function useEventReminders(events: PlannerEvent[], commitments: Commitment[] = []) {
  const { user, isGuest } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());
  const eventsRef = useRef<PlannerEvent[]>(events);
  const commitmentsRef = useRef<Commitment[]>(commitments);
  const userRef = useRef<string | null>(null);
  eventsRef.current = events;
  commitmentsRef.current = commitments;
  userRef.current = !isGuest && user ? user.id : null;

  useEffect(() => {
    const showReminder = (
      title: string,
      timing: string,
      kind: 'event' | 'schedule',
      dedupeKey: string,
    ) => {
      try {
        const message = timing === 'now'
          ? `🚨 "${title}" is starting now!`
          : `⏰ "${title}" starts in ${timing}`;

        toast(message, { duration: 10000 });

        const uid = userRef.current;
        if (uid) {
          sendPush({
            userIds: [uid],
            category: kind === 'event' ? 'event_reminders' : 'schedule_reminders',
            title: kind === 'event' ? 'Event reminder' : 'Schedule reminder',
            body: message,
            url: kind === 'event' ? '/planner' : '/',
            dedupeKey,
          }).catch(() => {});
        } else if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(kind === 'event' ? 'Event Reminder' : 'Schedule Reminder', {
            body: message,
            icon: '/pwa-192x192.png',
          });
        }
      } catch (e) {
        console.error('Reminder notification failed:', e);
      }
    };

    const checkOne = (
      id: string,
      title: string,
      startTime: string | null,
      kind: 'event' | 'schedule',
      now: Date,
      todayStr: string,
    ) => {
      if (!startTime) return;
      const [h, m] = startTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return;

      const startAt = new Date(now);
      startAt.setHours(h, m, 0, 0);

      const diffMin = (startAt.getTime() - now.getTime()) / 60000;
      const key = `${kind}-${id}-${todayStr}`;

      if (diffMin <= 30 && diffMin > 15 && !notifiedRef.current.has(key + '-30')) {
        notifiedRef.current.add(key + '-30');
        showReminder(title, '30 minutes', kind, key + '-30');
      } else if (diffMin <= 15 && diffMin > 0 && !notifiedRef.current.has(key + '-15')) {
        notifiedRef.current.add(key + '-15');
        showReminder(title, '15 minutes', kind, key + '-15');
      } else if (diffMin <= 0 && diffMin > -2 && !notifiedRef.current.has(key + '-now')) {
        notifiedRef.current.add(key + '-now');
        showReminder(title, 'now', kind, key + '-now');
      }
    };

    const checkReminders = () => {
      try {
        const now = new Date();
        const todayStr = localDay(now);
        const todayDow = now.getDay();

        eventsRef.current.forEach(event => {
          const matchesToday = event.eventDate === todayStr
            || (event.recurringDays && event.recurringDays.includes(todayDow));
          if (!matchesToday) return;
          checkOne(event.id, event.title, event.startTime, 'event', now, todayStr);
        });

        // Commitments loaded by the store already apply to today.
        commitmentsRef.current.forEach(c => {
          checkOne(c.id, c.title, c.startTime, 'schedule', now, todayStr);
        });
      } catch (e) {
        console.error('Event reminder check failed:', e);
      }
    };

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, []); // Run once, use refs for live data
}
