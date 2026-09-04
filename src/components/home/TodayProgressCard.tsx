import { useState } from 'react';
import { Flame, Target, TrendingUp, Pencil, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  minutesToday: number;
  goalMinutes: number;
  onGoalChange?: (minutes: number) => void;
  streak: number;
  subjectsActive: number;
}

const fmt = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim());

const PRESETS = [30, 60, 90, 120, 180, 240];

/** Encouraging line based on how far along the day's target the user is. */
function motivation(pct: number, remaining: number, streak: number) {
  if (remaining === 0) {
    return streak > 0
      ? `Target smashed · ${streak}-day streak stays alive. Every extra minute is a bonus.`
      : 'Target smashed · your streak starts today. Keep the momentum going!';
  }
  if (pct === 0) return `${fmt(remaining)} to go · one session is all it takes to get moving.`;
  if (pct < 25) return `${fmt(remaining)} to go · you've started, that's the hardest part.`;
  if (pct < 50) return `${fmt(remaining)} to go · warming up nicely, keep the clock running.`;
  if (pct < 75) return `${fmt(remaining)} to go · past halfway. Don't stop now.`;
  if (pct < 100) return `Only ${fmt(remaining)} left · you're so close, finish strong!`;
  return `${fmt(remaining)} to go`;
}

/** Personal dashboard hero: today's time versus the editable daily study target. */
export function TodayProgressCard({ minutesToday, goalMinutes, onGoalChange, streak, subjectsActive }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goalMinutes));

  const pct = goalMinutes > 0 ? Math.min(100, Math.round((minutesToday / goalMinutes) * 100)) : 0;
  const remaining = Math.max(0, goalMinutes - minutesToday);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n > 0) onGoalChange?.(n);
    setEditing(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/50 bg-gradient-to-br from-primary/12 via-background to-accent/10 p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'hsl(var(--primary) / 0.25)' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">Studied today</p>
          <p className="mt-1 font-display text-[38px] leading-none font-bold tracking-tight tabular-nums">
            {fmt(minutesToday)}
          </p>
        </div>
        {onGoalChange && !editing && (
          <button
            onClick={() => { setDraft(String(goalMinutes)); setEditing(true); }}
            className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground"
            aria-label="Edit daily study target"
          >
            <Target className="h-3.5 w-3.5 text-primary" /> {fmt(goalMinutes)} <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="relative mt-3 rounded-2xl border border-border/50 bg-background/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Daily study target</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setDraft(String(p))}
                className={`press rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
                  Number(draft) === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground'
                }`}
              >
                {fmt(p)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commit()}
              className="h-9 w-24 rounded-xl border border-border/60 bg-background px-3 text-[13px] tabular-nums outline-none focus:border-primary"
              aria-label="Target minutes"
            />
            <span className="text-[12px] text-muted-foreground">minutes</span>
            <button
              onClick={commit}
              className="press ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="press text-[12px] text-muted-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="relative mt-2 inline-flex items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground">
          <Flame className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${remaining === 0 ? 'text-destructive' : 'text-primary'}`} />
          <span>{motivation(pct, remaining, streak)}</span>
        </p>
      )}

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
            <Target className="h-3.5 w-3.5" /> {pct}% of {fmt(goalMinutes)} target
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> {subjectsActive} subject{subjectsActive === 1 ? '' : 's'} today
          </span>
        </div>
      </div>
    </section>
  );
}
