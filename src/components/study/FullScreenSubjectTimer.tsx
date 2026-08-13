import { motion } from 'framer-motion';
import { ChevronDown, Pause, Play, Square } from 'lucide-react';
import { fmtHMS } from '@/components/study/SubjectTimerList';

interface Props {
  subjectName: string;
  color: string;
  elapsed: number;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
}

export function FullScreenSubjectTimer({
  subjectName, color, elapsed, isRunning, onPause, onResume, onStop, onClose,
}: Props) {
  const progress = (elapsed % 3600) / 3600;
  const R = 132;
  const C = 2 * Math.PI * R;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="fixed inset-0 z-50 flex flex-col items-center px-6"
      style={{
        background: `radial-gradient(120% 70% at 50% 0%, ${color}26 0%, transparent 60%), hsl(var(--background))`,
        paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
      }}
    >
      <div className="w-full max-w-md flex items-center justify-between">
        <button onClick={onClose} aria-label="Close full screen timer" className="press h-9 w-9 rounded-full border border-border/50 grid place-items-center">
          <ChevronDown className="w-4 h-4" />
        </button>
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {isRunning ? 'Focusing' : 'Paused'}
        </span>
        <span className="w-9" />
      </div>

      <div className="flex-1 w-full flex flex-col items-center justify-center">
        <div className="relative grid place-items-center">
          <div
            className="absolute rounded-full blur-3xl"
            style={{ width: 260, height: 260, background: color, opacity: isRunning ? 0.28 : 0.12 }}
          />
          <svg width={300} height={300} className="-rotate-90 relative">
            <circle cx={150} cy={150} r={R} fill="none" stroke="hsl(var(--border))" strokeWidth={6} opacity={0.4} />
            <circle
              cx={150} cy={150} r={R} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-[46px] font-bold tabular-nums leading-none tracking-tight">{fmtHMS(elapsed)}</div>
            <div className="mt-3 text-[15px] font-medium" style={{ color }}>{subjectName}</div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md flex items-center justify-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={isRunning ? onPause : onResume}
          className="px-8 py-4 rounded-full text-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg"
          style={{ background: color }}
        >
          {isRunning ? <><Pause className="w-4 h-4" />Pause</> : <><Play className="w-4 h-4" />Resume</>}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onStop}
          className="px-6 py-4 rounded-full border border-border/60 bg-background/50 backdrop-blur text-sm font-medium inline-flex items-center gap-2"
        >
          <Square className="w-3.5 h-3.5" />Stop
        </motion.button>
      </div>
    </motion.div>
  );
}
