import { useEffect, useState } from 'react';
import { elapsedOf, type ActiveTimer } from '@/hooks/use-subject-timer';

/** Wall-clock repaint belongs to the display, never to the Home data owner. */
export function useTimerElapsed(timer: ActiveTimer | null, interval = 1000) {
  const [, repaint] = useState(0);
  useEffect(() => {
    if (!timer?.isRunning) return;
    const update = () => repaint(n => n + 1);
    const id = window.setInterval(update, interval);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', update); };
  }, [timer, interval]);
  return elapsedOf(timer);
}