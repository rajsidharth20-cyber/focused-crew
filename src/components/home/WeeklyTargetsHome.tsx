import { Link } from 'react-router-dom';
import { Check, ChevronRight, Map } from 'lucide-react';
import type { Subject, WeeklyTarget } from '@/hooks/use-planner-store';
import { getEffectiveToday } from '@/lib/day-boundary';

interface Props {
  subjects: Subject[];
  targets: WeeklyTarget[];
  onToggle: (id: string) => void;
}

const fmtDeadline = (iso: string, today: string) => {
  const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `${diff}d left`;
};

/** Compact read-only view of this week's targets; editing lives in the Planner. */
export function WeeklyTargetsHome({ subjects, targets, onToggle }: Props) {
  if (targets.length === 0) return null;
  const today = getEffectiveToday();
  const done = targets.filter(t => t.completed).length;
  const sorted = [...targets].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
  });

  return (
    <section className="rounded-[24px] border border-border/50 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          <h2 className="font-display text-[13px] font-bold uppercase tracking-widest text-primary/80">
            Weekly targets
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">{done}/{targets.length}</span>
        </div>
        <Link to="/planner" className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
          Edit <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {sorted.slice(0, 5).map(t => {
          const subject = subjects.find(s => s.id === t.subjectId);
          const overdue = !!t.deadline && t.deadline < today && !t.completed;
          return (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary/30 px-3 py-2">
              <button
                onClick={() => onToggle(t.id)}
                aria-label={t.completed ? 'Mark target incomplete' : 'Mark target complete'}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                  t.completed ? 'border-primary bg-primary' : 'border-muted-foreground/60 hover:border-primary'
                }`}
              >
                {t.completed && <Check className="h-3 w-3 text-primary-foreground" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] ${t.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {t.target}
                </p>
                <p className="truncate text-[10.5px] text-muted-foreground">
                  {subject && (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: subject.color }} />
                      {subject.name}
                    </span>
                  )}
                  {t.deadline && (
                    <span className={`${subject ? 'ml-2 ' : ''}${overdue ? 'font-semibold text-destructive' : ''}`}>
                      {fmtDeadline(t.deadline, today)}
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {targets.length > 5 && (
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">+{targets.length - 5} more in the Planner</p>
      )}
    </section>
  );
}
