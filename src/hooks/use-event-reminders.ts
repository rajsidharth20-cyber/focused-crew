import { useEffect, useRef } from 'react';
import type { PlannerEvent } from '@/hooks/use-planner-store';
import { toast } from 'sonner';

export function useEventReminders(events: PlannerEvent[]) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const eventsRef = useRef<PlannerEvent[]>(events);
  eventsRef.current = events;

  useEffect(() => {
    const showReminder = (event: PlannerEvent, timing: string) => {
      try {
        const message = timing === 'now'
          ? `🚨 "${event.title}" is starting now!`
          : `⏰ "${event.title}" starts in ${timing}`;

        toast(message, { duration: 10000 });

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Event Reminder', { body: message, icon: '/pwa-192x192.png' });
        }
      } catch (e) {
        console.error('Reminder notification failed:', e);
      }
    };

    const checkReminders = () => {
      try {
        const currentEvents = eventsRef.current;
        if (!currentEvents.length) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayDow = now.getDay();

        currentEvents.forEach(event => {
          const matchesToday = event.eventDate === todayStr
            || (event.recurringDays && event.recurringDays.includes(todayDow));
          if (!matchesToday || !event.startTime) return;

          const [h, m] = event.startTime.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return;

          const eventTime = new Date(now);
          eventTime.setHours(h, m, 0, 0);

          const diffMin = (eventTime.getTime() - now.getTime()) / 60000;
          const key = `${event.id}-${event.eventDate}`;

          if (diffMin <= 30 && diffMin > 15 && !notifiedRef.current.has(key + '-30')) {
            notifiedRef.current.add(key + '-30');
            showReminder(event, '30 minutes');
          } else if (diffMin <= 15 && diffMin > 0 && !notifiedRef.current.has(key + '-15')) {
            notifiedRef.current.add(key + '-15');
            showReminder(event, '15 minutes');
          } else if (diffMin <= 0 && diffMin > -2 && !notifiedRef.current.has(key + '-now')) {
            notifiedRef.current.add(key + '-now');
            showReminder(event, 'now');
          }
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
  }, []); // Run once, use ref for events
}
