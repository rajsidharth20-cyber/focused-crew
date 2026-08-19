import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { StudyTag } from '@/hooks/use-study-store';
import type { Subject } from '@/hooks/use-planner-store';

interface Props {
  tags: StudyTag[];
  subjects: Subject[];
  onSave: (input: {
    tagId: string | null;
    subjectId: string | null;
    topic: string;
    durationSeconds: number;
    startedAt: string;
    endedAt: string;
    notes: string | null;
  }) => void;
}

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ManualSessionDialog({ tags, subjects, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [startedAt, setStartedAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (minutes <= 0) return;
    const startDate = new Date(startedAt);
    const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
    onSave({
      tagId: tagId || null,
      subjectId: subjectId || null,
      topic: topic.trim() || 'Manual entry',
      durationSeconds: minutes * 60,
      startedAt: startDate.toISOString(),
      endedAt: endDate.toISOString(),
      notes: notes.trim() || null,
    });
    setOpen(false);
    setTopic(''); setNotes(''); setMinutes(30);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold shadow-md hover:opacity-90 transition"
          aria-label="Add missed session"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline sm:inline">Add session</span>
          <span className="xs:hidden sm:hidden">Add</span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/40 max-w-md max-h-[88vh] overflow-y-auto rounded-[28px] p-5">
        <DialogHeader className="text-left">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Plus className="h-4.5 w-4.5" />
            </span>
            <div>
              <DialogTitle className="text-[16px]">Add a missed session</DialogTitle>
              <p className="text-[11.5px] text-muted-foreground">Log study time you forgot to track.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="flex flex-wrap gap-1.5">
            {[15, 25, 30, 45, 60, 90].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`press rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                  minutes === m
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What did you study?" className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tag</label>
              <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">—</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Subject</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">—</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Started at</label>
              <input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Minutes</label>
              <input type="number" min={1} value={minutes} onChange={e => setMinutes(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50 tabular-nums" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-background/70 border border-border/60 rounded-xl px-3 py-2.5 text-sm mt-1.5 outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
        <DialogFooter className="mt-1 gap-2 sm:justify-between">
          <button onClick={() => setOpen(false)} className="press rounded-xl border border-border/60 px-4 py-2.5 text-sm hover:bg-secondary transition">Cancel</button>
          <button onClick={submit} className="press inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md">
            <Plus className="w-4 h-4" />Save session
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
