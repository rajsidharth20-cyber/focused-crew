import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { promptDelay } from './DelayPromptDialog';
import { useBroadcastStudyPresence } from '@/hooks/use-study-presence';

interface Props {
  onSave: (durationSec: number, startedAt: string, endedAt: string, delayMinutes: number | null) => void;
  /** 'hero' renders the immersive full-screen presentation (same logic). */
  variant?: 'card' | 'hero';
  /** Task / subject lines shown under the time in hero mode. */
  contextLines?: (string | null | undefined)[];
  onRunningChange?: (running: boolean) => void;
}

const STORAGE_KEY = 'taskpilot_active_stopwatch_v1';

interface Persisted {
  startedAtWall: string;      // when the whole session began
  baseSeconds: number;         // elapsed accumulated before current run segment
  segmentStart: number | null; // Date.now() when current running segment started, or null if paused
  delayMinutes: number | null;
}

const readPersisted = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writePersisted = (p: Persisted | null) => {
  if (p === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
};

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = r.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export function StopwatchTimer({ onSave, variant = 'card', contextLines = [], onRunningChange }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const stateRef = useRef<Persisted | null>(null);
  useEffect(() => { onRunningChange?.(running); }, [running, onRunningChange]);

  useBroadcastStudyPresence(running, 'stopwatch', null, stateRef.current?.startedAtWall ?? null);

  const computeElapsed = useCallback((p: Persisted): number => {
    if (p.segmentStart != null) return p.baseSeconds + (Date.now() - p.segmentStart) / 1000;
    return p.baseSeconds;
  }, []);

  // Restore on mount
  useEffect(() => {
    const p = readPersisted();
    if (p) {
      stateRef.current = p;
      setElapsed(computeElapsed(p));
      setRunning(p.segmentStart != null);
    }
  }, [computeElapsed]);

  // Live tick — recomputes from wall clock so tab-throttling / device sleep is corrected on return
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const p = stateRef.current;
      if (p) setElapsed(computeElapsed(p));
    };
    tick();
    const id = setInterval(tick, 500);
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [running, computeElapsed]);

  const toggle = async () => {
    const now = Date.now();
    if (running) {
      // Pause
      const p = stateRef.current;
      if (p) {
        const newBase = computeElapsed(p);
        const updated: Persisted = { ...p, baseSeconds: newBase, segmentStart: null };
        stateRef.current = updated;
        writePersisted(updated);
        setElapsed(newBase);
      }
      setRunning(false);
    } else {
      let p = stateRef.current;
      if (!p) {
        // Fresh session — ask about delay
        const d = await promptDelay();
        p = {
          startedAtWall: new Date(now).toISOString(),
          baseSeconds: 0,
          segmentStart: now,
          delayMinutes: d,
        };
      } else {
        p = { ...p, segmentStart: now };
      }
      stateRef.current = p;
      writePersisted(p);
      setRunning(true);
    }
  };

  const stop = () => {
    const p = stateRef.current;
    if (!p) { reset(); return; }
    const finalSec = Math.floor(computeElapsed(p));
    if (finalSec < 5) {
      reset();
      return;
    }
    const endedAt = new Date().toISOString();
    onSave(finalSec, p.startedAtWall, endedAt, p.delayMinutes);
    reset();
  };

  const reset = () => {
    stateRef.current = null;
    writePersisted(null);
    setRunning(false);
    setElapsed(0);
  };

  if (variant === 'hero') {
    const paused = !running && elapsed > 0;
    const eyebrow = running ? 'FOCUS SESSION' : paused ? 'PAUSED' : 'READY TO FOCUS';
    // Open-ended sessions loop the ring once an hour so it still feels alive.
    const pct = ((elapsed % 3600) / 3600) * 100;
    return (
      <div className="flex flex-col items-center">
        <HeroTimerRing
          value={running || paused ? pct : 0}
          time={fmt(elapsed)}
          eyebrow={eyebrow}
          active={running}
          lines={running || paused ? contextLines : []}
          footnote={
            running || paused
              ? `Focus streak · ${Math.floor(elapsed / 60)} min`
              : "Choose what you're working on and start your session."
          }
        />
        <div className="mt-7 flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggle}
            className="px-7 py-3.5 rounded-full bg-gradient-primary text-primary-foreground font-semibold text-[13.5px] inline-flex items-center gap-2 shadow-lg shadow-primary/25"
          >
            {running ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />{paused ? 'Resume' : 'Start'}</>}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={stop}
            disabled={elapsed < 5}
            className="px-6 py-3.5 rounded-full border border-border/60 bg-background/40 backdrop-blur text-[13.5px] font-medium hover:bg-background/70 transition disabled:opacity-40"
          >
            Finish
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 sm:p-8 space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-display text-accent/80">Stopwatch</div>
          <div className="text-lg font-bold">Open Focus</div>
        </div>
        <div className={`text-xs tabular-nums ${running ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}>
          {running ? '● Recording' : elapsed > 0 ? '⏸ Paused' : '○ Idle'}
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
        <div className="text-[11px] text-muted-foreground">
          {stateRef.current?.startedAtWall
            ? `Started ${new Date(stateRef.current.startedAtWall).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : 'Free-form study session — keeps ticking even if you close the tab'}
        </div>
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
