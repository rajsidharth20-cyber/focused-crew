import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { NotebookPen } from 'lucide-react';
import type { StudySession } from '@/hooks/use-study-store';

interface Props {
  session: StudySession | null;
  onClose: () => void;
  onSave: (id: string, notes: string | null) => void;
}

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Asked right after a session ends so the reflection lands in history. */
export function SessionNotesDialog({ session, onClose, onSave }: Props) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(session?.notes ?? '');
  }, [session]);

  const save = () => {
    if (!session) return;
    onSave(session.id, notes.trim() || null);
    onClose();
  };

  return (
    <Dialog open={!!session} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-card border-border/40 max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-primary" />
            How did it go?
          </DialogTitle>
          <DialogDescription>
            {session
              ? `${fmtDur(session.durationSeconds)} logged${session.topic ? ` · ${session.topic}` : ''}. Notes are saved to your session history and stay editable.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          autoFocus
          placeholder="What did you cover? What was hard? What's next?"
          className="w-full bg-background border border-border/60 rounded-xl px-3 py-2.5 text-sm"
        />
        <DialogFooter className="gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border/60 text-sm hover:bg-secondary transition">
            Skip
          </button>
          <button onClick={save} className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold">
            Save note
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
