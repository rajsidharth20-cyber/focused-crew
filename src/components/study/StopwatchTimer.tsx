import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { promptDelay } from './DelayPromptDialog';

interface Props {
  onSave: (durationSec: number, startedAt: string, endedAt: string, delayMinutes: number | null) => void;
}

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = r.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export function StopwatchTimer({ onSave }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (startRef.current != null) setElapsed(baseRef.current + (Date.now() - startRef.current) / 1000);
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  const toggle = async () => {
    if (running) {
      baseRef.current = elapsed;
      startRef.current = null;
      setRunning(false);
    } else {
      // Fresh start (not resume) — ask about delay
      if (elapsed === 0 && startedAtRef.current === null) {
        const d = await promptDelay();
        delayRef.current = d;
      }
      startRef.current = Date.now();
      if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
      setRunning(true);
    }
  };

  const stop = () => {
    const finalSec = Math.floor(elapsed);
    if (finalSec < 5) {
      reset();
      return;
    }
    const startedAt = startedAtRef.current || new Date(Date.now() - finalSec * 1000).toISOString();
    const endedAt = new Date().toISOString();
    onSave(finalSec, startedAt, endedAt, delayRef.current);
    reset();
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
    startRef.current = null;
    startedAtRef.current = null;
    delayRef.current = null;
  };

  return (
    <div className="glass-card p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-display text-accent/80">Stopwatch</div>
          <div className="text-lg font-bold">Open Focus</div>
        </div>
        <div className={`text-xs tabular-nums ${running ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}>
          {running ? '● Recording' : '○ Idle'}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 py-8">
        <motion.div
          key={running ? 'run' : 'stop'}
          animate={{ scale: running ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="font-display text-6xl sm:text-7xl font-bold tabular-nums text-gradient tracking-tight"
        >
          {fmt(elapsed)}
        </motion.div>
        <div className="text-xs text-muted-foreground">Free-form study session</div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-secondary transition" aria-label="Reset">
          <RotateCcw className="w-4 h-4" />
        </button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={toggle}
          className="px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-2 shadow-lg"
        >
          {running ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Start</>}
        </motion.button>
        <button
          onClick={stop}
          disabled={elapsed < 5}
          className="px-4 py-2 rounded-lg border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition disabled:opacity-40"
          aria-label="Save"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
