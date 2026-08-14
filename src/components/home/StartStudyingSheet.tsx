import { useState } from 'react';
import { Plus, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Subject } from '@/hooks/use-planner-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  onStart: (subjectId: string) => void;
  onCreate: (name: string) => Promise<string | void> | string | void;
}

/** Pick an existing subject or create one, then start the timer immediately. */
export function StartStudyingSheet({ open, onOpenChange, subjects, onStart, onCreate }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const id = await onCreate(name.trim());
    setName('');
    setBusy(false);
    if (typeof id === 'string' && id) onStart(id);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-base">What are you studying?</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {subjects.length === 0 && (
            <p className="py-2 text-[12.5px] text-muted-foreground">No subjects yet — create your first one below.</p>
          )}
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => onStart(s.id)}
              className="press flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-3.5 py-3 text-left"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color || '#6366f1' }} />
              <span className="flex-1 truncate text-[14px] font-medium">{s.name}</span>
              <Play className="h-3.5 w-3.5 fill-current text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="New subject"
            className="flex-1 rounded-2xl border border-border/60 bg-secondary/50 px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={create}
            aria-label="Create and start"
            className="press grid w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
