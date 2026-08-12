import { motion } from 'framer-motion';

interface Props {
  /** 0..100 progress of the current phase. */
  value: number;
  /** Formatted time string, e.g. "47:32". */
  time: string;
  /** Small uppercase label above the time, e.g. "FOCUS SESSION". */
  eyebrow: string;
  /** Optional lines under the time (task, subject). */
  lines?: (string | null | undefined)[];
  /** Optional footnote, e.g. focus streak. */
  footnote?: string | null;
  active?: boolean;
  size?: number;
}

/**
 * Large, calm hero timer used by the immersive full screen study mode.
 * Purely presentational — all timing logic stays in the timer components.
 */
export function HeroTimerRing({ value, time, eyebrow, lines = [], footnote, active = false, size = 292 }: Props) {
  const stroke = 6;
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const visible = lines.filter(Boolean) as string[];

  return (
    <div className="relative flex flex-col items-center">
      {/* ambient glow while studying */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{
          width: size * 1.1,
          height: size * 1.1,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 68%)',
        }}
        animate={{ opacity: active ? [0.35, 0.6, 0.35] : 0.14, scale: active ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <defs>
            <linearGradient id="hero-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--foreground) / 0.09)" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#hero-ring-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.45))' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</span>
          <motion.span
            key={time.length}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="mt-2 font-display font-semibold tabular-nums leading-none tracking-tight"
            style={{ fontSize: Math.round(size * (time.length > 5 ? 0.2 : 0.25)) }}
          >
            {time}
          </motion.span>
          {visible.length > 0 && (
            <div className="mt-3 space-y-0.5">
              {visible.map((l, i) => (
                <p key={l + i} className={i === 0 ? 'text-[12.5px] font-medium truncate' : 'text-[11px] text-muted-foreground truncate'}>
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {footnote && <p className="mt-4 text-[11.5px] text-muted-foreground">{footnote}</p>}
    </div>
  );
}
