import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, hint, action, compact }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-10'}`}
    >
      <div className="relative mb-3">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl" aria-hidden />
        <div className="relative w-14 h-14 rounded-2xl bg-secondary/70 border border-border/60 grid place-items-center text-primary">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground mt-1 max-w-[240px]">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  );
}
