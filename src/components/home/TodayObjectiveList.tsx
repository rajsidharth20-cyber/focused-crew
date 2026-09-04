import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ListChecks, Pencil, Repeat, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DailyObjective, Subject } from '@/hooks/use-planner-store';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  subjects: Subject[];
  objectives: DailyObjective[];
  onToggle: (id: string) => void;
  /** Cancels the objective for today only (recurring series stay intact). */
  onCancelToday?: (id: string) => void;
}

const priorityTint: Record<string, string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/60',
};

/** Read-only view of today's objectives. Adding & editing happens in the Planner. */
export function TodayObjectiveList({ subjects, objectives, onToggle, onCancelToday }: Props) {
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? '';
  const done = objectives.filter(o => o.completed).length;
  const total = objectives.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [pending, setPending] = useState<DailyObjective | null>(null);

  return (
    <section className="rounded-[24px] border border-border/50 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="font-display text-[13px] font-bold uppercase tracking-widest text-primary/80">
            Today's objectives
          </h2>
        </div>
        <Link
          to="/planner"
          className="press inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-primary"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{done}/{total} done · {pct}%</p>
        </div>
      )}

      {total === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-5 text-center">
          <p className="text-[13px] font-medium">No objectives yet for today</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">Plan your day in the Planner tab.</p>
          <Link
            to="/planner"
            className="press mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground"
          >
            Open planner <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {objectives.map(o => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary/30 p-2.5"
              >
                <button
                  onClick={() => onToggle(o.id)}
                  aria-label={o.completed ? 'Mark as not done' : 'Mark as done'}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    o.completed ? 'border-primary bg-primary' : 'border-muted-foreground/60'
                  }`}
                >
                  {o.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13.5px] ${o.completed ? 'text-muted-foreground line-through' : ''}`}>
                    {o.task}
                  </div>
                  <div className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
                    {o.templateId && <Repeat className="h-2.5 w-2.5 shrink-0" aria-label="Recurring" />}
                    <span className="truncate">
                      {[subjectName(o.subjectId), `${o.estimatedMinutes}m`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${priorityTint[o.priority] ?? priorityTint.low}`} />
                {onCancelToday && (
                  <button
                    onClick={() => setPending(o)}
                    aria-label={`Cancel "${o.task}" for today`}
                    className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={v => !v && setPending(null)}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel for today?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.templateId
                ? <>“{pending?.task}” will be removed from today only. It keeps repeating on its usual days.</>
                : <>“{pending?.task}” will be removed from today's list.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (pending) onCancelToday?.(pending.id); setPending(null); }}
            >
              Cancel for today
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
