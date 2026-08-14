import { Flame, Target, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  minutesToday: number;
  goalMinutes: number;
  streak: number;
  subjectsActive: number;
  onOpenStreak: () => void;
}

const fmt = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

/** Personal dashboard hero: today's time versus the daily goal. */
export function TodayProgressCard({ minutesToday, goalMinutes, streak, subjectsActive, onOpenStreak }: Props) {
  const pct = goalMinutes > 0 ? Math.min(100, Math.round((minutesToday / goalMinutes) * 100)) : 0;
  const remaining = Math.max(0, goalMinutes - minutesToday);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-br from-primary/12 via-background to-accent/10 p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'hsl(var(--primary) / 0.25)' }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Today</p>
          <p className="mt-1 font-display text-[38px] leading-none font-bold tracking-tight tabular-nums">
            {fmt(minutesToday)}
          </p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {remaining > 0 ? `${fmt(remaining)} to hit your ${fmt(goalMinutes)} goal` : `Goal smashed · ${fmt(goalMinutes)}`}
          </p>
        </div>

        <button
          onClick={onOpenStreak}
          className="press shrink-0 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-center backdrop-blur"
        >
          <Flame className={`mx-auto h-4 w-4 ${streak > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className="mt-1 block text-[15px] font-bold leading-none tabular-nums">{streak}</span>
          <span className="mt-0.5 block text-[9.5px] uppercase tracking-wider text-muted-foreground">day{streak === 1 ? '' : 's'}</span>
        </button>
      </div>

      <div className="relative mt-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-primary"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> {pct}% of daily goal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> {subjectsActive} subject{subjectsActive === 1 ? '' : 's'} today
          </span>
        </div>
      </div>
    </section>
  );
}
