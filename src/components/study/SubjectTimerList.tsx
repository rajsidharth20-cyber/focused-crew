import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Plus, ChevronUp, ChevronDown, Trash2, Check, X, Pencil } from 'lucide-react';
import { SUBJECT_COLORS, type Subject } from '@/hooks/use-planner-store';

export const fmtHMS = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

interface Props {
  subjects: Subject[];
  /** Seconds already logged today, keyed by subject id. */
  totals: Record<string, number>;
  activeSubjectId: string | null;
  isRunning: boolean;
  liveElapsed: number;
  onPlay: (subjectId: string) => void;
  onPause: () => void;
  onOpenActive: () => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onReorder: (ordered: Subject[]) => void;
  onDelete: (id: string) => void;
}

export function SubjectTimerList({
  subjects, totals, activeSubjectId, isRunning, liveElapsed,
  onPlay, onPause, onOpenActive, onAdd, onRename, onRecolor, onReorder, onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const ordered = useMemo(
    () => [...subjects].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [subjects],
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = [...ordered];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  };

  const submitAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    setAdding(false);
  };

  return (
    <section className="glass-card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h2 className="text-[13px] font-semibold tracking-tight">Subjects</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditing(v => !v); setRenameId(null); }}
            className="press h-7 px-2.5 rounded-full border border-border/60 text-[11px] font-medium"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => setAdding(v => !v)}
            aria-label="Add subject"
            className="press h-7 w-7 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/40"
          >
            <div className="flex gap-2 p-3">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAdd()}
                placeholder="Subject name"
                className="flex-1 bg-secondary/50 border border-border/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button onClick={submitAdd} className="press px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="divide-y divide-border/30">
        {ordered.length === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Add your first subject to start tracking study time.
          </li>
        )}
        {ordered.map((s, i) => {
          const active = activeSubjectId === s.id;
          const seconds = (totals[s.id] ?? 0) + (active ? liveElapsed : 0);
          const color = s.color || '#6366f1';
          return (
            <li key={s.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (active ? (isRunning ? onPause() : onOpenActive()) : onPlay(s.id))}
                  aria-label={active && isRunning ? `Pause ${s.name}` : `Start ${s.name}`}
                  className="press relative h-11 w-11 rounded-full grid place-items-center shrink-0"
                  style={{ background: color }}
                >
                  {active && isRunning
                    ? <Pause className="w-4 h-4 text-white fill-white" />
                    : <Play className="w-4 h-4 text-white fill-white translate-x-[1px]" />}
                  {active && isRunning && (
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.25 }} />
                  )}
                </button>

                <button
                  onClick={() => (active ? onOpenActive() : undefined)}
                  className="flex-1 min-w-0 text-left"
                >
                  {renameId === s.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameVal.trim()) { onRename(s.id, renameVal.trim()); setRenameId(null); }
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      className="w-full bg-secondary/50 border border-border/60 rounded-lg px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <>
                      <span className="block text-[15px] font-medium truncate leading-tight">{s.name}</span>
                      {active && (
                        <span className="block text-[11px] mt-0.5" style={{ color }}>
                          {isRunning ? 'Studying now' : 'Paused'}
                        </span>
                      )}
                    </>
                  )}
                </button>

                <span className={`text-[15px] tabular-nums ${active ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {fmtHMS(seconds)}
                </span>

                {editing && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => move(i, -1)} aria-label="Move up" className="press h-7 w-7 grid place-items-center text-muted-foreground">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => move(i, 1)} aria-label="Move down" className="press h-7 w-7 grid place-items-center text-muted-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setRenameId(renameId === s.id ? null : s.id); setRenameVal(s.name); }}
                      aria-label="Rename" className="press h-7 w-7 grid place-items-center text-muted-foreground"
                    >
                      {renameId === s.id ? <X className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => onDelete(s.id)} aria-label="Delete" className="press h-7 w-7 grid place-items-center text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {editing && (
                <div className="flex flex-wrap gap-1.5 pl-14 pt-2">
                  {SUBJECT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => onRecolor(s.id, c)}
                      aria-label={`Set colour ${c}`}
                      className="h-5 w-5 rounded-full grid place-items-center"
                      style={{ background: c }}
                    >
                      {color.toLowerCase() === c && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
