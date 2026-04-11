import { useEffect, useRef } from 'react';
import type { PlannerEvent } from '@/hooks/use-planner-store';
import { toast } from '@/components/ui/sonner';

export function useEventReminders(events: PlannerEvent[]) {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!events.length) return;

    const checkReminders = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      events.forEach(event => {
        if (event.eventDate !== todayStr || !event.startTime) return;
        
        const key = `${event.id}-${event.eventDate}`;
        if (notifiedRef.current.has(key)) return;

        const [h, m] = event.startTime.split(':').map(Number);
        const eventTime = new Date(now);
        eventTime.setHours(h, m, 0, 0);

        const diffMin = (eventTime.getTime() - now.getTime()) / 60000;

        // Notify 30 min before, 15 min before, and at event time
        if (diffMin <= 30 && diffMin > 15) {
          notifiedRef.current.add(key + '-30');
          showReminder(event, '30 minutes');
        } else if (diffMin <= 15 && diffMin > 0) {
          if (!notifiedRef.current.has(key + '-15')) {
            notifiedRef.current.add(key + '-15');
            showReminder(event, '15 minutes');
          }
        } else if (diffMin <= 0 && diffMin > -1) {
          if (!notifiedRef.current.has(key + '-now')) {
            notifiedRef.current.add(key + '-now');
            showReminder(event, 'now');
          }
        }
      });
    };

    const showReminder = (event: PlannerEvent, timing: string) => {
      const message = timing === 'now'
        ? `🚨 "${event.title}" is starting now!`
        : `⏰ "${event.title}" starts in ${timing}`;
      
      toast(message, { duration: 10000 });

      // Also try browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Event Reminder', { body: message, icon: '/pwa-192x192.png' });
      }
    };

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60000); // check every minute
    return () => clearInterval(interval);
  }, [events]);
}
