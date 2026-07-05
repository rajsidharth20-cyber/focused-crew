import { Compass, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DailyObjective, Subject } from '@/hooks/use-planner-store';

interface Props {
  subjects: Subject[];
  objectives: DailyObjective[];
  onToggle: (id: string) => void;
}

export function StudyObjectivesPanel({ subjects, objectives, onToggle }: Props) {
  const getSubject = (id: string) => subjects.find(s => s.id === id)?.name ?? '';
  const done = objectives.filter(o => o.completed).length;
  const total = objectives.length;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-primary/80">Today's objectives</h3>
        </div>
        {total > 0 && <span className="text-[10px] text-muted-foreground">{done}/{total} done</span>}
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">No objectives set for today. Add them from the dashboard.</p>
      ) : (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {objectives.map(o => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-2 rounded-lg border border-border/40 bg-secondary/30"
              >
                <button
                  onClick={() => onToggle(o.id)}
                  className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${o.completed ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                >
                  {o.completed && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm truncate ${o.completed ? 'line-through text-muted-foreground' : ''}`}>{o.task}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {getSubject(o.subjectId)} · {o.estimatedMinutes}min
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
