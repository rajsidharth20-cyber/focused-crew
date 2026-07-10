import { useState } from 'react';
import { Flame, Settings2, Heart, Check } from 'lucide-react';
import { useStreak } from '@/hooks/use-streak';
import type { StudySession } from '@/hooks/use-study-store';

interface Props {
  sessions: StudySession[];
}

export function StreakCard({ sessions }: Props) {
  const s = useStreak(sessions);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(s.thresholdMinutes);

  const pct = Math.min(100, (s.todayMinutes / s.thresholdMinutes) * 100);
  const remaining = Math.max(0, s.thresholdMinutes - s.todayMinutes);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${s.streak > 0 ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-muted/40 border-border text-muted-foreground'}`}>
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-display text-muted-foreground">Study streak</div>
            <div className="text-2xl font-bold tabular-nums leading-tight">
              {s.streak} <span className="text-sm text-muted-foreground font-medium">day{s.streak === 1 ? '' : 's'}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {s.metToday ? 'Goal hit today ✓' : `${remaining}m to keep the streak alive`}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setEditing(v => !v); setVal(s.thresholdMinutes); }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          aria-label="Configure streak"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Today: <span className="text-foreground font-semibold tabular-nums">{s.todayMinutes}m</span></span>
        <span>Goal: <span className="text-foreground font-semibold tabular-nums">{s.thresholdMinutes}m</span></span>
      </div>

      {editing && (
        <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-background/40">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Minimum study time per day to count</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={val}
              onChange={e => setVal(Number(e.target.value))}
              className="w-24 bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
            <button
              onClick={() => { s.setThreshold(val); setEditing(false); }}
              className="ml-auto inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gradient-primary text-primary-foreground"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[15, 30, 45, 60, 90, 120].map(m => (
              <button
                key={m}
                onClick={() => setVal(m)}
                className={`text-[11px] px-2 py-1 rounded-md border ${val === m ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-border/40">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-destructive" /> Streak freezes</span>
          <span className="tabular-nums">{s.restoresLeft} of 2 left</span>
        </div>
        {s.missedRecent.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No recent missed days to restore.</p>
        ) : (
          <div className="space-y-1.5">
            {s.missedRecent.map(d => (
              <button
                key={d}
                disabled={s.restoresLeft === 0}
                onClick={() => s.restore(d)}
                className="w-full text-xs px-3 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span>Restore {d === s.yesterday ? 'yesterday' : d}</span>
                <span className="text-[10px] uppercase tracking-widest">Use freeze</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
