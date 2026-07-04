import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, Coffee } from 'lucide-react';
import { ProgressRing } from '@/components/ProgressRing';

type Phase = 'focus' | 'short' | 'long';

interface Props {
  onComplete: (durationSec: number, plannedSec: number) => void;
  focusMin?: number;
  shortMin?: number;
  longMin?: number;
  cyclesBeforeLong?: number;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
};

export function PomodoroTimer({
  onComplete,
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
  const [cycles, setCycles] = useState(0);
  const phaseStartRef = useRef<number>(Date.now());

  const totalForPhase = phase === 'focus' ? focusMin * 60 : phase === 'short' ? shortMin * 60 : longMin * 60;

  useEffect(() => {
    if (!running) {
      setRemaining(totalForPhase);
      phaseStartRef.current = Date.now();
    }
  }, [focusMin, shortMin, longMin, phase, totalForPhase, running]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(t);
          setRunning(false);
          // completed one phase
          if (phase === 'focus') {
            onComplete(focusMin * 60, focusMin * 60);
            const nextCycles = cycles + 1;
            setCycles(nextCycles);
            const nextPhase: Phase = nextCycles % cyclesBeforeLong === 0 ? 'long' : 'short';
            setPhase(nextPhase);
          } else {
            setPhase('focus');
          }
          try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, phase, focusMin, cycles, cyclesBeforeLong, onComplete]);

  const toggle = () => {
    if (!running) phaseStartRef.current = Date.now() - (totalForPhase - remaining) * 1000;
    setRunning(r => !r);
  };
  const reset = () => { setRunning(false); setRemaining(totalForPhase); };
  const skip = () => {
    if (running && phase === 'focus') {
      const elapsed = Math.min(totalForPhase, totalForPhase - remaining);
      if (elapsed > 5) onComplete(elapsed, focusMin * 60);
    }
    setRunning(false);
    setPhase(p => p === 'focus' ? 'short' : 'focus');
  };

  const pct = totalForPhase > 0 ? ((totalForPhase - remaining) / totalForPhase) * 100 : 0;
  const phaseLabel = phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short Break' : 'Long Break';

  return (
    <div className="glass-card p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-display text-primary/80">Pomodoro</div>
          <div className="text-lg font-bold">{phaseLabel}</div>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">Cycle {cycles}</div>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <ProgressRing value={pct} size={220} label={fmt(remaining)} sub={phase === 'focus' ? undefined : 'break'} />
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

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
        <NumField label="Focus" value={focusMin} setValue={setFocusMin} disabled={running} />
        <NumField label="Short" value={shortMin} setValue={setShortMin} disabled={running} />
        <NumField label="Long" value={longMin} setValue={setLongMin} disabled={running} />
      </div>
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
