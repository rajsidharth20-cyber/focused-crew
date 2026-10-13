import { useTimerElapsed } from '@/hooks/use-timer-elapsed';
import type { ActiveTimer } from '@/hooks/use-subject-timer';
import { fmtHMS } from '@/components/home/SubjectBoard';

export function SubjectTimerClock({ timer }: { timer: ActiveTimer | null }) {
  return <span className="text-[12.5px] font-semibold tabular-nums">{fmtHMS(useTimerElapsed(timer))}</span>;
}