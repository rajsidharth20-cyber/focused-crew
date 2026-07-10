import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Play, Check, X, Timer, ArrowRight, Zap } from 'lucide-react';
import type { DailyObjective, Subject, Priority } from '@/hooks/use-planner-store';

interface Props {
  subjects: Subject[];
  objectives: DailyObjective[];
  onToggle: (id: string) => void;
  active: boolean;
  onExit: () => void;
}

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function pickNext(objectives: DailyObjective[], skipped: Set<string>): DailyObjective | null {
  const pool = objectives.filter(o => !o.completed && !skipped.has(o.id));
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    if (p !== 0) return p;
    const da = a.deadline ?? '9999-12-31';
    const db = b.deadline ?? '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
  })[0];
}

export function JustTellMeMode({ subjects, objectives, onToggle, active, onExit }: Props) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const next = useMemo(() => pickNext(objectives, skipped), [objectives, skipped]);
  const totalRemaining = objectives.filter(o => !o.completed).length;

  if (!active) return null;

  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? 'General';

  return (
    <section className="glass-card glow-sky p-6 sm:p-8 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-display text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3" /> Just tell me what to do
        </div>
        <button onClick={onExit} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary">
          <X className="w-3.5 h-3.5" /> Exit
        </button>
      </div>

      {!next ? (
        <div className="text-center py-10 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Check className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold">All clear.</h3>
          <p className="text-sm text-muted-foreground">
            {objectives.length === 0
              ? 'Add a daily objective first — then I\'ll pick one for you.'
              : 'Every task is done. Rest, or add another one.'}
          </p>
          {skipped.size > 0 && (
            <button onClick={() => setSkipped(new Set())} className="text-xs text-primary hover:underline">
              Reset skipped ({skipped.size})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Do this next</div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{next.task}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-secondary text-foreground/80">{subjectName(next.subjectId)}</span>
              <span className={`px-2 py-1 rounded-md ${next.priority === 'high' ? 'bg-destructive/15 text-destructive' : next.priority === 'medium' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                {next.priority} priority
              </span>
              {next.deadline && <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground">by {next.deadline}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-y border-border/40">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Estimated</div>
              <div className="text-xl font-bold tabular-nums">{next.estimatedMinutes || 25}<span className="text-sm text-muted-foreground font-medium ml-1">min</span></div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Remaining</div>
              <div className="text-xl font-bold tabular-nums">{totalRemaining}</div>
            </div>
          </div>

          <Link
            to="/study"
            className="w-full inline-flex items-center justify-center gap-2 text-base font-bold px-6 py-4 rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg hover:opacity-95 transition"
          >
            <Play className="w-5 h-5 fill-current" /> Start now
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggle(next.id)}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition"
            >
              <Check className="w-4 h-4" /> Done, next
            </button>
            <button
              onClick={() => setSkipped(prev => { const n = new Set(prev); n.add(next.id); return n; })}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              Skip <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function JustTellMeToggle({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition ${active ? 'bg-primary text-primary-foreground border-primary shadow' : 'border-primary/40 text-primary hover:bg-primary/10'}`}
      aria-pressed={active}
    >
      <Zap className="w-3.5 h-3.5" />
      <span>{active ? 'Exit focus mode' : 'Just tell me what to do'}</span>
    </button>
  );
}
