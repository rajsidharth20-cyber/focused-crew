import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlarmClock } from 'lucide-react';

type Resolver = (value: number | null) => void;

let externalOpen: ((r: Resolver) => void) | null = null;

/** Imperatively prompt for a delay. Resolves with minutes (>=0) or null if skipped/cancelled. */
export function promptDelay(): Promise<number | null> {
  return new Promise(resolve => {
    if (externalOpen) externalOpen(resolve);
    else resolve(null);
  });
}

export function DelayPromptHost() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>('');
  const resolverRef = useRef<Resolver | null>(null);

  useEffect(() => {
    externalOpen = (r) => {
      resolverRef.current = r;
      setValue('');
      setOpen(true);
    };
    return () => { externalOpen = null; };
  }, []);

  const finish = (v: number | null) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (r) r(v);
  };

  const submit = () => {
    if (value.trim() === '') { finish(0); return; }
    const n = Number(value);
    finish(Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="glass-card border-border/40 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-accent" />
            Any delay before starting?
          </DialogTitle>
          <DialogDescription>
            How many minutes late are you compared to when you planned to start? Leave blank if on time.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Delay (minutes)</label>
          <input
            autoFocus
            type="number"
            min={0}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="0"
            className="w-full mt-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            Tracking delay helps you see where your time actually goes.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={() => finish(null)}
            className="px-3 py-2 text-xs rounded-md border border-border/60 hover:bg-secondary transition"
          >
            Skip
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold"
          >
            Start timer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
