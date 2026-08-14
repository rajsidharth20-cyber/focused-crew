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

const fmtShort = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return `${Math.floor(total)}s`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface Props {
  subjects: Subject[];
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

/** Compact subject cards — deliberately not a row-of-big-play-buttons list. */
export function SubjectBoard({
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
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">My subjects</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setEditing(v => !v); setRenameId(null); }}
            className="press h-7 rounded-full border border-border/60 px-3 text-[11px] font-medium"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={() => setAdding(v => !v)}
            aria-label="Add subject"
            className="press grid h-7 w-7 place-items-center rounded-full border border-border/60"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pb-1">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAdd()}
                placeholder="New subject"
                className="flex-1 rounded-2xl border border-border/60 bg-secondary/50 px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button onClick={submitAdd} className="press rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground">
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ordered.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-border/70 px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Add a subject to start tracking your study time.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {ordered.map((s, i) => {
            const active = activeSubjectId === s.id;
            const seconds = (totals[s.id] ?? 0) + (active ? liveElapsed : 0);
            const color = s.color || '#6366f1';
            return (
              <motion.div
                key={s.id}
                layout
                className="relative overflow-hidden rounded-[22px] border border-border/50 bg-card/70 p-3.5 backdrop-blur"
                style={active ? { borderColor: color } : undefined}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl"
                  style={{ background: color, opacity: active ? 0.35 : 0.16 }}
                />
                <div className="relative flex items-start justify-between gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  {active && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ background: `${color}22`, color }}>
                      {isRunning ? 'Live' : 'Paused'}
                    </span>
                  )}
                </div>

                {renameId === s.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && renameVal.trim()) { onRename(s.id, renameVal.trim()); setRenameId(null); }
                      if (e.key === 'Escape') setRenameId(null);
                    }}
                    className="mt-2 w-full rounded-lg border border-border/60 bg-secondary/50 px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  <p className="relative mt-2 truncate text-[14.5px] font-semibold leading-tight">{s.name}</p>
                )}

                <div className="relative mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {active && isRunning ? fmtHMS(seconds) : fmtShort(seconds)}
                  </span>
                  <button
                    onClick={() => (active ? (isRunning ? onPause() : onOpenActive()) : onPlay(s.id))}
                    aria-label={active && isRunning ? `Pause ${s.name}` : `Start ${s.name}`}
                    className="press grid h-8 w-8 place-items-center rounded-xl text-white"
                    style={{ background: color }}
                  >
                    {active && isRunning
                      ? <Pause className="h-3.5 w-3.5 fill-white" />
                      : <Play className="h-3.5 w-3.5 translate-x-[1px] fill-white" />}
                  </button>
                </div>

                {editing && (
                  <div className="relative mt-3 space-y-2 border-t border-border/40 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => move(i, -1)} aria-label="Move up" className="press grid h-6 w-6 place-items-center text-muted-foreground">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => move(i, 1)} aria-label="Move down" className="press grid h-6 w-6 place-items-center text-muted-foreground">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => { setRenameId(renameId === s.id ? null : s.id); setRenameVal(s.name); }}
                          aria-label="Rename" className="press grid h-6 w-6 place-items-center text-muted-foreground"
                        >
                          {renameId === s.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
                        </button>
                        <button onClick={() => onDelete(s.id)} aria-label="Delete" className="press grid h-6 w-6 place-items-center text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {SUBJECT_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => onRecolor(s.id, c)}
                          aria-label={`Set colour ${c}`}
                          className="grid h-4 w-4 place-items-center rounded-full"
                          style={{ background: c }}
                        >
                          {color.toLowerCase() === c && <Check className="h-2.5 w-2.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
