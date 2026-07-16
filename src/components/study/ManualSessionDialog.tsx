import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
    delayMinutes: number | null;
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
  const [minutes, setMinutes] = useState<number>(30);
  const [startedAt, setStartedAt] = useState<string>(nowLocalInput());
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [delayMin, setDelayMin] = useState<string>('');
  const [notes, setNotes] = useState('');

  const resolveDelay = (): number | null => {
    if (delayMin.trim() !== '') {
      const n = Number(delayMin);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
    }
    if (scheduledAt && startedAt) {
      const diff = (new Date(startedAt).getTime() - new Date(scheduledAt).getTime()) / 60000;
      if (Number.isFinite(diff)) return Math.max(0, Math.round(diff));
    }
    return null;
  };

  const reset = () => {
    setTopic(''); setNotes(''); setMinutes(30);
    setStartedAt(nowLocalInput()); setScheduledAt(''); setDelayMin('');
    setTagId(''); setSubjectId('');
  };

  const submit = () => {
    if (!minutes || minutes <= 0) return;
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
      delayMinutes: resolveDelay(),
    });
    setOpen(false);
    reset();
  };

  const computedDelay = resolveDelay();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setStartedAt(nowLocalInput()); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border/60 hover:bg-secondary transition">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline sm:inline">Add missed session</span>
          <span className="xs:hidden sm:hidden">Add</span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/40 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a study session</DialogTitle>
          <DialogDescription>Record a session you already completed. Include delay if you started later than planned.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What did you study?" className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tag</label>
              <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Actual start</label>
              <input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration (min)</label>
              <input type="number" min={1} value={minutes} onChange={e => setMinutes(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1 tabular-nums" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Scheduled start</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Optional — used to auto-compute delay.</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Delay (min)</label>
              <input type="number" min={0} value={delayMin} onChange={e => setDelayMin(e.target.value)} placeholder={computedDelay != null && delayMin === '' ? `${computedDelay}` : '0'} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1 tabular-nums" />
              <p className="text-[10px] text-muted-foreground mt-1">Overrides the computed delay.</p>
            </div>
          </div>
          {computedDelay != null && (
            <div className="text-xs text-muted-foreground">
              Delay tracked: <span className="font-semibold text-foreground">{computedDelay} min</span>
            </div>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-background border border-border/60 rounded-md px-3 py-2 text-sm mt-1" />
          </div>
        </div>
        <DialogFooter>
          <button onClick={submit} className="px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold">Save session</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
