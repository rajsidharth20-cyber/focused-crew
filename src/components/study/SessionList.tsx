import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock } from 'lucide-react';
import type { StudySession, StudyTag } from '@/hooks/use-study-store';
import type { Subject } from '@/hooks/use-planner-store';

interface Props {
  sessions: StudySession[];
  tags: StudyTag[];
  subjects: Subject[];
  onRemove: (id: string) => void;
}

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function SessionList({ sessions, tags, subjects, onRemove }: Props) {
  const recent = sessions.slice(0, 30);
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-primary/80">Recent sessions</h3>
        <span className="text-[10px] text-muted-foreground">{sessions.length} total</span>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No sessions logged yet. Start a timer above.</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {recent.map(s => {
              const tag = tags.find(t => t.id === s.tagId);
              const subject = subjects.find(sub => sub.id === s.subjectId);
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag?.color ?? 'hsl(var(--muted-foreground))' }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.topic || 'Untitled session'}</div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
                      <span className="capitalize">{s.type}</span>
                      {tag && <span>· {tag.name}</span>}
                      {subject && <span>· {subject.name}</span>}
                      <span>· {fmtWhen(s.startedAt)}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-primary inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />{fmtDur(s.durationSeconds)}
                  </div>
                  <button onClick={() => onRemove(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
