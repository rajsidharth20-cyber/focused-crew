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

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function DelayPromptHost() {
  const [open, setOpen] = useState(false);
  const [scheduled, setScheduled] = useState<string>('');
  const [manual, setManual] = useState<string>('');
  const resolverRef = useRef<Resolver | null>(null);

  useEffect(() => {
    externalOpen = (r) => {
      resolverRef.current = r;
      setScheduled('');
      setManual('');
      setOpen(true);
    };
    return () => { externalOpen = null; };
  }, []);

  const computedFromSchedule = (): number | null => {
    if (!scheduled) return null;
    const [hh, mm] = scheduled.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const now = new Date();
    const sched = new Date(now);
    sched.setHours(hh, mm, 0, 0);
    // If scheduled time is in the future today, assume it was yesterday
    let diff = (now.getTime() - sched.getTime()) / 60000;
    if (diff < -60) diff += 24 * 60;
    return Math.max(0, Math.round(diff));
  };

  const resolveValue = (): number => {
    if (manual.trim() !== '') {
      const n = Number(manual);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    }
    const c = computedFromSchedule();
    return c ?? 0;
  };

  const finish = (v: number | null) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (r) r(v);
  };

  const preview = manual.trim() !== '' ? Number(manual) || 0 : computedFromSchedule();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="glass-card border-border/40 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-accent" />
            Any delay before starting?
          </DialogTitle>
          <DialogDescription>
            Enter the scheduled start time OR type the delay directly. Whatever you fill will be tracked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Scheduled start (HH:MM)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="time"
                value={scheduled}
                onChange={e => setScheduled(e.target.value)}
                className="flex-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm tabular-nums"
              />
              <button
                type="button"
                onClick={() => setScheduled(nowHHMM())}
                className="text-[11px] px-2 rounded-md border border-border/60 hover:bg-secondary"
              >
                Now
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Delay auto-computed from now − scheduled.</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Or enter delay directly (minutes)</label>
            <input
              type="number"
              min={0}
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') finish(resolveValue()); }}
              placeholder="0"
              className="w-full mt-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm tabular-nums"
            />
          </div>
          {preview != null && (
            <div className="text-xs text-muted-foreground">
              Delay to log: <span className="font-semibold text-foreground">{Math.max(0, Math.round(preview))} min</span>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={() => finish(0)}
            className="px-3 py-2 text-xs rounded-md border border-border/60 hover:bg-secondary transition"
          >
            On time
          </button>
          <button
            onClick={() => finish(resolveValue())}
            className="px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold"
          >
            Start timer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
