import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Clock, Pencil, Check, X, History } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { StudySession, StudyTag } from '@/hooks/use-study-store';
import type { Subject } from '@/hooks/use-planner-store';

interface Props {
  sessions: StudySession[];
  tags: StudyTag[];
  subjects: Subject[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<StudySession, 'tagId' | 'subjectId' | 'topic' | 'notes' | 'delayMinutes'>>) => void;
}

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function SessionList({ sessions, tags, subjects, onRemove, onUpdate }: Props) {
  const recent = sessions.slice(0, 30);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ topic: string; tagId: string; subjectId: string; delayMinutes: string; notes: string }>({ topic: '', tagId: '', subjectId: '', delayMinutes: '', notes: '' });

  const startEdit = (s: StudySession) => {
    setEditingId(s.id);
    setDraft({
      topic: s.topic ?? '',
      tagId: s.tagId ?? '',
      subjectId: s.subjectId ?? '',
      delayMinutes: s.delayMinutes != null ? String(s.delayMinutes) : '',
      notes: s.notes ?? '',
    });
  };
  const saveEdit = () => {
    if (!editingId) return;
    const delayNum = draft.delayMinutes.trim() === '' ? null : Math.max(0, Math.round(Number(draft.delayMinutes)));
    onUpdate(editingId, {
      topic: draft.topic.trim() || null,
      tagId: draft.tagId || null,
      subjectId: draft.subjectId || null,
      delayMinutes: Number.isFinite(delayNum as number) ? delayNum : null,
      notes: draft.notes.trim() || null,
    });
    setEditingId(null);
  };

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-primary/80">Recent sessions</h3>
        <span className="text-[10px] text-muted-foreground">{sessions.length} total</span>
      </div>
      {recent.length === 0 ? (
        <EmptyState compact icon={History} title="No sessions yet" hint="Start a timer and your focus sessions will show up here." />
      ) : (

        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {recent.map(s => {
              const tag = tags.find(t => t.id === s.tagId);
              const subject = subjects.find(sub => sub.id === s.subjectId);
              const isEditing = editingId === s.id;
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-2.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={draft.topic}
                        onChange={e => setDraft(d => ({ ...d, topic: e.target.value }))}
                        placeholder="Topic"
                        className="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={draft.tagId}
                          onChange={e => setDraft(d => ({ ...d, tagId: e.target.value }))}
                          className="bg-background border border-border/60 rounded px-2 py-1.5 text-xs"
                        >
                          <option value="">— No tag —</option>
                          {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select
                          value={draft.subjectId}
                          onChange={e => setDraft(d => ({ ...d, subjectId: e.target.value }))}
                          className="bg-background border border-border/60 rounded px-2 py-1.5 text-xs"
                        >
                          <option value="">— No subject —</option>
                          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Delay (min late)</label>
                        <input
                          type="number"
                          min={0}
                          value={draft.delayMinutes}
                          onChange={e => setDraft(d => ({ ...d, delayMinutes: e.target.value }))}
                          placeholder="e.g. 15"
                          className="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-xs tabular-nums mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Session notes</label>
                        <textarea
                          value={draft.notes}
                          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                          rows={3}
                          placeholder="What did you cover?"
                          className="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-xs mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded hover:bg-secondary text-muted-foreground inline-flex items-center gap-1">
                          <X className="w-3 h-3" />Cancel
                        </button>
                        <button onClick={saveEdit} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag?.color ?? 'hsl(var(--muted-foreground))' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.topic || 'Untitled session'}</div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
                          <span className="capitalize">{s.type}</span>
                          <span>· {tag ? tag.name : 'no tag'}</span>
                          <span>· {subject ? subject.name : 'no subject'}</span>
                          <span>· {fmtWhen(s.startedAt)} → {fmtTime(s.endedAt)}</span>
                          {s.delayMinutes != null && s.delayMinutes > 0 && (
                            <span className="text-amber-400">· {s.delayMinutes}m late</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-primary inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />{fmtDur(s.durationSeconds)}
                      </div>
                      <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" aria-label="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onRemove(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {!isEditing && s.notes && (
                    <p className="mt-2 pl-5 border-l-2 border-primary/30 text-[11px] text-muted-foreground whitespace-pre-wrap">
                      {s.notes}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
