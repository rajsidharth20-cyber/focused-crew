import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, Coffee } from 'lucide-react';
import { ProgressRing } from '@/components/ProgressRing';
import { promptDelay } from './DelayPromptDialog';
import { useBroadcastStudyPresence } from '@/hooks/use-study-presence';

type Phase = 'focus' | 'short' | 'long';

interface Props {
  onComplete: (durationSec: number, plannedSec: number, delayMinutes: number | null) => void;
  onRunningChange?: (running: boolean) => void;
  focusMin?: number;
  shortMin?: number;
  longMin?: number;
  cyclesBeforeLong?: number;
}

const STORAGE_KEY = 'taskpilot_active_pomodoro_v1';

interface Persisted {
  phase: Phase;
  phaseStartWall: string;       // ISO when phase actually started counting (adjusted for prior elapsed on pause/resume)
  phaseStartMs: number | null;  // Date.now() reference; null if paused
  elapsedBeforePause: number;   // seconds already counted in this phase before the current running segment
  totalSec: number;             // duration of this phase in seconds
  cycles: number;
  focusMin: number; shortMin: number; longMin: number;
  delayMinutes: number | null;
}

const readPersisted = (): Persisted | null => {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writePersisted = (p: Persisted | null) => {
  if (p === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
};

export function PomodoroTimer({
  onComplete,
  onRunningChange,
  focusMin: focusMinDefault = 25,
  shortMin: shortMinDefault = 5,
  longMin: longMinDefault = 15,
  cyclesBeforeLong = 4,
}: Props) {
  const [focusMin, setFocusMin] = useState(focusMinDefault);
  const [shortMin, setShortMin] = useState(shortMinDefault);
  const [longMin, setLongMin] = useState(longMinDefault);
  const [phase, setPhase] = useState<Phase>('focus');
  const [remaining, setRemaining] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  useBroadcastStudyPresence(running, 'pomodoro');
  const [cycles, setCycles] = useState(0);
  const stateRef = useRef<Persisted | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => { onRunningChange?.(running); }, [running, onRunningChange]);

  const secForPhase = useCallback((ph: Phase, f: number, s: number, l: number) =>
    (ph === 'focus' ? f : ph === 'short' ? s : l) * 60, []);

  const totalForPhase = secForPhase(phase, focusMin, shortMin, longMin);

  const computeRemaining = useCallback((p: Persisted): number => {
    const elapsed = p.phaseStartMs != null
      ? p.elapsedBeforePause + (Date.now() - p.phaseStartMs) / 1000
      : p.elapsedBeforePause;
    return Math.max(0, p.totalSec - elapsed);
  }, []);

  // Advance to next phase (called when a phase finishes)
  const advancePhase = useCallback((finished: Persisted) => {
    if (finished.phase === 'focus') {
      onCompleteRef.current(finished.totalSec, finished.totalSec, finished.delayMinutes);
      try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
      const nextCycles = finished.cycles + 1;
      const nextPhase: Phase = nextCycles % cyclesBeforeLong === 0 ? 'long' : 'short';
      setCycles(nextCycles);
      setPhase(nextPhase);
      const nextTotal = secForPhase(nextPhase, finished.focusMin, finished.shortMin, finished.longMin);
      setRemaining(nextTotal);
      setRunning(false);
      const nextP: Persisted = {
        phase: nextPhase,
        phaseStartWall: new Date().toISOString(),
        phaseStartMs: null,
        elapsedBeforePause: 0,
        totalSec: nextTotal,
        cycles: nextCycles,
        focusMin: finished.focusMin, shortMin: finished.shortMin, longMin: finished.longMin,
        delayMinutes: null,
      };
      stateRef.current = nextP;
      writePersisted(nextP);
    } else {
      setPhase('focus');
      const nextTotal = secForPhase('focus', finished.focusMin, finished.shortMin, finished.longMin);
      setRemaining(nextTotal);
      setRunning(false);
      stateRef.current = null;
      writePersisted(null);
    }
  }, [cyclesBeforeLong, secForPhase]);

  // Restore on mount
  useEffect(() => {
    const p = readPersisted();
    if (!p) return;
    setPhase(p.phase);
    setCycles(p.cycles);
    setFocusMin(p.focusMin); setShortMin(p.shortMin); setLongMin(p.longMin);
    stateRef.current = p;
    const rem = computeRemaining(p);
    if (rem <= 0 && p.phaseStartMs != null) {
      // Phase completed while we were away
      advancePhase(p);
    } else {
      setRemaining(rem);
      setRunning(p.phaseStartMs != null);
    }
  }, [computeRemaining, advancePhase]);

  // When user changes settings while idle, keep display in sync
  useEffect(() => {
    if (running || stateRef.current) return;
    setRemaining(totalForPhase);
  }, [focusMin, shortMin, longMin, phase, totalForPhase, running]);

  // Tick from wall clock
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const p = stateRef.current;
      if (!p) return;
      const rem = computeRemaining(p);
      if (rem <= 0) {
        advancePhase(p);
      } else {
        setRemaining(rem);
      }
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
  }, [running, computeRemaining, advancePhase]);

  const toggle = async () => {
    if (running) {
      const p = stateRef.current;
      if (p) {
        const elapsed = p.elapsedBeforePause + (p.phaseStartMs ? (Date.now() - p.phaseStartMs) / 1000 : 0);
        const updated: Persisted = { ...p, elapsedBeforePause: elapsed, phaseStartMs: null };
        stateRef.current = updated;
        writePersisted(updated);
      }
      setRunning(false);
      return;
    }
    let p = stateRef.current;
    if (!p) {
      let delay: number | null = null;
      if (phase === 'focus') delay = await promptDelay();
      p = {
        phase,
        phaseStartWall: new Date().toISOString(),
        phaseStartMs: Date.now(),
        elapsedBeforePause: 0,
        totalSec: totalForPhase,
        cycles,
        focusMin, shortMin, longMin,
        delayMinutes: delay,
      };
    } else {
      p = { ...p, phaseStartMs: Date.now() };
    }
    stateRef.current = p;
    writePersisted(p);
    setRunning(true);
  };

  const reset = () => {
    stateRef.current = null;
    writePersisted(null);
    setRunning(false);
    setRemaining(totalForPhase);
  };

  const skip = () => {
    const p = stateRef.current;
    if (p && phase === 'focus') {
      const elapsed = p.elapsedBeforePause + (p.phaseStartMs ? (Date.now() - p.phaseStartMs) / 1000 : 0);
      if (elapsed > 5) onCompleteRef.current(Math.floor(elapsed), p.totalSec, p.delayMinutes);
    }
    stateRef.current = null;
    writePersisted(null);
    setRunning(false);
    setPhase(ph => ph === 'focus' ? 'short' : 'focus');
  };

  const pct = totalForPhase > 0 ? ((totalForPhase - remaining) / totalForPhase) * 100 : 0;
  const phaseLabel = phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short Break' : 'Long Break';

  return (
    <div className={`glass-card space-y-6 transition-all duration-300 ${running ? 'p-6 sm:p-10' : 'p-6 sm:p-8'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-display text-primary/80">Pomodoro</div>
          <div className="text-lg font-bold">{phaseLabel}</div>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">Cycle {cycles}</div>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <ProgressRing showValue={false} value={pct} size={running ? 260 : 220} label={fmt(remaining)} sub={phase === 'focus' ? undefined : 'break'} />
          {phase !== 'focus' && (
            <Coffee className="absolute top-3 right-3 w-4 h-4 text-accent" />
          )}
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
        <button onClick={skip} className="px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-secondary transition" aria-label="Skip">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {!running && (
        <>
          <p className="text-[11px] text-muted-foreground text-center">
            Timer keeps counting even if you close the tab or lock your phone.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
            <NumField label="Focus" value={focusMin} setValue={setFocusMin} disabled={running} />
            <NumField label="Short" value={shortMin} setValue={setShortMin} disabled={running} />
            <NumField label="Long" value={longMin} setValue={setLongMin} disabled={running} />
          </div>
        </>
      )}
    </div>
  );
}

function NumField({ label, value, setValue, disabled }: { label: string; value: number; setValue: (n: number) => void; disabled: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label} (min)</span>
      <input
        type="number"
        min={1}
        max={180}
        value={value}
        disabled={disabled}
        onChange={e => setValue(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
        className="bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm tabular-nums disabled:opacity-50"
      />
    </label>
  );
}
